import opentype from "opentype.js";
import type { Font } from "opentype.js";
import { loadFontBytes, PROFILE } from "./profile";
import { roundN } from "./normalize";

let cachedFont: Font | null = null;

export function getFont(): Font {
  if (cachedFont) return cachedFont;
  const bytes = loadFontBytes();
  // opentype.js accepts ArrayBuffer
  const ab = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  const font = opentype.parse(ab);
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
    const g = font.charToGlyph(ch);
    // .notdef has unicode undefined / name '.notdef' / index 0 typically
    if (!g || g.name === ".notdef" || (g.unicode === undefined && g.index === 0)) {
      // Space and common whitespace should exist; if not, still flag
      if (ch === " ") {
        // most fonts have space
        const sp = font.charToGlyph(" ");
        if (sp && sp.name !== ".notdef") continue;
      }
      missing.push(ch);
    }
  }
  return missing;
}

export function measureWidth(text: string, fontSize: number): number {
  const font = getFont();
  const w = font.getAdvanceWidth(text, fontSize);
  return roundN(w);
}

/**
 * Wrap text to maxWidth using simple whitespace breaks.
 * Preserves explicit newlines in the source string.
 * Returns null if a single unbreakable token exceeds maxWidth.
 */
export function wrapText(
  text: string,
  fontSize: number,
  maxWidth: number,
): string[] | null {
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
  return roundN(fontSize * PROFILE.shapes["speech"].lineHeightFactor);
}
