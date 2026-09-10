import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { create } from "fontkit";
import { fontVerticalMetrics } from "../src/font";

const fonts: ReadonlyArray<{ name: string; file: string; digest: string }> = [
  {
    name: "Noto Sans Regular",
    file: "assets/fonts/NotoSans-Regular.otf",
    digest: "bfb44de2c2031c391ff856943fe8f105ebb5d725cb9a04d493d211d5bbd5c21b",
  },
  {
    name: "Shantell Sans SemiBold",
    file: "assets/fonts/ShantellSans-SemiBold.otf",
    digest: "e3e56024242b3ba40da25854a8fe9080e9bde0ea20fddd0c807e2e246d659097",
  },
];

describe("bundled font assets", () => {
  for (const expected of fonts) {
    test(`${expected.name} keeps its bytes, glyph coverage, and shaping support`, () => {
      const bytes = readFileSync(join(import.meta.dir, "..", expected.file));
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(expected.digest);
      const font = create(bytes);
      if (!("layout" in font)) throw new Error(`${expected.name} must be a single font face`);
      for (const character of "AaЯя—?!") {
        const codePoint = character.codePointAt(0);
        if (codePoint === undefined) throw new Error("expected a code point");
        expect(font.hasGlyphForCodePoint(codePoint)).toBe(true);
      }
      expect(font.layout("Wait. Подождите.—").advanceWidth).toBeGreaterThan(0);
    });
  }

  test("configured font is vertically centred inside its line box", () => {
    const metrics = fontVerticalMetrics(72);
    const clearanceAbove = metrics.baselineOffset - metrics.ascent;
    const clearanceBelow = metrics.lineHeight - metrics.baselineOffset - metrics.descent;
    expect(Math.abs(clearanceAbove - clearanceBelow)).toBeLessThanOrEqual(0.02);
    expect(clearanceAbove).toBeGreaterThan(0);
  });
});
