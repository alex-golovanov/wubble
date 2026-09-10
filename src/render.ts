import { validateSchema } from "./schema";
import { resolveAnchor, resolveBend, resolvePlacement, validatePage } from "./validate";
import {
  fitBalloonText,
  fitStyleOf,
  letterFontsFor,
  resolveLetteringPads,
  type LetterFonts,
} from "./layout";
import { buildShape } from "./shapes/index";
import { isRefShapeId, refLobeContentBand, contentBandBox } from "./shapes/ref-sheet";
import {
  fontAsset,
  fontBase64,
  fontMime,
  isShapeImplemented,
  resolveFontBinding,
  voiceOf,
  type FontId,
} from "./profile";
import { fmt, roundN } from "./normalize";
import { fontVerticalMetrics } from "./font";
import { hasErrors } from "./diagnostics";
import type {
  BalloonItem,
  Bounds,
  FittedText,
  PageManifest,
  RenderOptions,
  RenderResult,
} from "./types";

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Source-tag brackets, drawn as geometry rather than typed.
 * The canon tag is written ⟦LIKE THIS⟧ and almost no text face carries U+27E6,
 * so the marks are constructed and the font choice stays free.
 */
function sourceTagBrackets(
  midX: number,
  baseline: number,
  labelWidth: number,
  fontSize: number,
): string {
  const h = fontSize * 0.74;
  const bw = fontSize * 0.3;
  const gap = fontSize * 0.34;
  const inner = bw * 0.52;
  const top = baseline - h;
  const leftOuter = midX - labelWidth / 2 - gap - bw;
  const rightOuter = midX + labelWidth / 2 + gap + bw;
  const d = [
    `M ${fmt(leftOuter + bw)} ${fmt(top)}`,
    `L ${fmt(leftOuter)} ${fmt(top)}`,
    `L ${fmt(leftOuter)} ${fmt(baseline)}`,
    `L ${fmt(leftOuter + bw)} ${fmt(baseline)}`,
    `M ${fmt(leftOuter + inner)} ${fmt(top)}`,
    `L ${fmt(leftOuter + inner)} ${fmt(baseline)}`,
    `M ${fmt(rightOuter - bw)} ${fmt(top)}`,
    `L ${fmt(rightOuter)} ${fmt(top)}`,
    `L ${fmt(rightOuter)} ${fmt(baseline)}`,
    `L ${fmt(rightOuter - bw)} ${fmt(baseline)}`,
    `M ${fmt(rightOuter - inner)} ${fmt(top)}`,
    `L ${fmt(rightOuter - inner)} ${fmt(baseline)}`,
  ].join(" ");
  return `      <path data-part="source-tag-brackets" d="${d}" fill="none" stroke="currentColor" stroke-width="${fmt(roundN(fontSize * 0.09))}" stroke-linecap="square"/>`;
}

function textNodesFor(
  fitted: FittedText,
  body: Bounds,
  shapeId: BalloonItem["shapeId"],
  fill: string,
  fonts: LetterFonts,
  style?: import("./layout").FitStyle,
): string {
  const box = fitted.textBounds ?? body;
  // Ref shapes ignore style (bands already encode silhouette); rounded-rect uses it.
  const { padY } = resolveLetteringPads(shapeId, box.width, box.height, style);
  const fs = fitted.fontSize;
  const lh = fitted.lineHeight;
  const textBlockH = fitted.contentHeight;
  const blockTop = box.y + padY + (box.height - padY * 2 - textBlockH) / 2;
  const midX = box.x + box.width / 2;
  const nodes: string[] = [];
  let dialogueTop = blockTop;
  if (fitted.sourceLabel) {
    const label = fitted.sourceLabel;
    const labelBaseline = fontVerticalMetrics(label.fontSize, fonts.label).baselineOffset;
    const baseline = blockTop + labelBaseline;
    nodes.push(
      sourceTagBrackets(midX, baseline, label.contentWidth, label.fontSize),
      `      <text data-part="source-label" x="${fmt(midX)}" y="${fmt(baseline)}" text-anchor="middle" font-family="${escapeXml(fontAsset(fonts.label).family)}" font-size="${fmt(label.fontSize)}">${escapeXml(label.text)}</text>`,
    );
    dialogueTop += label.lineHeight + label.gapAfter;
  }
  const lines = fitted.lines
    .map((line, i) => {
      const y = dialogueTop + i * lh + fontVerticalMetrics(fs, fonts.text).baselineOffset;
      return `      <text x="${fmt(midX)}" y="${fmt(y)}" text-anchor="middle" font-family="${escapeXml(fontAsset(fonts.text).family)}" font-size="${fmt(fs)}">${escapeXml(line)}</text>`;
    })
    .join("\n");
  nodes.push(lines);
  return `    <g data-part="text" fill="${fill}" color="${fill}">\n${nodes.join("\n")}\n    </g>`;
}

function renderBalloonGroup(
  manifest: PageManifest,
  item: BalloonItem,
  locale: string,
  fonts: LetterFonts,
): string | null {
  if (!isShapeImplemented(item.shapeId)) return null;
  const content = item.content[locale];
  if (!content) return null;

  const placement = resolvePlacement(item, locale);
  const fitStyle = fitStyleOf(item);
  const layout = fitBalloonText(content, placement, item.id, item.shapeId, fitStyle, fonts);
  if (!layout.fitted) return null;

  const body = layout.fitted.bodyBounds;
  const lobeFits: { body: Bounds; fitted: FittedText }[] = [];
  if (item.lobes) {
    for (let i = 0; i < item.lobes.length; i++) {
      const lobe = item.lobes[i];
      if (lobe === undefined) continue;
      const lobeContent = lobe.content[locale];
      if (!lobeContent) continue;

      // Ref chain: each lobe lettering box tracks its own content band on the fitted frame.
      let lobePlacement = lobe.placement;
      if (isRefShapeId(item.shapeId)) {
        const lobeBand = refLobeContentBand(item.shapeId, i);
        if (lobeBand) {
          lobePlacement = contentBandBox(body, lobeBand, item.shapeId);
        }
      }

      const lf = fitBalloonText(
        lobeContent,
        lobePlacement,
        `${item.id}#lobe${i}`,
        item.shapeId,
        fitStyle,
        fonts,
      );
      if (!lf.fitted) continue;
      // Keep lettering inside the derived box; do not let lobe expand rewrite geometry.
      const fitted: FittedText = {
        ...lf.fitted,
        bodyBounds: lobePlacement,
        textBounds: lobePlacement,
      };
      lobeFits.push({ body: lobePlacement, fitted });
    }
  }

  const { tip } = resolveAnchor(manifest, item);
  const bend = resolveBend(item, locale) ?? null;
  const attachment = item.tail?.attachment ?? "auto";

  // Ref silhouettes map to the primary (full) frame; lobeBodies are lettering-only.
  const geom = buildShape({
    shapeId: item.shapeId,
    body,
    lobeBodies: isRefShapeId(item.shapeId) ? [] : lobeFits.map((l) => l.body),
    tip,
    bend,
    attachment,
    ...fitStyleOf(item),
    ...(item.notchTop !== undefined ? { notchTop: item.notchTop } : {}),
    ...(item.fill !== undefined ? { fill: item.fill } : {}),
    ...(item.stroke !== undefined ? { stroke: item.stroke } : {}),
    ...(item.strokeWidth !== undefined ? { strokeWidth: item.strokeWidth } : {}),
  });

  const parts: string[] = [];
  parts.push(
    `  <g id="${escapeXml(item.id)}" data-shape="${item.shapeId}" data-voice="${voiceOf(item)}">`,
  );
  parts.push(
    `    <path data-part="balloon" d="${geom.path}" fill="${geom.fill}" stroke="${geom.stroke}" stroke-width="${fmt(geom.strokeWidth)}" stroke-linejoin="round" stroke-linecap="round"/>`,
  );
  parts.push(textNodesFor(layout.fitted, body, item.shapeId, geom.stroke, fonts, fitStyle));
  for (const lobe of lobeFits) {
    parts.push(textNodesFor(lobe.fitted, lobe.body, item.shapeId, geom.stroke, fonts, fitStyle));
  }
  parts.push(`  </g>`);
  return parts.join("\n");
}

function fontFaceRule(id: FontId): string[] {
  const asset = fontAsset(id);
  const format = asset.format === "opentype" ? "opentype" : "truetype";
  return [
    `      @font-face {`,
    `        font-family: "${escapeXml(asset.family)}";`,
    `        font-style: normal;`,
    `        font-weight: 400;`,
    `        src: url("data:${fontMime(id)};base64,${fontBase64(id)}") format("${format}");`,
    `      }`,
  ];
}

function serializeSvg(manifest: PageManifest, locale: string, options: RenderOptions): string {
  const w = manifest.coordinateSpace.width;
  const h = manifest.coordinateSpace.height;
  const binding = resolveFontBinding(options.fonts);

  const groups: string[] = [];
  const usedFonts: FontId[] = [];
  const useFont = (id: FontId): void => {
    if (!usedFonts.includes(id)) usedFonts.push(id);
  };
  for (const item of manifest.items) {
    if (item.kind !== "balloon") continue;
    const content = item.content[locale];
    if (!content) continue;
    if (!isShapeImplemented(item.shapeId)) continue;
    const fonts = letterFontsFor(voiceOf(item), binding);
    const g = renderBalloonGroup(manifest, item, locale, fonts);
    if (!g) continue;
    groups.push(g);
    useFont(fonts.text);
    if (content.sourceLabel !== undefined) useFont(fonts.label);
    for (const lobe of item.lobes ?? []) {
      if (lobe.content[locale]) useFont(fonts.text);
    }
  }

  const lines = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">`,
    `  <defs>`,
    `    <style type="text/css">`,
    ...usedFonts.flatMap(fontFaceRule),
    `    </style>`,
    `  </defs>`,
    ...groups,
    `</svg>`,
    ``,
  ];
  return lines.join("\n");
}

export function renderPage(manifestInput: unknown, options: RenderOptions): RenderResult {
  const report = validatePage(manifestInput, options);
  if (hasErrors(report)) {
    return { svg: null, diagnostics: report };
  }

  const schema = validateSchema(manifestInput);
  if (!schema.manifest) {
    return { svg: null, diagnostics: report };
  }

  const svg = serializeSvg(schema.manifest, options.locale, options);
  return { svg, diagnostics: report };
}

/** Intentionally no API accepting raw SVG / styles from manifests */
export const MANIFEST_SVG_FORBIDDEN = true;
