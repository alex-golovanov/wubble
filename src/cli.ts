#!/usr/bin/env bun
/**
 * wubble CLI — validate | render | proof
 * Exit: 0 ok, 1 validation failed, 2 usage/IO, 3 internal
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderPage, validatePage } from "./index";
import { serializeDiagnostics, hasErrors } from "./diagnostics";
import { PROFILE_ID } from "./profile";
import { compositeProof } from "./proof";

function usage(): never {
  console.error(`Usage:
  wubble validate <manifest> [--diagnostics <file.json>]
  wubble render <manifest> --locale <tag> --output <overlay.svg> [--diagnostics <file.json>]
  wubble proof <manifest> --locale <tag> --art <image> --output <proof.png> [--diagnostics <file.json>]
`);
  process.exit(2);
}

function parseArgs(argv: string[]) {
  const args = argv.slice(2);
  const cmd = args[0];
  if (!cmd || cmd === "-h" || cmd === "--help") usage();

  const positional: string[] = [];
  const flags: Record<string, string> = {};
  for (let i = 1; i < args.length; i++) {
    const a = args[i]!;
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const val = args[i + 1];
      if (!val || val.startsWith("--")) {
        console.error(`Missing value for --${key}`);
        process.exit(2);
      }
      flags[key] = val;
      i++;
    } else {
      positional.push(a);
    }
  }
  return { cmd, positional, flags };
}

function loadManifest(path: string): unknown {
  try {
    const text = readFileSync(path, "utf8");
    return JSON.parse(text) as unknown;
  } catch (e) {
    console.error(`Cannot read/parse manifest: ${path}`);
    console.error(e instanceof Error ? e.message : e);
    process.exit(2);
  }
}

function writeDiagnostics(path: string | undefined, report: ReturnType<typeof validatePage>) {
  if (!path) return;
  try {
    writeFileSync(path, serializeDiagnostics(report), "utf8");
  } catch (e) {
    console.error(`Cannot write diagnostics: ${path}`);
    console.error(e instanceof Error ? e.message : e);
    process.exit(2);
  }
}

async function main() {
  try {
    const { cmd, positional, flags } = parseArgs(process.argv);
    const manifestPath = positional[0];
    if (!manifestPath) usage();

    const manifest = loadManifest(resolve(manifestPath));
    const locale = flags.locale ?? "en";
    const profileId = flags.profile ?? PROFILE_ID;

    if (cmd === "validate") {
      const report = validatePage(manifest, { locale, profileId });
      writeDiagnostics(flags.diagnostics, report);
      if (!report.valid) {
        console.error(
          `Validation failed (${report.diagnostics.filter((d) => d.level === "error").length} errors)`,
        );
        process.exit(1);
      }
      console.log(`OK ${report.pageId ?? ""}`.trim());
      process.exit(0);
    }

    if (cmd === "render") {
      if (!flags.locale || !flags.output) usage();
      const result = renderPage(manifest, { locale: flags.locale, profileId });
      writeDiagnostics(flags.diagnostics, result.diagnostics);
      if (hasErrors(result.diagnostics) || result.svg === null) {
        console.error("Render refused: error-level diagnostics present");
        process.exit(1);
      }
      try {
        writeFileSync(resolve(flags.output), result.svg, "utf8");
      } catch {
        console.error(`Cannot write SVG: ${flags.output}`);
        process.exit(2);
      }
      console.log(`Wrote ${flags.output}`);
      process.exit(0);
    }

    if (cmd === "proof") {
      if (!flags.locale || !flags.art || !flags.output) usage();
      const result = renderPage(manifest, { locale: flags.locale, profileId });
      writeDiagnostics(flags.diagnostics, result.diagnostics);
      if (hasErrors(result.diagnostics) || result.svg === null) {
        console.error("Proof refused: error-level diagnostics present");
        process.exit(1);
      }
      try {
        const png = await compositeProof(result.svg, resolve(flags.art));
        writeFileSync(resolve(flags.output), png);
      } catch (e) {
        console.error(`Proof compositing failed: ${e instanceof Error ? e.message : String(e)}`);
        process.exit(2);
      }
      console.log(`Wrote ${flags.output}`);
      process.exit(0);
    }

    usage();
  } catch (e) {
    console.error("Internal error:", e instanceof Error ? e.message : String(e));
    process.exit(3);
  }
}

void main();
