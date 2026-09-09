import sharp from "sharp";
import { mkdirSync, writeFileSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { renderPage } from "../src/index";
import { PROFILE_ID } from "../src/profile";
import { buildRoundedBalloonPath } from "../src/shapes/rounded-rect";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "demo-out/gallery");
mkdirSync(out, { recursive: true });
const BG = "#f3efe6";

function load(p) {
  return JSON.parse(readFileSync(join(root, p), "utf8"));
}

async function svgToLightPng(svg, outPath, pad = 28) {
  const overlay = await sharp(Buffer.from(svg)).png().ensureAlpha().toBuffer();
  const meta = await sharp(overlay).metadata();
  const w = meta.width;
  const h = meta.height;
  const bg = await sharp({
    create: { width: w, height: h, channels: 3, background: BG },
  })
    .png()
    .toBuffer();
  let composed = await sharp(bg)
    .composite([{ input: overlay, top: 0, left: 0 }])
    .png()
    .toBuffer();

  const { data, info } = await sharp(overlay)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let minX = info.width,
    minY = info.height,
    maxX = 0,
    maxY = 0;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const a = data[(y * info.width + x) * 4 + 3];
      if (a > 8) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX >= minX) {
    minX = Math.max(0, minX - pad);
    minY = Math.max(0, minY - pad);
    maxX = Math.min(info.width - 1, maxX + pad);
    maxY = Math.min(info.height - 1, maxY + pad);
    composed = await sharp(composed)
      .extract({
        left: minX,
        top: minY,
        width: maxX - minX + 1,
        height: maxY - minY + 1,
      })
      .png()
      .toBuffer();
  }
  writeFileSync(outPath, composed);
  return outPath;
}

function bareBalloonSvg(path, fill, stroke, sw, vbW, vbH) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vbW} ${vbH}" width="${vbW}" height="${vbH}">
  <path d="${path}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round"/>
</svg>`;
}

async function main() {
  // 1) Full corners grid from fixture
  {
    const m = load("fixtures/corners-grid.json");
    const r = renderPage(m, { locale: "en", profileId: PROFILE_ID });
    if (!r.svg) throw new Error(JSON.stringify(r.diagnostics, null, 2));
    writeFileSync(join(out, "corners-grid.svg"), r.svg);
    await svgToLightPng(r.svg, join(out, "corners-grid.png"), 40);
    console.log("wrote corners-grid.png");
  }

  // 2) Isolated radius strip (body-only + short tip) for crisp QA
  {
    const cells = [
      { name: "r0", cr: 0, edge: "smooth", label: "0" },
      { name: "rmid", cr: 0.45, edge: "smooth", label: "0.45" },
      { name: "r1", cr: 1, edge: "smooth", label: "1" },
      { name: "jagged", cr: 0, edge: "jagged", label: "jagged" },
    ];
    const cellW = 420;
    const cellH = 360;
    const pad = 40;
    const bodies = [];
    const paths = [];
    for (let i = 0; i < cells.length; i++) {
      const c = cells[i];
      const body = {
        x: pad + i * cellW + 40,
        y: 60,
        width: 300,
        height: 180,
      };
      const tip = {
        x: body.x + body.width * 0.45,
        y: body.y + body.height + 70,
      };
      const path = buildRoundedBalloonPath({
        bodies: [body],
        tip,
        bend: {
          x: tip.x + 8,
          y: body.y + body.height + 28,
        },
        attachment: "bottom",
        cornerRadius: c.cr,
        edge: c.edge,
      });
      bodies.push(body);
      paths.push({ ...c, path, tip });
    }
    const vbW = cells.length * cellW + pad;
    const vbH = cellH;
    const parts = paths
      .map(
        (p) =>
          `<path d="${p.path}" fill="#fffaf0" stroke="#241f1a" stroke-width="10" stroke-linejoin="round" stroke-linecap="round"/>`,
      )
      .join("\n  ");
    const labels = paths
      .map((p, i) => {
        const b = bodies[i];
        return `<text x="${b.x + b.width / 2}" y="${b.y + b.height / 2 + 8}" text-anchor="middle" font-family="sans-serif" font-size="28" fill="#241f1a">${p.label}</text>`;
      })
      .join("\n  ");
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vbW} ${vbH}" width="${vbW}" height="${vbH}">
  ${parts}
  ${labels}
</svg>`;
    writeFileSync(join(out, "corners-strip.svg"), svg);
    await svgToLightPng(svg, join(out, "corners-strip.png"), 16);
    console.log("wrote corners-strip.png");
  }

  // 3) Chain three
  {
    const m = load("fixtures/chain-three.json");
    const r = renderPage(m, { locale: "en", profileId: PROFILE_ID });
    if (!r.svg) throw new Error(JSON.stringify(r.diagnostics, null, 2));
    writeFileSync(join(out, "corners-chain-three.svg"), r.svg);
    await svgToLightPng(r.svg, join(out, "corners-chain-three.png"), 36);
    console.log("wrote corners-chain-three.png");
  }

  // 4) Refresh human + glitch gallery samples
  for (const [name, file, locale] of [
    ["corners-human-01", "examples/page-022.json", "en"],
    ["corners-glitch-01", "fixtures/glitch-01.json", "en"],
  ]) {
    const m = load(file);
    const r = renderPage(m, { locale, profileId: PROFILE_ID });
    if (!r.svg) throw new Error(name + " " + JSON.stringify(r.diagnostics));
    writeFileSync(join(out, `${name}.svg`), r.svg);
    await svgToLightPng(r.svg, join(out, `${name}.png`));
    console.log("wrote", name + ".png");
  }

  console.log("done", out);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
