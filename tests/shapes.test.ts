import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderPage, validatePage } from "../src/index";
import { PROFILE_ID, isShapeImplemented } from "../src/profile";
import { buildRoundedBalloonPath } from "../src/shapes/rounded-rect";
import type { Attachment, EdgeStyle } from "../src/shapes/rounded-rect";
import { requireSvg } from "./helpers";

const root = join(import.meta.dir, "..");
const load = (p: string): unknown => JSON.parse(readFileSync(join(root, p), "utf8"));

function mouthTipFromFixture(m: unknown): { x: number; y: number } {
  if (m === null || typeof m !== "object" || Array.isArray(m)) {
    throw new Error("fixture must be object");
  }
  const subjects = Reflect.get(m, "subjects");
  if (!Array.isArray(subjects)) throw new Error("no subjects");
  const subject0 = subjects[0];
  if (subject0 === null || typeof subject0 !== "object") throw new Error("bad subject");
  const anchors = Reflect.get(subject0, "anchors");
  if (anchors === null || typeof anchors !== "object" || Array.isArray(anchors)) {
    throw new Error("bad anchors");
  }
  const tip = Reflect.get(anchors, "mouth");
  if (tip === null || typeof tip !== "object" || Array.isArray(tip)) throw new Error("bad tip");
  const x = Reflect.get(tip, "x");
  const y = Reflect.get(tip, "y");
  if (typeof x !== "number" || typeof y !== "number") throw new Error("bad tip coords");
  return { x, y };
}

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
    const gSvg = requireSvg(gr);
    const hSvg = requireSvg(hr);
    expect(gSvg).toContain('data-shape="speech"');
    expect(gSvg).toContain('data-part="balloon"');
    expect(gSvg).toMatch(/data-part="balloon"[^>]*d="[^"]*Z"/);
    expect(gSvg).not.toContain('data-part="tail"');
    expect(gSvg).not.toEqual(hSvg);
    // Jagged outline uses more L commands than a soft pill
    expect(gSvg).toMatch(/ d="M [^"]*L /);
    expect(gSvg).toContain('fill="#e7f2e9"');
  });

  test("speech + notchTop renders single closed path with notch", () => {
    const m = load("fixtures/speech-notch.json");
    const r = renderPage(m, { locale: "en", profileId: PROFILE_ID });
    const svg = requireSvg(r);
    expect(svg).toContain('data-shape="speech"');
    expect(svg).toMatch(/data-part="balloon"[^>]*d="[^"]*Z"/);
    const paths = svg.match(/<path\b/g) ?? [];
    expect(paths.length).toBe(1);
    expect(svg).toContain('fill="#f3e6e6"');

    // Path-level: notchTop differs from same knobs without notch
    const body = { x: 100, y: 100, width: 400, height: 220 };
    const tip = { x: 280, y: 420 };
    const attachment: Attachment = "bottom";
    const edge: EdgeStyle = "jagged";
    const base = {
      bodies: [body],
      tip,
      bend: null,
      attachment,
      cornerRadius: 0,
      edge,
    };
    const plain = buildRoundedBalloonPath(base);
    const notched = buildRoundedBalloonPath({ ...base, notchTop: true });
    expect(notched).not.toEqual(plain);
    expect(notched.split("L ").length).toBeGreaterThan(plain.split("L ").length);
  });

  test("speech tips in four directions hit anchors", () => {
    const sides = ["bottom", "top", "left", "right"] satisfies readonly Attachment[];
    for (const side of sides) {
      const m = load(`fixtures/speech-${side}.json`);
      const tip = mouthTipFromFixture(m);
      const r = renderPage(m, { locale: "en", profileId: PROFILE_ID });
      const svg = requireSvg(r);
      expect(svg).toContain(`${Number(tip.x).toFixed(2)}`);
      expect(svg).toContain(`${Number(tip.y).toFixed(2)}`);
      expect(svg).toMatch(/data-part="balloon"[^>]*d="[^"]*Z"/);
    }
  });

  test("smooth speech tail starts toward its anchor without a reverse hook", () => {
    const tip = { x: 720, y: 770 };
    const path = buildRoundedBalloonPath({
      bodies: [{ x: 260, y: 150, width: 560, height: 280 }],
      tip,
      bend: null,
      attachment: "bottom",
      cornerRadius: 1,
      edge: "smooth",
    });
    const match = path.match(
      /L (-?\d+\.\d+) (-?\d+\.\d+) Q (-?\d+\.\d+) (-?\d+\.\d+) 720\.00 770\.00/,
    );
    if (!match) throw new Error(`tail entry command missing from path: ${path}`);
    const numberAt = (index: number): number => {
      const token = match[index];
      if (token === undefined) throw new Error(`tail entry capture ${index} missing`);
      return Number(token);
    };
    const enterX = numberAt(1);
    const enterY = numberAt(2);
    const controlX = numberAt(3);
    const controlY = numberAt(4);
    expect((controlX - enterX) * (tip.x - enterX)).toBeGreaterThanOrEqual(0);
    expect((controlY - enterY) * (tip.y - enterY)).toBeGreaterThan(0);
  });

  test("multi-balloon page renders both item groups", () => {
    const m = load("fixtures/multi-balloon.json");
    const v = validatePage(m, { locale: "en", profileId: PROFILE_ID });
    expect(v.valid).toBe(true);
    const r = renderPage(m, { locale: "en", profileId: PROFILE_ID });
    const svg = requireSvg(r);
    expect(svg).toContain('id="M-B01"');
    expect(svg).toContain('id="M-B02"');
    expect(svg).toContain("Left side");
    expect(svg).toContain("Right side");
    const groups = svg.match(/data-shape="speech"/g) ?? [];
    expect(groups.length).toBe(2);
  });

  test("silent items produce no geometry", () => {
    const m = load("examples/page-022.json");
    const r = renderPage(m, { locale: "en", profileId: PROFILE_ID });
    const svg = requireSvg(r);
    expect(svg).not.toContain("P022-04-S01");
  });
});
