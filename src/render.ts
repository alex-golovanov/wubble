import { validateSchema } from "./schema";
import {
  resolveAnchor,
  resolveBend,
  resolvePlacement,
  validatePage,
} from "./validate";
import { fitBalloonText, resolveLetteringPads } from "./layout";
import { buildShape } from "./shapes/index";
import {
  isRefShapeId,
  refLobeContentBand,
  contentBandBox,
} from "./shapes/ref-sheet";
import { fontBase64, isShapeImplemented } from "./profile";
import { fmt } from "./normalize";
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

function textNodesFor(
  fitted: FittedText,
  body: Bounds,
  shapeId: BalloonItem["shapeId"],
  fill: string,
  style?: { cornerRadius?: number; edge?: BalloonItem["edge"] },
): string {
  const box = fitted.textBounds ?? body;
  // Ref shapes ignore style (bands already encode silhouette); rounded-rect uses it.
  const { padY } = resolveLetteringPads(shapeId, box.width, box.height, style);
  const fs = fitted.fontSize;
  const lh = fitted.lineHeight;
  const textBlockH = fitted.contentHeight;
  const startY =
    box.y + padY + (box.height - padY * 2 - textBlockH) / 2 + fs * 0.8;
  const midX = box.x + box.width / 2;
  const lines = fitted.lines
    .map((line, i) => {
      const y = startY + i * lh;
      return `      <text x="${fmt(midX)}" y="${fmt(y)}" text-anchor="middle" font-family="Noto Sans" font-size="${fmt(fs)}">${escapeXml(line)}</text>`;
    })
    .join("\n");
  return `    <g data-part="text" fill="${fill}">\n${lines}\n    </g>`;
}

function renderBalloonGroup(
  manifest: PageManifest,
  item: BalloonItem,
  locale: string,
): string | null {
  if (!isShapeImplemented(item.shapeId)) return null;
  const content = item.content[locale];
  if (!content) return null;

  const placement = resolvePlacement(item, locale);
  const fitStyle = { cornerRadius: item.cornerRadius, edge: item.edge };
  const layout = fitBalloonText(
    content,
    placement,
    item.id,
    item.shapeId,
    fitStyle,
  );
  if (!layout.fitted) return null;

  const body = layout.fitted.bodyBounds;
  const lobeFits: { body: Bounds; fitted: FittedText }[] = [];
  if (item.lobes) {
    for (let i = 0; i < item.lobes.length; i++) {
      const lobe = item.lobes[i]!;
      const lobeContent = lobe.content[locale];
      if (!lobeContent) continue;

      // Ref chain: each lobe lettering box tracks its own content band on the fitted frame.
      let lobePlacement = lobe.placement;
      if (isRefShapeId(item.shapeId)) {
        const lobeBand = refLobeContentBand(item.shapeId, i);
        if (lobeBand) {
          lobePlacement = contentBandBox(body, lobeBand);
        }
      }

      const lf = fitBalloonText(
        lobeContent,
        lobePlacement,
        `${item.id}#lobe${i}`,
        item.shapeId,
        fitStyle,
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
    cornerRadius: item.cornerRadius,
    edge: item.edge,
    notchTop: item.notchTop,
    fill: item.fill,
    stroke: item.stroke,
    strokeWidth: item.strokeWidth,
  });

  const parts: string[] = [];
  parts.push(`  <g id="${escapeXml(item.id)}" data-shape="${item.shapeId}">`);
  parts.push(
    `    <path data-part="balloon" d="${geom.path}" fill="${geom.fill}" stroke="${geom.stroke}" stroke-width="${fmt(geom.strokeWidth)}" stroke-linejoin="round" stroke-linecap="round"/>`,
  );
  parts.push(textNodesFor(layout.fitted, body, item.shapeId, geom.stroke, fitStyle));
  for (const lobe of lobeFits) {
    parts.push(textNodesFor(lobe.fitted, lobe.body, item.shapeId, geom.stroke, fitStyle));
  }
  parts.push(`  </g>`);
  return parts.join("\n");
}

function serializeSvg(manifest: PageManifest, locale: string): string {
  const w = manifest.coordinateSpace.width;
  const h = manifest.coordinateSpace.height;
  const b64 = fontBase64();

  const groups: string[] = [];
  for (const item of manifest.items) {
    if (item.kind !== "balloon") continue;
    if (!item.content[locale]) continue;
    if (!isShapeImplemented(item.shapeId)) continue;
    const g = renderBalloonGroup(manifest, item, locale);
    if (g) groups.push(g);
  }

  const lines = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">`,
    `  <defs>`,
    `    <style type="text/css">`,
    `      @font-face {`,
    `        font-family: "Noto Sans";`,
    `        font-style: normal;`,
    `        font-weight: 400;`,
    `        src: url("data:font/otf;base64,${b64}") format("opentype");`,
    `      }`,
    `    </style>`,
    `  </defs>`,
    ...groups,
    `</svg>`,
    ``,
  ];
  return lines.join("\n");
}

export function renderPage(
  manifestInput: unknown,
  options: RenderOptions,
): RenderResult {
  const report = validatePage(manifestInput, options);
  if (hasErrors(report)) {
    return { svg: null, diagnostics: report };
  }

  const schema = validateSchema(manifestInput);
  if (!schema.manifest) {
    return { svg: null, diagnostics: report };
  }

  const svg = serializeSvg(schema.manifest, options.locale);
  return { svg, diagnostics: report };
}

/** Intentionally no API accepting raw SVG / styles from manifests */
export const MANIFEST_SVG_FORBIDDEN = true;
