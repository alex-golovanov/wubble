import { create } from "fontkit";
import type { Font, FontCollection } from "fontkit";
import { loadFontBytes, PROFILE } from "./profile";
import { roundN } from "./normalize";

let cachedFont: Font | null = null;

function isFont(value: Font | FontCollection): value is Font {
  return "layout" in value;
}

export function getFont(): Font {
  if (cachedFont) return cachedFont;
  const bytes = loadFontBytes();
  const parsed = create(bytes);
  if (!isFont(parsed)) {
    throw new Error("The configured font asset is a collection; Wubble requires one font face.");
  }
  const font = parsed;
  cachedFont = font;
  return font;
}

/** Return missing codepoints (characters with no glyph / .notdef) */
export function missingGlyphs(text: string): string[] {
  const font = getFont();
  const missing: string[] = [];
  const seen = new Set<string>();
  for (const ch of text) {
    if (ch === "\n" || ch === "\r" || ch === "\t") continue;
    if (seen.has(ch)) continue;
    seen.add(ch);
    const codePoint = ch.codePointAt(0);
    if (codePoint !== undefined && !font.hasGlyphForCodePoint(codePoint)) missing.push(ch);
  }
  return missing;
}

export function measureWidth(text: string, fontSize: number): number {
  const font = getFont();
  const run = font.layout(text);
  const w = (run.advanceWidth / font.unitsPerEm) * fontSize;
  return roundN(w);
}

export interface FontVerticalMetrics {
  ascent: number;
  descent: number;
  lineHeight: number;
  baselineOffset: number;
}

/**
 * Resolve a centred SVG line box from the configured font's real vertical
 * metrics. The extra leading keeps adjacent ink and balloon edges separate.
 */
export function fontVerticalMetrics(fontSize: number): FontVerticalMetrics {
  const font = getFont();
  const scale = fontSize / font.unitsPerEm;
  const ascent = roundN(font.ascent * scale);
  const descent = roundN(Math.abs(font.descent) * scale);
  const metricHeight = ascent + descent;
  const profileHeight = fontSize * PROFILE.shapes.speech.lineHeightFactor;
  const lineHeight = roundN(Math.max(profileHeight, metricHeight + fontSize * 0.12));
  const baselineOffset = roundN((lineHeight - metricHeight) / 2 + ascent);
  return { ascent, descent, lineHeight, baselineOffset };
}

/**
 * Wrap text to maxWidth using simple whitespace breaks.
 * Preserves explicit newlines in the source string.
 * Returns null if a single unbreakable token exceeds maxWidth.
 */
export function wrapText(text: string, fontSize: number, maxWidth: number): string[] | null {
  const paragraphs = text.split(/\n/);
  const lines: string[] = [];
  for (const para of paragraphs) {
    const words = para.split(/\s+/).filter((w) => w.length > 0);
    if (words.length === 0) {
      lines.push("");
      continue;
    }
    let current = "";
    for (const word of words) {
      const candidate = current.length === 0 ? word : `${current} ${word}`;
      if (measureWidth(candidate, fontSize) <= maxWidth) {
        current = candidate;
      } else {
        if (current.length === 0) {
          // single word too wide
          if (measureWidth(word, fontSize) > maxWidth) return null;
          lines.push(word);
          current = "";
        } else {
          lines.push(current);
          if (measureWidth(word, fontSize) > maxWidth) return null;
          current = word;
        }
      }
    }
    if (current.length > 0) lines.push(current);
  }
  return lines;
}

export function lineHeightPx(fontSize: number): number {
  return fontVerticalMetrics(fontSize).lineHeight;
}
