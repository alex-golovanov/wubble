import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderPage, validatePage } from "../src/index";
import { PROFILE_ID, isShapeImplemented } from "../src/profile";

const root = join(import.meta.dir, "..");
const load = (p: string) => JSON.parse(readFileSync(join(root, p), "utf8"));

describe("registered shapes", () => {
  test("all schema shapes are implemented", () => {
    expect(isShapeImplemented("human-01")).toBe(true);
    expect(isShapeImplemented("glitch-01")).toBe(true);
    expect(isShapeImplemented("glitch-breaking-01")).toBe(true);
  });

  test("glitch-01 renders single closed path distinct from human-01", () => {
    const g = load("fixtures/glitch-01.json");
    const h = load("examples/page-022.json");
    const gr = renderPage(g, { locale: "en", profileId: PROFILE_ID });
    const hr = renderPage(h, { locale: "en", profileId: PROFILE_ID });
    expect(gr.svg).not.toBeNull();
    expect(gr.svg!).toContain('data-shape="glitch-01"');
    expect(gr.svg!).toContain('data-part="balloon"');
    expect(gr.svg!).toMatch(/data-part="balloon"[^>]*d="[^"]*Z"/);
    expect(gr.svg!).not.toContain('data-part="tail"');
    expect(gr.svg!).not.toEqual(hr.svg!);
    // Both are single closed silhouettes; glitch defaults to jagged (more L cmds)
    expect(gr.svg!).toMatch(/ d="M [^"]*L /);
    expect(gr.svg!).toMatch(/data-part="balloon"[^>]*d="[^"]*Z"/);
  });

  test("glitch-breaking-01 renders single closed path", () => {
    const m = load("fixtures/glitch-breaking-01.json");
    const r = renderPage(m, { locale: "en", profileId: PROFILE_ID });
    expect(r.svg).not.toBeNull();
    expect(r.svg!).toContain('data-shape="glitch-breaking-01"');
    expect(r.svg!).toMatch(/data-part="balloon"[^>]*d="[^"]*Z"/);
    const paths = r.svg!.match(/<path\b/g) ?? [];
    expect(paths.length).toBe(1);
  });

  test("human-01 tips in four directions hit anchors", () => {
    for (const side of ["bottom", "top", "left", "right"] as const) {
      const m = load(`fixtures/human-01-${side}.json`);
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
    const groups = r.svg!.match(/data-shape="human-01"/g) ?? [];
    expect(groups.length).toBe(2);
  });

  test("silent items produce no geometry", () => {
    const m = load("examples/page-022.json");
    const r = renderPage(m, { locale: "en", profileId: PROFILE_ID });
    expect(r.svg!).not.toContain("P022-04-S01");
  });
});
