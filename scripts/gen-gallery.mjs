import sharp from "sharp";
import { mkdirSync, writeFileSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { renderPage } from "../src/index";
import { PROFILE_ID } from "../src/profile";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "demo-out/gallery");
mkdirSync(out, { recursive: true });
const BG = "#f3efe6";

function load(p) {
  return JSON.parse(readFileSync(join(root, p), "utf8"));
}

async function svgToLightPng(svg, outPath, pad = 24) {
  const meta = await sharp(Buffer.from(svg)).metadata();
  const w = meta.width;
  const h = meta.height;
  const overlay = await sharp(Buffer.from(svg)).png().ensureAlpha().toBuffer();
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
  if (maxX < minX) {
    writeFileSync(outPath, composed);
    return outPath;
  }
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
  writeFileSync(outPath, composed);
  return outPath;
}

async function cornerCheck(pngPath) {
  const { data, info } = await sharp(pngPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const corners = [
    [0, 0],
    [info.width - 1, 0],
    [0, info.height - 1],
    [info.width - 1, info.height - 1],
  ];
  const samples = corners.map(([x, y]) => {
    const i = (y * info.width + x) * 4;
    return { r: data[i], g: data[i + 1], b: data[i + 2] };
  });
  const light = samples.every((c) => c.r + c.g + c.b > 500);
  return { light, samples };
}

const jobs = [
  ["speech-en", "examples/page-022.json", "en"],
  ["speech-ru", "examples/page-022.json", "ru"],
  ["speech-bottom", "fixtures/speech-bottom.json", "en"],
  ["speech-top", "fixtures/speech-top.json", "en"],
  ["speech-left", "fixtures/speech-left.json", "en"],
  ["speech-right", "fixtures/speech-right.json", "en"],
  ["speech-jagged", "fixtures/speech-jagged.json", "en"],
  ["speech-notch", "fixtures/speech-notch.json", "en"],
  ["multi-balloon", "fixtures/multi-balloon.json", "en"],
];

const report = [];
for (const [name, manifest, locale] of jobs) {
  const m = load(manifest);
  const r = renderPage(m, { locale, profileId: PROFILE_ID });
  if (!r.svg) {
    console.error(name, "FAILED", JSON.stringify(r.diagnostics, null, 2));
    report.push({ name, ok: false });
    continue;
  }
  writeFileSync(join(out, `${name}.svg`), r.svg);
  const pngPath = join(out, `${name}.png`);
  await svgToLightPng(r.svg, pngPath);
  const corners = await cornerCheck(pngPath);
  report.push({ name, ok: true, png: pngPath, corners });
  console.log(name, "corners light?", corners.light);
}
writeFileSync(join(out, "report.json"), JSON.stringify(report, null, 2));
console.log("done", out);
