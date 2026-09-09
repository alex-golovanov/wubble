/**
 * Render hand-sheet reference gallery: 3x3 grid + per-cell PNGs + cream hook.
 * Light bg #f3efe6, flat silhouettes (no hatch), open-join templates.
 */
import sharp from "sharp";
import { mkdirSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import {
  REF_SHAPE_IDS,
  REF_TEMPLATES,
  mapTemplatePath,
  creamHookPath,
} from "../src/shapes/ref-sheet";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "demo-out/gallery");
mkdirSync(out, { recursive: true });
const BG = "#f3efe6";
const FILL = "#fffaf0";
const STROKE = "#241f1a";
const SW = 14;

async function svgToPng(svg, outPath) {
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  writeFileSync(outPath, png);
  return outPath;
}

function cellSvg(pathD, w, h, sw = SW) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
  <rect width="${w}" height="${h}" fill="${BG}"/>
  <path d="${pathD}" fill="${FILL}" stroke="${STROKE}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round"/>
</svg>`;
}

async function main() {
  const cell = 420;
  const gap = 28;
  const pad = 36;
  const cols = 3;
  const rows = 3;
  const gridW = pad * 2 + cols * cell + (cols - 1) * gap;
  const gridH = pad * 2 + rows * cell + (rows - 1) * gap;

  const paths = [];
  for (let i = 0; i < REF_SHAPE_IDS.length; i++) {
    const id = REF_SHAPE_IDS[i];
    const tpl = REF_TEMPLATES[id];
    const r = Math.floor(i / 3);
    const c = i % 3;
    const x = pad + c * (cell + gap);
    const y = pad + r * (cell + gap);
    const target = { x: x + 24, y: y + 24, width: cell - 48, height: cell - 48 };
    const d = mapTemplatePath(tpl.path, tpl.viewBox, target);
    paths.push({ id, d, x, y, alias: tpl.alias });

    // individual cell
    const alone = mapTemplatePath(tpl.path, tpl.viewBox, {
      x: 40,
      y: 40,
      width: 520,
      height: 520,
    });
    const one = cellSvg(alone, 600, 600);
    writeFileSync(join(out, `ref-sheet-${String(i + 1).padStart(2, "0")}.svg`), one);
    await svgToPng(one, join(out, `ref-sheet-${String(i + 1).padStart(2, "0")}.png`));
    console.log("wrote", `ref-sheet-${String(i + 1).padStart(2, "0")}.png`);
  }

  const parts = paths
    .map(
      (p) =>
        `<path data-shape="${p.id}" d="${p.d}" fill="${FILL}" stroke="${STROKE}" stroke-width="${SW}" stroke-linejoin="round" stroke-linecap="round"/>`,
    )
    .join("\n  ");
  const labels = paths
    .map(
      (p, i) =>
        `<text x="${p.x + cell / 2}" y="${p.y + 22}" text-anchor="middle" font-family="sans-serif" font-size="18" fill="#241f1a">${i + 1}. ${p.alias}</text>`,
    )
    .join("\n  ");

  const grid = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${gridW} ${gridH}" width="${gridW}" height="${gridH}">
  <rect width="${gridW}" height="${gridH}" fill="${BG}"/>
  ${parts}
  ${labels}
</svg>`;
  writeFileSync(join(out, "ref-sheet-grid.svg"), grid);
  await svgToPng(grid, join(out, "ref-sheet-grid.png"));
  console.log("wrote ref-sheet-grid.png");

  // cream hooked oval — short hook, match attachment #2 proportions
  const creamD = creamHookPath({ x: 80, y: 90, width: 1040, height: 688 }); // ~1.51 aspect like ref
  const cream = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 760" width="1200" height="760">
  <rect width="1200" height="760" fill="#000000"/>
  <path d="${creamD}" fill="${FILL}" stroke="#000000" stroke-width="18" stroke-linejoin="round" stroke-linecap="round"/>
</svg>`;
  writeFileSync(join(out, "ref-cream-hook.svg"), cream);
  await svgToPng(cream, join(out, "ref-cream-hook.png"));
  console.log("wrote ref-cream-hook.png");

  console.log("done", out);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
