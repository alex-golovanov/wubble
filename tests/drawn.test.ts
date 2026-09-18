import { describe, expect, test } from "bun:test";
import { measureWidth } from "../src/font";
import {
  buildDrawnBalloon,
  drawnExponent,
  drawnLines,
  drawnSeed,
  inkWeight,
} from "../src/shapes/drawn";
import type { DrawnSpec, DrawnTail } from "../src/shapes/drawn";
import type { FontId, Point, TailMood } from "../src/types";

const FONT: FontId = "shantell-sans-semibold";

function spec(lines: string[], extra: Partial<DrawnSpec> = {}): DrawnSpec {
  return {
    center: { x: 600, y: 300 },
    text: { lines, fontSize: 48, lineHeight: 60, fontId: FONT },
    seed: drawnSeed("B01", lines.join(" ")),
    strokeWidth: 4.5,
    tip: null,
    bend: null,
    mood: "calm",
    ...extra,
  };
}

/** Ray casting: is the point inside the closed polygon? */
function inside(p: Point, poly: Point[]): boolean {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (!a || !b) continue;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
      hit = !hit;
    }
  }
  return hit;
}

function spineAt(t: DrawnTail, u: number): Point {
  const v = 1 - u;
  return {
    x:
      v * v * v * t.start.x + 3 * v * v * u * t.c1.x + 3 * v * u * u * t.c2.x + u * u * u * t.tip.x,
    y:
      v * v * v * t.start.y + 3 * v * v * u * t.c1.y + 3 * v * u * u * t.c2.y + u * u * u * t.tip.y,
  };
}

/** Signed distances of the spine from its own chord, sampled along its length. */
function offsets(t: DrawnTail): number[] {
  const dx = t.tip.x - t.start.x;
  const dy = t.tip.y - t.start.y;
  const len = Math.hypot(dx, dy);
  const out: number[] = [];
  for (let i = 1; i < 20; i++) {
    const p = spineAt(t, i / 20);
    out.push((dx * (p.y - t.start.y) - dy * (p.x - t.start.x)) / len);
  }
  return out;
}

function tailFor(mood: TailMood): DrawnTail {
  const b = buildDrawnBalloon(
    spec(["I'm fixing", "something."], { tip: { x: 430, y: 700 }, mood }),
  );
  if (!b.tail) throw new Error("expected a tail");
  return b.tail;
}

describe("drawn body", () => {
  test("one line sits in an oval, a block of text in a pillow", () => {
    for (const seed of [0, 0.25, 0.5, 0.75, 0.99]) {
      expect(drawnExponent(1, seed)).toBeLessThan(2.4);
      expect(drawnExponent(3, seed)).toBeGreaterThan(2.7);
    }
  });

  test("the body holds every line of text", () => {
    const lines = ["That ring", "is theirs. It has", "been theirs for", "two years."];
    const b = buildDrawnBalloon(spec(lines));
    const top = 300 - (lines.length * 60) / 2;
    lines.forEach((line, i) => {
      const half = measureWidth(line, 48, FONT) / 2;
      for (const x of [600 - half, 600 + half]) {
        for (const y of [top + i * 60, top + (i + 1) * 60]) {
          expect(inside({ x, y }, b.body)).toBe(true);
        }
      }
    });
  });

  test("the ink is heavier bottom-right than top-left, around the set weight", () => {
    const heavy = inkWeight({ x: 0.6, y: 0.8 }, 4.5);
    const light = inkWeight({ x: -0.6, y: -0.8 }, 4.5);
    expect(heavy).toBeGreaterThan(light * 2);
    expect((heavy + light) / 2).toBeCloseTo(4.5, 5);
  });

  test("the body's bounds hold its ink", () => {
    const b = buildDrawnBalloon(spec(["It's new."]));
    expect(b.body.length).toBeGreaterThan(100);
    for (const p of b.body) {
      expect(p.x).toBeGreaterThan(b.bounds.x);
      expect(p.x).toBeLessThan(b.bounds.x + b.bounds.width);
      expect(p.y).toBeGreaterThan(b.bounds.y);
      expect(p.y).toBeLessThan(b.bounds.y + b.bounds.height);
    }
  });
});

describe("drawn line breaks", () => {
  test("a short line stays on one line", () => {
    expect(drawnLines("It's new.", 48, FONT, 0.3)).toEqual(["It's new."]);
  });

  test("a longer line breaks with its longest line in the middle", () => {
    for (const text of [
      "You're always fixing something.",
      "That ring is theirs. It has been theirs for two years.",
    ]) {
      const lines = drawnLines(text, 48, FONT, drawnSeed("B01", text));
      expect(lines.length).toBeGreaterThanOrEqual(3);
      expect(lines.join(" ")).toBe(text);
      const widths = lines.map((l) => measureWidth(l, 48, FONT));
      const longest = widths.indexOf(Math.max(...widths));
      expect(longest).toBeGreaterThan(0);
      expect(longest).toBeLessThan(lines.length - 1);
    }
  });
});

describe("drawn tail", () => {
  test("the tail ends exactly on its tip", () => {
    const tip = { x: 430, y: 700 };
    const b = buildDrawnBalloon(spec(["It's new."], { tip }));
    expect(b.tail?.tip).toEqual(tip);
    expect(b.fill).toContain(`${tip.x.toFixed(2)} ${tip.y.toFixed(2)}`);
  });

  test("an urgent tail is the straightest and the widest", () => {
    const bow = (t: DrawnTail): number => Math.max(...offsets(t).map(Math.abs));
    const calm = tailFor("calm");
    const urgent = tailFor("urgent");
    expect(bow(urgent)).toBeLessThan(bow(calm));
    expect(urgent.throat).toBeGreaterThan(calm.throat);
  });

  test("a hesitant tail is the thinnest and wavers: its spine crosses its own chord", () => {
    const calm = tailFor("calm");
    const hesitant = tailFor("hesitant");
    expect(hesitant.throat).toBeLessThan(calm.throat);
    const sides = offsets(hesitant)
      .filter((d) => Math.abs(d) > 1)
      .map(Math.sign);
    expect(new Set(sides).size).toBe(2);
  });

  test("two balloons draw their tails a little differently", () => {
    const tip = { x: 430, y: 700 };
    const a = buildDrawnBalloon(spec(["I'm fixing", "something."], { tip, seed: 0.2 }));
    const b = buildDrawnBalloon(spec(["I'm fixing", "something."], { tip, seed: 0.7 }));
    expect(a.tail?.c1).not.toEqual(b.tail?.c1);
  });

  test("the same balloon always draws the same way", () => {
    const s = spec(["I'm fixing", "something."], { tip: { x: 430, y: 700 } });
    expect(buildDrawnBalloon(s)).toEqual(buildDrawnBalloon(s));
    expect(drawnSeed("B01", "It's new.")).toBe(drawnSeed("B01", "It's new."));
    expect(drawnSeed("B01", "It's new.")).not.toBe(drawnSeed("B02", "It's new."));
  });
});
