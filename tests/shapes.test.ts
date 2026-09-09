import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderPage, validatePage } from "../src/index";
import { PROFILE_ID, isShapeImplemented } from "../src/profile";
import { buildRoundedBalloonPath } from "../src/shapes/rounded-rect";

const root = join(import.meta.dir, "..");
const load = (p: string) => JSON.parse(readFileSync(join(root, p), "utf8"));

describe("registered shapes", () => {
  test("all schema shapes are implemented", () => {
    expect(isShapeImplemented("speech")).toBe(true);
    expect(isShapeImplemented("chain")).toBe(true);
    expect(isShapeImplemented("cloud")).toBe(true);
    expect(isShapeImplemented("glitch")).toBe(false);
    expect(isShapeImplemented("shatter")).toBe(false);
  });

  test("speech + jagged knobs renders single closed path distinct from soft speech", () => {
    const g = load("fixtures/speech-jagged.json");
    const h = load("examples/page-022.json");
    const gr = renderPage(g, { locale: "en", profileId: PROFILE_ID });
    const hr = renderPage(h, { locale: "en", profileId: PROFILE_ID });
    expect(gr.svg).not.toBeNull();
    expect(gr.svg!).toContain('data-shape="speech"');
    expect(gr.svg!).toContain('data-part="balloon"');
    expect(gr.svg!).toMatch(/data-part="balloon"[^>]*d="[^"]*Z"/);
    expect(gr.svg!).not.toContain('data-part="tail"');
    expect(gr.svg!).not.toEqual(hr.svg!);
    // Jagged outline uses more L commands than a soft pill
    expect(gr.svg!).toMatch(/ d="M [^"]*L /);
    expect(gr.svg!).toContain('fill="#e7f2e9"');
  });

  test("speech + notchTop renders single closed path with notch", () => {
    const m = load("fixtures/speech-notch.json");
    const r = renderPage(m, { locale: "en", profileId: PROFILE_ID });
    expect(r.svg).not.toBeNull();
    expect(r.svg!).toContain('data-shape="speech"');
    expect(r.svg!).toMatch(/data-part="balloon"[^>]*d="[^"]*Z"/);
    const paths = r.svg!.match(/<path\b/g) ?? [];
    expect(paths.length).toBe(1);
    expect(r.svg!).toContain('fill="#f3e6e6"');

    // Path-level: notchTop differs from same knobs without notch
    const body = { x: 100, y: 100, width: 400, height: 220 };
    const tip = { x: 280, y: 420 };
    const base = {
      bodies: [body],
      tip,
      bend: null as null,
      attachment: "bottom" as const,
      cornerRadius: 0,
      edge: "jagged" as const,
    };
    const plain = buildRoundedBalloonPath(base);
    const notched = buildRoundedBalloonPath({ ...base, notchTop: true });
    expect(notched).not.toEqual(plain);
    expect(notched.split("L ").length).toBeGreaterThan(plain.split("L ").length);
  });

  test("speech tips in four directions hit anchors", () => {
    for (const side of ["bottom", "top", "left", "right"] as const) {
      const m = load(`fixtures/speech-${side}.json`);
      const tip = m.subjects[0].anchors.mouth;
      const r = renderPage(m, { locale: "en", profileId: PROFILE_ID });
      expect(r.svg).not.toBeNull();
      expect(r.svg!).toContain(`${Number(tip.x).toFixed(2)}`);
      expect(r.svg!).toContain(`${Number(tip.y).toFixed(2)}`);
      expect(r.svg!).toMatch(/data-part="balloon"[^>]*d="[^"]*Z"/);
    }
  });

  test("multi-balloon page renders both item groups", () => {
    const m = load("fixtures/multi-balloon.json");
    const v = validatePage(m, { locale: "en", profileId: PROFILE_ID });
    expect(v.valid).toBe(true);
    const r = renderPage(m, { locale: "en", profileId: PROFILE_ID });
    expect(r.svg).not.toBeNull();
    expect(r.svg!).toContain('id="M-B01"');
    expect(r.svg!).toContain('id="M-B02"');
    expect(r.svg!).toContain("Left side");
    expect(r.svg!).toContain("Right side");
    const groups = r.svg!.match(/data-shape="speech"/g) ?? [];
    expect(groups.length).toBe(2);
  });

  test("silent items produce no geometry", () => {
    const m = load("examples/page-022.json");
    const r = renderPage(m, { locale: "en", profileId: PROFILE_ID });
    expect(r.svg!).not.toContain("P022-04-S01");
  });
});
