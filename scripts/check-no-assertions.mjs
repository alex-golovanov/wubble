#!/usr/bin/env bun
/**
 * Fail if src/ or tests/ contain type assertions / as const / non-null !.
 * Complements oxlint (which bans assertions + non-null, but we also want an
 * explicit as-const scan called out in AGENTS.md).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const roots = ["src", "tests"];
const hits = [];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith(".ts")) out.push(p);
  }
  return out;
}

/** Remove comments and string literals so prose "as …" does not false-positive. */
function stripNoise(source) {
  let out = "";
  let i = 0;
  while (i < source.length) {
    // line comment
    if (source[i] === "/" && source[i + 1] === "/") {
      while (i < source.length && source[i] !== "\n") i++;
      continue;
    }
    // block comment
    if (source[i] === "/" && source[i + 1] === "*") {
      i += 2;
      while (i < source.length && !(source[i] === "*" && source[i + 1] === "/")) i++;
      i += 2;
      out += " ";
      continue;
    }
    // strings
    const q = source[i];
    if (q === "'" || q === '"' || q === "`") {
      i++;
      while (i < source.length) {
        if (source[i] === "\\") {
          i += 2;
          continue;
        }
        if (source[i] === q) {
          i++;
          break;
        }
        // template interpolation — keep scanning simply
        if (q === "`" && source[i] === "$" && source[i + 1] === "{") {
          i += 2;
          let depth = 1;
          while (i < source.length && depth > 0) {
            if (source[i] === "{") depth++;
            else if (source[i] === "}") depth--;
            i++;
          }
          continue;
        }
        i++;
      }
      out += '""';
      continue;
    }
    out += source[i];
    i++;
  }
  return out;
}

const asConstRe = /\bas\s+const\b/g;
const asTypeRe = /(?<![A-Za-z_$])as\s+(?!const\b)(?:[A-Za-z_$<{])/g;
const bangRe = /(?:[\w)\]]|})!(?!=)/g;

for (const root of roots) {
  for (const file of walk(root)) {
    const raw = readFileSync(file, "utf8");
    // drop shebang
    const body = raw.startsWith("#!") ? raw.slice(raw.indexOf("\n") + 1) : raw;
    const cleaned = stripNoise(body);
    const lines = cleaned.split("\n");
    const rawLines = body.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? "";
      const display = (rawLines[i] ?? "").trim();
      if (asConstRe.test(line)) hits.push(`${relative(".", file)}:${i + 1}: as const — ${display}`);
      asConstRe.lastIndex = 0;
      if (asTypeRe.test(line)) hits.push(`${relative(".", file)}:${i + 1}: as Type — ${display}`);
      asTypeRe.lastIndex = 0;
      if (bangRe.test(line)) hits.push(`${relative(".", file)}:${i + 1}: non-null ! — ${display}`);
      bangRe.lastIndex = 0;
    }
  }
}

if (hits.length > 0) {
  console.error("Assertion ban violated:\n" + hits.join("\n"));
  process.exit(1);
}
console.log("check-no-assertions: ok");
