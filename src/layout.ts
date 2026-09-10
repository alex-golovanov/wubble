import { missingGlyphs, measureWidth, wrapText, lineHeightPx } from "./font";
import { roundN } from "./normalize";
import {
  defaultFontBinding,
  labelFontIdFor,
  PROFILE,
  shapeProfile,
  textFontIdFor,
  type FontBinding,
  type FontId,
} from "./profile";
import {
  isRefShapeId,
  refContentBand,
  contentBandBox,
  type ContentBand,
  type RefShapeId,
} from "./shapes/ref-sheet";
import {
  contentInsetsForRoundedBody,
  defaultCornerRadius,
  defaultEdge,
} from "./shapes/rounded-rect";
import type {
  Bounds,
  Diagnostic,
  EdgeStyle,
  FittedText,
  LocaleContent,
  ShapeId,
  Voice,
} from "./types";
import { diag } from "./diagnostics";

export interface LayoutResult {
  fitted: FittedText | null;
  diagnostics: Diagnostic[];
}

/** The two faces one balloon letters with, plus the label casing rule. */
export interface LetterFonts {
  text: FontId;
  label: FontId;
  labelUppercase: boolean;
}

export function letterFontsFor(voice: Voice, binding: FontBinding): LetterFonts {
  return {
    text: textFontIdFor(binding, voice),
    label: labelFontIdFor(binding),
    labelUppercase: PROFILE.typography.roles.machineLabel.uppercase,
  };
}

export function defaultLetterFonts(): LetterFonts {
  return letterFontsFor("human", defaultFontBinding());
}

/** Source label exactly as it will be measured and drawn. */
export function resolveLabelText(
  sourceLabel: string | undefined,
  fonts: LetterFonts,
): string | undefined {
  if (sourceLabel === undefined) return undefined;
  return fonts.labelUppercase ? sourceLabel.toUpperCase() : sourceLabel;
}

function contentString(content: LocaleContent): string {
  if (content.lines) return content.lines.join("\n");
  return content.text ?? "";
}

type TextMetrics = Pick<FittedText, "contentWidth" | "contentHeight" | "sourceLabel">;

function measureContent(
  lines: string[],
  fontSize: number,
  lineHeight: number,
  sourceLabel: string | undefined,
  fonts: LetterFonts,
): TextMetrics {
  const dialogueWidth = roundN(
    Math.max(...lines.map((line) => measureWidth(line, fontSize, fonts.text)), 0),
  );
  const dialogueHeight = roundN(lines.length * lineHeight);
  if (!sourceLabel) {
    return { contentWidth: dialogueWidth, contentHeight: dialogueHeight };
  }

  const typography = PROFILE.typography;
  const labelFontSize = roundN(
    Math.min(
      typography.sourceLabelMaxFontSize,
      Math.max(typography.sourceLabelMinFontSize, fontSize * typography.sourceLabelScale),
    ),
  );
  const labelLineHeight = lineHeightPx(labelFontSize, fonts.label);
  const labelWidth = measureWidth(sourceLabel, labelFontSize, fonts.label);
  const gapAfter = roundN(labelFontSize * typography.sourceLabelGapFactor);
  return {
    contentWidth: roundN(Math.max(dialogueWidth, labelWidth)),
    contentHeight: roundN(labelLineHeight + gapAfter + dialogueHeight),
    sourceLabel: {
      text: sourceLabel,
      fontSize: labelFontSize,
      lineHeight: labelLineHeight,
      contentWidth: labelWidth,
      gapAfter,
    },
  };
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

/**
 * Silhouette defaults come from the voice, so a manifest states who is talking
 * and gets the right balloon. Explicit knobs still win.
 *
 * human     — nearly-round body, hand-drawn outline.
 * machine   — hard square box; a played-back clip, not a voice. The torn
 *              outline is reserved for a clip that is failing.
 * narration — a plain caption box.
 */
export function voiceStyle(voice: Voice): { cornerRadius: number; edge: EdgeStyle } {
  if (voice === "machine") return { cornerRadius: 0, edge: "smooth" };
  if (voice === "narration") return { cornerRadius: 0.06, edge: "smooth" };
  return { cornerRadius: 0.9, edge: "hand" };
}

export function fitStyleOf(item: {
  cornerRadius?: number;
  edge?: EdgeStyle;
  voice?: Voice;
}): FitStyle {
  const base = voiceStyle(item.voice ?? "human");
  return {
    cornerRadius: item.cornerRadius ?? base.cornerRadius,
    edge: item.edge ?? base.edge,
  };
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
  shapeId: RefShapeId,
  band: ContentBand,
  maxExpand: number,
): number | null {
  const shape = shapeProfile(shapeId);
  const usable = shape.usableWidthFactor ?? 1;
  const fitsAt = (expand: number): boolean => {
    const body: Bounds = {
      x: placement.x,
      y: placement.y,
      width: placement.width * expand,
      height: placement.height * expand,
    };
    const textBand = contentBandBox(body, band, shapeId);
    const { padX, padY } = resolveShapePadding(shapeId, textBand.width, textBand.height);
    const maxTextW = (textBand.width - padX * 2) * usable;
    const maxTextH = textBand.height - padY * 2;
    return maxTextW > 0 && maxTextH > 0 && contentW <= maxTextW && contentH <= maxTextH;
  };

  if (fitsAt(1)) return 1;
  if (!fitsAt(maxExpand)) return null;
  let low = 1;
  let high = maxExpand;
  for (let i = 0; i < 24; i++) {
    const mid = (low + high) / 2;
    if (fitsAt(mid)) high = mid;
    else low = mid;
  }
  return roundN(Math.min(maxExpand, high * 1.01));
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
  fonts: LetterFonts = defaultLetterFonts(),
): LayoutResult {
  const shape = shapeProfile(shapeId);
  const diagnostics: Diagnostic[] = [];
  const raw = contentString(content);
  const labelText = resolveLabelText(content.sourceLabel, fonts);

  const missing = [
    ...missingGlyphs(raw.replace(/\n/g, ""), fonts.text),
    ...(labelText === undefined ? [] : missingGlyphs(labelText, fonts.label)),
  ];
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
  const refShapeId = isRefShapeId(shapeId) ? shapeId : null;
  const band = refShapeId && !itemId.includes("#lobe") ? refContentBand(refShapeId) : null;

  for (const fontSize of fontSizes) {
    if (useRatio && band && refShapeId) {
      const probeE = Math.min(1.4, shape.maxExpandFactor);
      const probeBody: Bounds = {
        x: placement.x,
        y: placement.y,
        width: placement.width * probeE,
        height: placement.height * probeE,
      };
      const probeBand = contentBandBox(probeBody, band, refShapeId);
      const probePad = resolveShapePadding(shapeId, probeBand.width, probeBand.height);
      const usable = shape.usableWidthFactor ?? 1;
      const probeMaxW = Math.max(8, (probeBand.width - probePad.padX * 2) * usable);

      let lines: string[] | null;
      if (authoredLines) {
        lines = authoredLines;
      } else {
        lines = wrapText(raw, fontSize, probeMaxW, fonts.text);
      }
      if (!lines) continue;
      if (lines.length > shape.maxLines) continue;

      const lh = lineHeightPx(fontSize, fonts.text);
      const metrics = measureContent(lines, fontSize, lh, labelText, fonts);
      const { contentWidth, contentHeight } = metrics;

      const e = minExpandForBand(
        placement,
        contentWidth,
        contentHeight,
        refShapeId,
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
      const textBand = contentBandBox(body, band, refShapeId);
      const { padX, padY } = resolveShapePadding(shapeId, textBand.width, textBand.height);
      const maxTextW = (textBand.width - padX * 2) * usable;
      const maxTextH = textBand.height - padY * 2;
      if (contentWidth > maxTextW + 0.5 || contentHeight > maxTextH + 0.5) continue;

      if (authoredLines) {
        let ok = true;
        for (const line of authoredLines) {
          if (measureWidth(line, fontSize, fonts.text) > maxTextW + 0.5) {
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
          ...(metrics.sourceLabel ? { sourceLabel: metrics.sourceLabel } : {}),
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
            if (measureWidth(line, fontSize, fonts.text) > maxTextW) {
              lines = null;
              break;
            }
          }
        } else {
          lines = wrapText(raw, fontSize, maxTextW, fonts.text);
        }
        if (lines && lines.length <= shape.maxLines) {
          const lh = lineHeightPx(fontSize, fonts.text);
          const metrics = measureContent(lines, fontSize, lh, labelText, fonts);
          const { contentWidth, contentHeight } = metrics;
          if (contentHeight <= maxTextH) {
            return {
              fitted: {
                lines,
                fontSize,
                lineHeight: lh,
                contentWidth,
                contentHeight,
                ...(metrics.sourceLabel ? { sourceLabel: metrics.sourceLabel } : {}),
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
          if (measureWidth(line, fontSize, fonts.text) > maxTextW) {
            lines = null;
            break;
          }
        }
      } else {
        lines = wrapText(raw, fontSize, maxTextW, fonts.text);
      }
      if (!lines) continue;
      if (lines.length > shape.maxLines) continue;

      const lh = lineHeightPx(fontSize, fonts.text);
      const metrics = measureContent(lines, fontSize, lh, labelText, fonts);
      const { contentWidth, contentHeight } = metrics;
      if (contentHeight > maxTextH) continue;

      return {
        fitted: {
          lines,
          fontSize,
          lineHeight: lh,
          contentWidth,
          contentHeight,
          ...(metrics.sourceLabel ? { sourceLabel: metrics.sourceLabel } : {}),
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
