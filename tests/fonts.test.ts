import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { create } from "fontkit";
import { fontVerticalMetrics, measureWidth, missingGlyphs } from "../src/font";
import { FONT_IDS, fontAsset, loadFontBytes } from "../src/profile";

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

  test("every registered face is vertically centred inside its line box", () => {
    for (const id of FONT_IDS) {
      const metrics = fontVerticalMetrics(72, id);
      const clearanceAbove = metrics.baselineOffset - metrics.ascent;
      const clearanceBelow = metrics.lineHeight - metrics.baselineOffset - metrics.descent;
      expect(Math.abs(clearanceAbove - clearanceBelow)).toBeLessThanOrEqual(0.02);
      expect(clearanceAbove).toBeGreaterThan(0);
    }
  });

  test("every registered face loads, matches its digest and covers both scripts", () => {
    for (const id of FONT_IDS) {
      const asset = fontAsset(id);
      const bytes = loadFontBytes(id);
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(asset.digestSha256);
      expect(missingGlyphs("Wait. Подождите. —?!", id)).toEqual([]);
      expect(measureWidth("Wait.", 48, id)).toBeGreaterThan(0);
    }
  });
});
