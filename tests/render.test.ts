import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderPage } from "../src/index";
import { PROFILE, PROFILE_ID } from "../src/profile";
import { MANIFEST_SVG_FORBIDDEN } from "../src/render";
import { requireSvg } from "./helpers";

const root = join(import.meta.dir, "..");
const load = (p: string): unknown => JSON.parse(readFileSync(join(root, p), "utf8"));

describe("renderPage", () => {
  test("en and ru render separate SVGs with viewBox 0 0 1800 2700", () => {
    const m = load("examples/page-022.json");
    const en = renderPage(m, { locale: "en", profileId: PROFILE_ID });
    const ru = renderPage(m, { locale: "ru", profileId: PROFILE_ID });
    const enSvg = requireSvg(en);
    const ruSvg = requireSvg(ru);
    expect(enSvg).toContain('viewBox="0 0 1800 2700"');
    expect(ruSvg).toContain('viewBox="0 0 1800 2700"');
    expect(enSvg).not.toEqual(ruSvg);
  });

  test("same item id and anchor target in both locales", () => {
    const m = load("examples/page-022.json");
    const enSvg = requireSvg(renderPage(m, { locale: "en", profileId: PROFILE_ID }));
    const ruSvg = requireSvg(renderPage(m, { locale: "ru", profileId: PROFILE_ID }));
    expect(enSvg).toContain('id="P022-02-B01"');
    expect(ruSvg).toContain('id="P022-02-B01"');
    // tip at mouth 1225,1685 appears in both tail paths
    expect(enSvg).toContain("1225.00");
    expect(enSvg).toContain("1685.00");
    expect(ruSvg).toContain("1225.00");
    expect(ruSvg).toContain("1685.00");
  });

  test("ru localeOverrides wider bounds; en unchanged", () => {
    const m = load("examples/page-022.json");
    const enSvg = requireSvg(renderPage(m, { locale: "en", profileId: PROFILE_ID }));
    const ruSvg = requireSvg(renderPage(m, { locale: "ru", profileId: PROFILE_ID }));
    // EN placement starts at x=930; RU override at x=855
    expect(enSvg).toContain("We keep");
    expect(enSvg).not.toContain("Продолжаем");
    expect(ruSvg).toContain("Продолжаем");
    expect(ruSvg).not.toContain("We keep");
    // RU override width 650 vs EN 560 — body path should differ
    expect(enSvg).not.toEqual(ruSvg);
  });

  test("font embedded; no OS font dependency markers", () => {
    const m = load("examples/page-022.json");
    const enSvg = requireSvg(renderPage(m, { locale: "en", profileId: PROFILE_ID }));
    expect(enSvg).toContain("@font-face");
    expect(enSvg).toContain("data:font/otf;base64,");
    expect(enSvg).toContain('font-family: "Noto Sans"');
    expect(enSvg).not.toContain("/System/Library");
    expect(enSvg).not.toContain("fonts.googleapis");
    // digest recorded in profile
    expect(PROFILE.typography.fontDigestSha256).toHaveLength(64);
  });

  test("missing ru → LOCALE_MISSING, svg null", () => {
    const m = load("fixtures/missing-locale.json");
    const r = renderPage(m, { locale: "ru", profileId: PROFILE_ID });
    expect(r.svg).toBeNull();
    expect(r.diagnostics.diagnostics.some((d) => d.code === "LOCALE_MISSING")).toBe(true);
  });

  test("single integrated balloon path — no separate tail/body strokes", () => {
    const m = load("examples/page-022.json");
    const svg = requireSvg(renderPage(m, { locale: "en", profileId: PROFILE_ID }));
    expect(svg).not.toContain('data-part="tail"');
    expect(svg).not.toContain('data-part="body"');
    expect(svg).toContain('data-part="balloon"');
    expect(svg).toContain('data-part="text"');
    // Exactly one silhouette path inside the item group
    const group = svg.slice(
      svg.indexOf('id="P022-02-B01"'),
      svg.indexOf("</g>", svg.indexOf('data-part="text"')) + 4,
    );
    const pathOpens = group.match(/<path\b/g) ?? [];
    expect(pathOpens.length).toBe(1);
    expect(group).toMatch(/<path data-part="balloon" d="M /);
    // Tip anchor appears in the integrated path
    expect(svg).toContain("1225.00");
    expect(svg).toContain("1685.00");
  });

  test("speech produces integrated oval+tail silhouette", () => {
    const m = load("examples/page-022.json");
    const enSvg = requireSvg(renderPage(m, { locale: "en", profileId: PROFILE_ID }));
    expect(enSvg).toContain('data-shape="speech"');
    expect(enSvg).toContain('data-part="balloon"');
    expect(enSvg).toContain('data-part="text"');
    expect(enSvg).toMatch(/<path data-part="balloon" d="M /);
    // Closed path (Z) — one continuous outline
    expect(enSvg).toMatch(/data-part="balloon"[^>]*d="[^"]*Z"/);
  });

  test("no path accepting manifest-supplied raw SVG/styles", () => {
    expect(MANIFEST_SVG_FORBIDDEN).toBe(true);
    const m = load("examples/page-022.json");
    if (m === null || typeof m !== "object" || Array.isArray(m)) {
      throw new Error("manifest must be object");
    }
    const mutated: Record<string, unknown> = { ...m };
    mutated["items"] = [
      {
        kind: "balloon",
        id: "X",
        panelId: "P",
        speakerId: "lex",
        shapeId: "speech",
        placement: { x: 10, y: 10, width: 100, height: 80 },
        content: { en: { lines: ["Hi"] } },
        rawSvg: "<circle/>",
        style: { fill: "red" },
      },
    ];
    const r = renderPage(mutated, { locale: "en", profileId: PROFILE_ID });
    expect(r.diagnostics.diagnostics.some((d) => d.code === "SCHEMA_INVALID")).toBe(true);
    expect(r.svg).toBeNull();
  });
});
