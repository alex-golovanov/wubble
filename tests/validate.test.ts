import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { validatePage } from "../src/index";
import { PROFILE_ID, isShapeImplemented } from "../src/profile";

const root = join(import.meta.dir, "..");
const load = (p: string): unknown => JSON.parse(readFileSync(join(root, p), "utf8"));

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
    if (d === undefined) throw new Error("expected TEXT_OVERFLOW");
    expect(d.itemId).toBe("P022-02-B01");
  });

  test("HARD_EXCLUSION_OVERLAP", () => {
    const m = load("fixtures/hard-overlap.json");
    const r = validatePage(m, { locale: "en", profileId: PROFILE_ID });
    expect(r.valid).toBe(false);
    expect(r.diagnostics.some((d) => d.code === "HARD_EXCLUSION_OVERLAP")).toBe(true);
  });

  test("speech jagged fixture validates — no UNKNOWN_SHAPE", () => {
    expect(isShapeImplemented("speech")).toBe(true);
    expect(isShapeImplemented("glitch")).toBe(false);
    expect(isShapeImplemented("shatter")).toBe(false);
    const m = load("fixtures/speech-jagged.json");
    const r = validatePage(m, { locale: "en", profileId: PROFILE_ID });
    expect(r.diagnostics.some((d) => d.code === "UNKNOWN_SHAPE")).toBe(false);
    expect(r.valid).toBe(true);
  });

  test("speech notch fixture validates", () => {
    const m = load("fixtures/speech-notch.json");
    const r = validatePage(m, { locale: "en", profileId: PROFILE_ID });
    expect(r.valid).toBe(true);
    expect(r.diagnostics.some((d) => d.code === "UNKNOWN_SHAPE")).toBe(false);
  });

  test("UNKNOWN_SHAPE gate rejects removed and bogus ids", () => {
    expect(isShapeImplemented("glitch")).toBe(false);
    expect(isShapeImplemented("shatter")).toBe(false);
    expect(isShapeImplemented("not-a-real-shape")).toBe(false);
    // Schema enum rejects unknown ids as SCHEMA_INVALID; helper still gates.
    const speech = load("fixtures/unknown-shape.json");
    const r = validatePage(speech, { locale: "en", profileId: PROFILE_ID });
    expect(r.diagnostics.some((d) => d.code === "UNKNOWN_SHAPE")).toBe(false);
    expect(r.valid).toBe(true);
  });

  test("UNKNOWN_ANCHOR", () => {
    const m = load("fixtures/unknown-anchor.json");
    const r = validatePage(m, { locale: "en", profileId: PROFILE_ID });
    expect(r.valid).toBe(false);
    expect(r.diagnostics.some((d) => d.code === "UNKNOWN_ANCHOR")).toBe(true);
  });
});

describe("tail reach", () => {
  // "It's new." fits this placement without growing it: the body's bottom edge is y = 320.
  function spoken(mouth: { x: number; y: number }): unknown {
    return {
      schemaVersion: "0.1.0",
      pageId: "tail-reach",
      coordinateSpace: { width: 1200, height: 760, origin: "top-left", units: "art-px" },
      renderProfile: { id: PROFILE_ID, version: "0.1.0" },
      subjects: [
        {
          id: "lex",
          bounds: { x: mouth.x - 60, y: mouth.y - 40, width: 120, height: 120 },
          anchors: { mouth },
        },
      ],
      exclusionZones: [],
      items: [
        {
          kind: "balloon",
          id: "B01",
          panelId: "P01",
          speakerId: "lex",
          shapeId: "speech",
          style: "dialogue",
          placement: { x: 120, y: 140, width: 520, height: 180 },
          tail: { subjectId: "lex", anchor: "mouth", attachment: "auto" },
          content: { en: { text: "It's new." } },
        },
      ],
    };
  }

  const codes = (m: unknown): string[] =>
    validatePage(m, { locale: "en", profileId: PROFILE_ID }).diagnostics.map((d) => d.code);

  test("a tail whose tip lies inside its own balloon is refused", () => {
    const r = validatePage(spoken({ x: 380, y: 250 }), { locale: "en", profileId: PROFILE_ID });
    expect(r.valid).toBe(false);
    expect(r.diagnostics.find((d) => d.code === "TAIL_TOO_SHORT")?.itemId).toBe("B01");
  });

  test("a tail too short to read as a tail is refused", () => {
    expect(codes(spoken({ x: 380, y: 340 }))).toContain("TAIL_TOO_SHORT");
  });

  test("a tail with room to reach its speaker passes", () => {
    const r = validatePage(spoken({ x: 380, y: 440 }), { locale: "en", profileId: PROFILE_ID });
    expect(r.diagnostics.map((d) => d.code)).not.toContain("TAIL_TOO_SHORT");
    expect(r.valid).toBe(true);
  });
});
