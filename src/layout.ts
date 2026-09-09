import { missingGlyphs, measureWidth, wrapText, lineHeightPx } from "./font";
import { roundN } from "./normalize";
import { shapeProfile } from "./profile";
import { isRefShapeId, refContentBand, contentBandBox, type ContentBand } from "./shapes/ref-sheet";
import {
  contentInsetsForRoundedBody,
  defaultCornerRadius,
  defaultEdge,
} from "./shapes/rounded-rect";
import type { Bounds, Diagnostic, EdgeStyle, FittedText, LocaleContent, ShapeId } from "./types";
import { diag } from "./diagnostics";

export interface LayoutResult {
  fitted: FittedText | null;
  diagnostics: Diagnostic[];
}

function contentString(content: LocaleContent): string {
  if (content.lines) return content.lines.join("\n");
  return content.text ?? "";
}

/**
 * Resolve horizontal/vertical padding for a reference size (usually the text band).
 * Ref shapes use paddingRatio × min(w,h) so inset scales as the balloon grows.
 */
export function resolveShapePadding(
  shapeId: ShapeId,
  boxW: number,
  boxH: number,
): { padX: number; padY: number } {
  const shape = shapeProfile(shapeId);
  const minD = Math.min(boxW, boxH);
  const ratio = shape.paddingRatio ?? 0;
  const strokeGuard = shape.strokeWidth * 1.5;
  const padX = roundN(Math.max(shape.paddingX, ratio * minD, strokeGuard));
  const padY = roundN(Math.max(shape.paddingY, ratio * minD, strokeGuard));
  return { padX, padY };
}

export interface FitStyle {
  cornerRadius?: number;
  edge?: EdgeStyle;
}

function resolveFitStyle(
  shapeId: ShapeId,
  style?: FitStyle,
): { cornerRadius: number; edge: EdgeStyle } {
  return {
    cornerRadius:
      style?.cornerRadius != null
        ? Math.max(0, Math.min(1, style.cornerRadius))
        : defaultCornerRadius(shapeId),
    edge: style?.edge ?? defaultEdge(shapeId),
  };
}

/**
 * Absolute pads plus silhouette insets (rounded corners / jagged teeth).
 * Ref band path keeps ratio pads only; legacy rounded-rect family uses this.
 */
export function resolveLetteringPads(
  shapeId: ShapeId,
  boxW: number,
  boxH: number,
  style?: FitStyle,
): { padX: number; padY: number } {
  const base = resolveShapePadding(shapeId, boxW, boxH);
  // Ref templates already bake silhouette into content bands / usableWidthFactor.
  if (isRefShapeId(shapeId)) return base;
  const { cornerRadius, edge } = resolveFitStyle(shapeId, style);
  return contentInsetsForRoundedBody(boxW, boxH, base.padX, base.padY, cornerRadius, edge);
}

/**
 * Minimum uniform expand so placement*e has a content band that fits text + pads.
 */
function minExpandForBand(
  placement: Bounds,
  contentW: number,
  contentH: number,
  shapeId: ShapeId,
  band: ContentBand,
  maxExpand: number,
): number | null {
  const shape = shapeProfile(shapeId);
  const pw = placement.width;
  const ph = placement.height;
  const bandFracH = band.bottom - band.top;
  const bandFracW = (band.right ?? 1) - (band.left ?? 0);
  if (bandFracH <= 0.05 || bandFracW <= 0.05) return null;
  const usable = shape.usableWidthFactor ?? 1;
  // Demand a wider band so text uses only `usable` of the padded column.
  contentW = contentW / Math.max(0.5, usable);

  const floorX = Math.max(shape.paddingX, shape.strokeWidth * 1.5);
  const floorY = Math.max(shape.paddingY, shape.strokeWidth * 1.5);
  const ratio = shape.paddingRatio ?? 0;

  // bandW = pw*e*bandFracW, bandH = ph*e*bandFracH
  let e = 1;
  e = Math.max(
    e,
    (contentW + 2 * floorX) / (pw * bandFracW),
    (contentH + 2 * floorY) / (ph * bandFracH),
  );

  if (ratio > 0) {
    // pad ≈ ratio * min(bandW, bandH) = ratio * e * min(pw*bandFracW, ph*bandFracH)
    const m = Math.min(pw * bandFracW, ph * bandFracH);
    const denomW = pw * bandFracW - 2 * ratio * m;
    const denomH = ph * bandFracH - 2 * ratio * m;
    if (denomW <= 1 || denomH <= 1) return null;
    e = Math.max(e, contentW / denomW, contentH / denomH);
  }

  for (let i = 0; i < 8; i++) {
    const bodyW = pw * e;
    const bodyH = ph * e;
    const bandW = bodyW * bandFracW;
    const bandH = bodyH * bandFracH;
    const { padX, padY } = resolveShapePadding(shapeId, bandW, bandH);
    const needE = Math.max(
      (contentW + 2 * padX) / (pw * bandFracW),
      (contentH + 2 * padY) / (ph * bandFracH),
      1,
    );
    if (needE <= e + 1e-6) break;
    e = needE;
  }

  if (e > maxExpand + 1e-6) return null;
  // Small slack so pad/rounding does not razor-edge the post-fit width check.
  const withSlack = e * 1.02;
  if (withSlack > maxExpand + 1e-6) return roundN(maxExpand);
  return roundN(Math.min(Math.max(withSlack, 1), maxExpand));
}

/**
 * Fit text into placement: expand balloon to accommodate text + padding,
 * then reduce type size only when expand limits are exhausted.
 * Authored `lines` are preserved (no re-wrap) but still measured.
 */
export function fitBalloonText(
  content: LocaleContent,
  placement: Bounds,
  itemId: string,
  shapeId: ShapeId = "speech",
  style?: FitStyle,
): LayoutResult {
  const shape = shapeProfile(shapeId);
  const diagnostics: Diagnostic[] = [];
  const raw = contentString(content);

  const missing = missingGlyphs(raw.replace(/\n/g, ""));
  if (missing.length > 0) {
    diagnostics.push(
      diag("GLYPH_MISSING", `Missing glyphs: ${missing.map((c) => JSON.stringify(c)).join(", ")}`, {
        itemId,
      }),
    );
    return { fitted: null, diagnostics };
  }

  const authoredLines = content.lines ? [...content.lines] : null;

  const fontSizes: number[] = [];
  for (let s = shape.maxFontSize; s >= shape.minFontSize; s -= 2) {
    fontSizes.push(s);
  }
  if (!fontSizes.includes(shape.minFontSize)) fontSizes.push(shape.minFontSize);

  const useRatio = (shape.paddingRatio ?? 0) > 0;
  // Lobe sub-fits already receive the lettering box; do not re-apply template bands.
  const band = isRefShapeId(shapeId) && !itemId.includes("#lobe") ? refContentBand(shapeId) : null;

  for (const fontSize of fontSizes) {
    if (useRatio && band) {
      const bandFracH = band.bottom - band.top;
      const bandFracW = (band.right ?? 1) - (band.left ?? 0);
      const probeE = Math.min(1.4, shape.maxExpandFactor);
      const probeBandH = placement.height * probeE * bandFracH;
      const probeBandW = placement.width * probeE * bandFracW;
      const probePad = resolveShapePadding(shapeId, probeBandW, probeBandH);
      const usable = shape.usableWidthFactor ?? 1;
      const probeMaxW = Math.max(8, (probeBandW - probePad.padX * 2) * usable);

      let lines: string[] | null;
      if (authoredLines) {
        lines = authoredLines;
      } else {
        lines = wrapText(raw, fontSize, probeMaxW);
      }
      if (!lines) continue;
      if (lines.length > shape.maxLines) continue;

      const lh = lineHeightPx(fontSize);
      const contentHeight = roundN(lines.length * lh);
      const contentWidth = roundN(Math.max(...lines.map((l) => measureWidth(l, fontSize)), 0));

      const e = minExpandForBand(
        placement,
        contentWidth,
        contentHeight,
        shapeId,
        band,
        shape.maxExpandFactor,
      );
      if (e == null) continue;

      const bodyW = roundN(placement.width * e);
      const bodyH = roundN(placement.height * e);
      const body: Bounds = {
        x: placement.x,
        y: placement.y,
        width: bodyW,
        height: bodyH,
      };
      const textBand = contentBandBox(body, band);
      const { padX, padY } = resolveShapePadding(shapeId, textBand.width, textBand.height);
      const maxTextW = (textBand.width - padX * 2) * usable;
      const maxTextH = textBand.height - padY * 2;
      if (contentWidth > maxTextW + 0.5 || contentHeight > maxTextH + 0.5) continue;

      if (authoredLines) {
        let ok = true;
        for (const line of authoredLines) {
          if (measureWidth(line, fontSize) > maxTextW + 0.5) {
            ok = false;
            break;
          }
        }
        if (!ok) continue;
      }

      return {
        fitted: {
          lines,
          fontSize,
          lineHeight: lh,
          contentWidth,
          contentHeight,
          bodyBounds: body,
          textBounds: textBand,
        },
        diagnostics,
      };
    }

    if (useRatio && !band) {
      // Fixed lettering box (e.g. ref lobe band): shrink type only, do not expand.
      const bodyW = roundN(placement.width);
      const bodyH = roundN(placement.height);
      const { padX, padY } = resolveShapePadding(shapeId, bodyW, bodyH);
      const usable = shape.usableWidthFactor ?? 1;
      const maxTextW = (bodyW - padX * 2) * usable;
      const maxTextH = bodyH - padY * 2;
      if (maxTextW > 0 && maxTextH > 0) {
        let lines: string[] | null;
        if (authoredLines) {
          lines = authoredLines;
          for (const line of lines) {
            if (measureWidth(line, fontSize) > maxTextW) {
              lines = null;
              break;
            }
          }
        } else {
          lines = wrapText(raw, fontSize, maxTextW);
        }
        if (lines && lines.length <= shape.maxLines) {
          const lh = lineHeightPx(fontSize);
          const contentHeight = roundN(lines.length * lh);
          if (contentHeight <= maxTextH) {
            const contentWidth = roundN(
              Math.max(...lines.map((l) => measureWidth(l, fontSize)), 0),
            );
            return {
              fitted: {
                lines,
                fontSize,
                lineHeight: lh,
                contentWidth,
                contentHeight,
                bodyBounds: {
                  x: placement.x,
                  y: placement.y,
                  width: bodyW,
                  height: bodyH,
                },
                textBounds: {
                  x: placement.x,
                  y: placement.y,
                  width: bodyW,
                  height: bodyH,
                },
              },
              diagnostics,
            };
          }
        }
      }
      continue;
    }

    // --- Legacy absolute-pad path (speech family): expand steps then shrink type ---
    // Usable lettering box shrinks with cornerRadius / jagged (same pad policy).
    const expandSteps = [1, 1.1, 1.2, 1.3, shape.maxExpandFactor];
    for (const expand of expandSteps) {
      const bodyW = roundN(placement.width * expand);
      const bodyH = roundN(placement.height * expand);
      const body: Bounds = {
        x: placement.x,
        y: placement.y,
        width: bodyW,
        height: bodyH,
      };
      const { padX, padY } = resolveLetteringPads(shapeId, bodyW, bodyH, style);
      const maxTextW = bodyW - padX * 2;
      const maxTextH = bodyH - padY * 2;
      if (maxTextW <= 0 || maxTextH <= 0) continue;

      let lines: string[] | null;
      if (authoredLines) {
        lines = authoredLines;
        for (const line of lines) {
          if (measureWidth(line, fontSize) > maxTextW) {
            lines = null;
            break;
          }
        }
      } else {
        lines = wrapText(raw, fontSize, maxTextW);
      }
      if (!lines) continue;
      if (lines.length > shape.maxLines) continue;

      const lh = lineHeightPx(fontSize);
      const contentHeight = roundN(lines.length * lh);
      if (contentHeight > maxTextH) continue;

      const contentWidth = roundN(Math.max(...lines.map((l) => measureWidth(l, fontSize)), 0));

      return {
        fitted: {
          lines,
          fontSize,
          lineHeight: lh,
          contentWidth,
          contentHeight,
          bodyBounds: body,
        },
        diagnostics,
      };
    }
  }

  diagnostics.push(
    diag(
      "TEXT_OVERFLOW",
      `Text cannot fit within max ${shape.maxLines} lines and min font size ${shape.minFontSize}.`,
      {
        itemId,
        suggestions: [
          {
            field: `localeOverrides.*.placement.width`,
            minimum: roundN(placement.width * shape.maxExpandFactor * 1.2),
          },
        ],
      },
    ),
  );
  return { fitted: null, diagnostics };
}
