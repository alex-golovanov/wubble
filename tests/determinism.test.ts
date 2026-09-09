import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderPage } from "../src/index";
import { serializeDiagnostics } from "../src/diagnostics";
import { PROFILE_ID } from "../src/profile";

const root = join(import.meta.dir, "..");
const load = (p: string) => JSON.parse(readFileSync(join(root, p), "utf8"));

describe("determinism", () => {
  test("two consecutive renders are byte-identical", () => {
    const m = load("examples/page-022.json");
    const a = renderPage(m, { locale: "en", profileId: PROFILE_ID });
    const b = renderPage(m, { locale: "en", profileId: PROFILE_ID });
    expect(a.svg).toBe(b.svg);
    expect(serializeDiagnostics(a.diagnostics)).toBe(
      serializeDiagnostics(b.diagnostics),
    );
  });

  test("ru consecutive renders byte-identical", () => {
    const m = load("examples/page-022.json");
    const a = renderPage(m, { locale: "ru", profileId: PROFILE_ID });
    const b = renderPage(m, { locale: "ru", profileId: PROFILE_ID });
    expect(a.svg).toBe(b.svg);
  });

  test("SVG uses LF and fixed precision", () => {
    const m = load("examples/page-022.json");
    const { svg } = renderPage(m, { locale: "en", profileId: PROFILE_ID });
    expect(svg).not.toBeNull();
    expect(svg!.includes("\r")).toBe(false);
    expect(svg!).toMatch(/\d+\.\d{2}/);
  });
});
