import { create } from "fontkit";
import type { Font, FontCollection } from "fontkit";
import { loadFontBytes, PROFILE, type FontId } from "./profile";
import { roundN } from "./normalize";

const fontCache = new Map<FontId, Font>();

function isFont(value: Font | FontCollection): value is Font {
  return "layout" in value;
}

export function getFont(id: FontId): Font {
  const cached = fontCache.get(id);
  if (cached) return cached;
  const parsed = create(loadFontBytes(id));
  if (!isFont(parsed)) {
    throw new Error(`Font asset ${id} is a collection; Wubble requires one font face.`);
  }
  fontCache.set(id, parsed);
  return parsed;
}

export function missingGlyphs(text: string, id: FontId): string[] {
  const font = getFont(id);
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

export function measureWidth(text: string, fontSize: number, id: FontId): number {
  const font = getFont(id);
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
export function fontVerticalMetrics(fontSize: number, id: FontId): FontVerticalMetrics {
  const font = getFont(id);
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
 */
export function wrapText(
  text: string,
  fontSize: number,
  maxWidth: number,
  id: FontId,
): string[] | null {
  const paragraphs = text.split(/\n/);
  const out: string[] = [];
  for (const para of paragraphs) {
    const words = para.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      out.push("");
      continue;
    }
    let line = "";
    for (const w of words) {
      const candidate = line ? `${line} ${w}` : w;
      if (measureWidth(candidate, fontSize, id) <= maxWidth) {
        line = candidate;
      } else {
        if (line) out.push(line);
        if (measureWidth(w, fontSize, id) > maxWidth) return null;
        line = w;
      }
    }
    if (line) out.push(line);
  }
  return out;
}

export function lineHeightPx(fontSize: number, id: FontId): number {
  return fontVerticalMetrics(fontSize, id).lineHeight;
}
