import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { validatePage } from "../src/index";
import { PROFILE_ID, isShapeImplemented } from "../src/profile";

const root = join(import.meta.dir, "..");
const load = (p: string) => JSON.parse(readFileSync(join(root, p), "utf8"));

describe("validatePage", () => {
  test("example manifest validates for en and ru", () => {
    const m = load("examples/page-022.json");
    const en = validatePage(m, { locale: "en", profileId: PROFILE_ID });
    const ru = validatePage(m, { locale: "ru", profileId: PROFILE_ID });
    expect(en.valid).toBe(true);
    expect(ru.valid).toBe(true);
    expect(en.pageId).toBe("P022");
  });

  test("SCHEMA_INVALID for bad manifest", () => {
    const m = load("fixtures/schema-invalid.json");
    const r = validatePage(m, { locale: "en", profileId: PROFILE_ID });
    expect(r.valid).toBe(false);
    expect(r.diagnostics.some((d) => d.code === "SCHEMA_INVALID")).toBe(true);
  });

  test("LOCALE_MISSING when ru absent", () => {
    const m = load("fixtures/missing-locale.json");
    const r = validatePage(m, { locale: "ru", profileId: PROFILE_ID });
    expect(r.valid).toBe(false);
    expect(r.diagnostics.some((d) => d.code === "LOCALE_MISSING")).toBe(true);
  });

  test("TEXT_OVERFLOW with itemId", () => {
    const m = load("fixtures/overflow.json");
    const r = validatePage(m, { locale: "en", profileId: PROFILE_ID });
    expect(r.valid).toBe(false);
    const d = r.diagnostics.find((x) => x.code === "TEXT_OVERFLOW");
    expect(d).toBeDefined();
    expect(d!.itemId).toBe("P022-02-B01");
  });

  test("HARD_EXCLUSION_OVERLAP", () => {
    const m = load("fixtures/hard-overlap.json");
    const r = validatePage(m, { locale: "en", profileId: PROFILE_ID });
    expect(r.valid).toBe(false);
    expect(r.diagnostics.some((d) => d.code === "HARD_EXCLUSION_OVERLAP")).toBe(
      true,
    );
  });

  test("glitch-01 is implemented — no UNKNOWN_SHAPE", () => {
    expect(isShapeImplemented("glitch-01")).toBe(true);
    const m = load("fixtures/unknown-shape.json");
    const r = validatePage(m, { locale: "en", profileId: PROFILE_ID });
    expect(r.diagnostics.some((d) => d.code === "UNKNOWN_SHAPE")).toBe(false);
    expect(r.valid).toBe(true);
  });

  test("glitch-breaking-01 is implemented", () => {
    expect(isShapeImplemented("glitch-breaking-01")).toBe(true);
    const m = load("fixtures/glitch-breaking-01.json");
    const r = validatePage(m, { locale: "en", profileId: PROFILE_ID });
    expect(r.valid).toBe(true);
    expect(r.diagnostics.some((d) => d.code === "UNKNOWN_SHAPE")).toBe(false);
  });

  test("UNKNOWN_ANCHOR", () => {
    const m = load("fixtures/unknown-anchor.json");
    const r = validatePage(m, { locale: "en", profileId: PROFILE_ID });
    expect(r.valid).toBe(false);
    expect(r.diagnostics.some((d) => d.code === "UNKNOWN_ANCHOR")).toBe(true);
  });
});
