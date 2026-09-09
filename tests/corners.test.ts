import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderPage, validatePage } from "../src/index";
import { PROFILE_ID } from "../src/profile";
import {
  fitBalloonText,
  resolveLetteringPads,
  resolveShapePadding,
} from "../src/layout";
import {
  buildRoundedBalloonPath,
  pathHasPointNear,
} from "../src/shapes/rounded-rect";

const root = join(import.meta.dir, "..");
const load = (p: string) => JSON.parse(readFileSync(join(root, p), "utf8"));

describe("cornerRadius + edge", () => {
  test("radius 0 vs 1 produce different corners on same body", () => {
    const body = { x: 100, y: 100, width: 400, height: 220 };
    const tip = { x: 280, y: 420 };
    const sharp = buildRoundedBalloonPath({
      bodies: [body],
      tip,
      bend: null,
      attachment: "bottom",
      cornerRadius: 0,
      edge: "smooth",
    });
    const pill = buildRoundedBalloonPath({
      bodies: [body],
      tip,
      bend: null,
      attachment: "bottom",
      cornerRadius: 1,
      edge: "smooth",
    });
    expect(sharp).not.toEqual(pill);
    // Sharp rect keeps AABB corners on the path
    expect(pathHasPointNear(sharp, body.x, body.y)).toBe(true);
    expect(pathHasPointNear(sharp, body.x + body.width, body.y)).toBe(true);
    // Full pill should not place geometry at sharp AABB corners
    expect(pathHasPointNear(pill, body.x, body.y, 2)).toBe(false);
    expect(pathHasPointNear(pill, body.x + body.width, body.y, 2)).toBe(false);
    // Both include the tip (open join)
    expect(pathHasPointNear(sharp, tip.x, tip.y)).toBe(true);
    expect(pathHasPointNear(pill, tip.x, tip.y)).toBe(true);
    // No separate crossbar: tip is between join points in a continuous path ending Z
    expect(sharp.endsWith("Z")).toBe(true);
    expect(pill.endsWith("Z")).toBe(true);
  });

  test("jagged edge differs from smooth at radius 0", () => {
    const body = { x: 40, y: 40, width: 300, height: 180 };
    const tip = { x: 160, y: 320 };
    const smooth = buildRoundedBalloonPath({
      bodies: [body],
      tip,
      bend: null,
      attachment: "bottom",
      cornerRadius: 0,
      edge: "smooth",
    });
    const jagged = buildRoundedBalloonPath({
      bodies: [body],
      tip,
      bend: null,
      attachment: "bottom",
      cornerRadius: 0,
      edge: "jagged",
    });
    expect(jagged).not.toEqual(smooth);
    expect(jagged.split("L ").length).toBeGreaterThan(smooth.split("L ").length);
  });

  test("corners grid fixture validates and renders four balloons", () => {
    const m = load("fixtures/corners-grid.json");
    const v = validatePage(m, { locale: "en", profileId: PROFILE_ID });
    expect(v.valid).toBe(true);
    const r = renderPage(m, { locale: "en", profileId: PROFILE_ID });
    expect(r.svg).not.toBeNull();
    expect(r.svg!).toContain('id="C-R0"');
    expect(r.svg!).toContain('id="C-R5"');
    expect(r.svg!).toContain('id="C-R1"');
    expect(r.svg!).toContain('id="C-JAG"');
    expect(r.svg!).toContain("robot");
  });
});

describe("chained multi-bubbles", () => {
  test("chain-three is one silhouette with three text blocks", () => {
    const m = load("fixtures/chain-three.json");
    const v = validatePage(m, { locale: "en", profileId: PROFILE_ID });
    expect(v.valid).toBe(true);
    const r = renderPage(m, { locale: "en", profileId: PROFILE_ID });
    expect(r.svg).not.toBeNull();
    const svg = r.svg!;
    expect(svg).toContain('id="CH-01"');
    expect(svg).toContain("First beat");
    expect(svg).toContain("middle");
    expect(svg).toContain("punchline");
    // Single balloon path in the group
    const gStart = svg.indexOf('id="CH-01"');
    const g = svg.slice(gStart, svg.indexOf("</g>", svg.lastIndexOf('data-part="text"')) + 4);
    const paths = g.match(/<path\b/g) ?? [];
    expect(paths.length).toBe(1);
    expect(g).toMatch(/data-part="balloon"[^>]*d="[^"]*Z"/);
    // Tip anchor present
    expect(svg).toContain("450.00");
    expect(svg).toContain("1200.00");
  });

  test("chain path spans multiple lobe Y ranges", () => {
    const top = { x: 100, y: 50, width: 300, height: 120 };
    const mid = { x: 80, y: 200, width: 340, height: 120 };
    const bot = { x: 110, y: 360, width: 280, height: 120 };
    const tip = { x: 220, y: 560 };
    const path = buildRoundedBalloonPath({
      bodies: [top, mid, bot],
      tip,
      bend: null,
      attachment: "bottom",
      cornerRadius: 1,
      edge: "smooth",
    });
    expect(pathHasPointNear(path, tip.x, tip.y)).toBe(true);
    // Explicit path endpoints: top-left flat of top lobe, bottom-left flat of bottom lobe
    const topR = Math.min(top.width, top.height) / 2; // cornerRadius 1
    expect(pathHasPointNear(path, top.x + topR, top.y, 2)).toBe(true);
    expect(pathHasPointNear(path, bot.x + topR, bot.y + bot.height, 40)).toBe(true);
  });
});

describe("cornerRadius lettering density", () => {
  test("soft needs larger body than square for the same long text", () => {
    const placement = { x: 300, y: 260, width: 720, height: 300 };
    const content = {
      lines: ["Signal locked. Replay ready.", "We keep moving through the static."],
    };
    const soft = fitBalloonText(content, placement, "soft", "speech", {
      cornerRadius: 1,
      edge: "smooth",
    });
    const square = fitBalloonText(content, placement, "sq", "speech", {
      cornerRadius: 0,
      edge: "smooth",
    });
    expect(soft.fitted).not.toBeNull();
    expect(square.fitted).not.toBeNull();
    // Soft usable area is smaller: either larger body at same type, or type steps down first.
    expect(soft.fitted!.fontSize).toBeLessThanOrEqual(square.fitted!.fontSize);
    if (soft.fitted!.fontSize === square.fitted!.fontSize) {
      expect(soft.fitted!.bodyBounds.width).toBeGreaterThanOrEqual(
        square.fitted!.bodyBounds.width,
      );
      expect(soft.fitted!.bodyBounds.height).toBeGreaterThanOrEqual(
        square.fitted!.bodyBounds.height,
      );
    }
  });

  test("radius 0 smooth matches absolute pads (no extra corner inset)", () => {
    const base = resolveShapePadding("speech", 640, 320);
    const sq = resolveLetteringPads("speech", 640, 320, {
      cornerRadius: 0,
      edge: "smooth",
    });
    expect(sq).toEqual(base);
    const soft = resolveLetteringPads("speech", 640, 320, {
      cornerRadius: 1,
      edge: "smooth",
    });
    expect(soft.padY).toBeGreaterThan(base.padY);
  });
});
