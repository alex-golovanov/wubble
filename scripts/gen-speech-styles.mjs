import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";
import { renderPage } from "../src/index";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "demo-out/gallery");
mkdirSync(outDir, { recursive: true });
const BG = "#f3efe6";

function baseManifest(
  pageId,
  itemExtra,
  lines,
  placement = { x: 460, y: 340, width: 420, height: 220 },
) {
  return {
    schemaVersion: "0.1.0",
    pageId,
    coordinateSpace: { width: 1400, height: 1200, origin: "top-left", units: "art-px" },
    renderProfile: { id: "wubble-default", version: "0.1.0" },
    subjects: [
      {
        id: "who",
        bounds: { x: 620, y: 820, width: 160, height: 200 },
        anchors: { mouth: { x: 700, y: 900 } },
      },
    ],
    exclusionZones: [],
    items: [
      {
        kind: "balloon",
        id: `${pageId}-B01`,
        panelId: "P1",
        speakerId: "who",
        shapeId: "speech",
        placement,
        tail: { subjectId: "who", anchor: "mouth", attachment: "bottom" },
        content: { en: { lines } },
        ...itemExtra,
      },
    ],
  };
}

// Same wording on all three so soft / square / jagged lettering density compares fairly.
const SHARED_LINES = ["We keep", "moving."];

const variants = [
  {
    name: "soft",
    label: "Soft · radius 1 · smooth",
    extra: { cornerRadius: 1, edge: "smooth" },
    lines: SHARED_LINES,
  },
  {
    name: "square",
    label: "Square · radius 0 · smooth",
    extra: { cornerRadius: 0, edge: "smooth" },
    lines: SHARED_LINES,
  },
  {
    name: "jagged",
    label: "Jagged · radius 0 · jagged",
    extra: { cornerRadius: 0, edge: "jagged" },
    lines: SHARED_LINES,
  },
];

const cells = [];
for (const v of variants) {
  const result = renderPage(baseManifest(v.name, v.extra, v.lines), {
    locale: "en",
    profileId: "wubble-default",
  });
  if (!result.svg) {
    console.error("FAIL", v.name, JSON.stringify(result.diagnostics, null, 2));
    continue;
  }
  const svg = result.svg.replace(
    /<svg([^>]*)>/,
    `<svg$1><rect width="100%" height="100%" fill="${BG}"/>`,
  );
  const png = await sharp(Buffer.from(svg))
    .resize(640, 560, { fit: "contain", background: BG })
    .png()
    .toBuffer();
  writeFileSync(join(outDir, `speech-styles-${v.name}.png`), png);
  cells.push({ ...v, png });
  console.log("ok", v.name);
}

const cellW = 640;
const cellH = 560;
const gap = 28;
const pad = 36;
const labelH = 40;
const W = pad * 2 + cells.length * cellW + (cells.length - 1) * gap;
const H = pad * 2 + labelH + cellH;
const labelSvg = `<?xml version="1.0"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <rect width="100%" height="100%" fill="${BG}"/>
  ${cells
    .map((c, i) => {
      const x = pad + i * (cellW + gap) + cellW / 2;
      return `<text x="${x}" y="${pad + 28}" text-anchor="middle" font-family="sans-serif" font-size="20" fill="#241f1a">${c.label}</text>`;
    })
    .join("\n")}
</svg>`;
const base = await sharp(Buffer.from(labelSvg)).png().toBuffer();
const composites = cells.map((c, i) => ({
  input: c.png,
  left: pad + i * (cellW + gap),
  top: pad + labelH,
}));
await sharp(base).composite(composites).png().toFile(join(outDir, "speech-styles-strip.png"));
console.log("wrote speech-styles-strip.png");

// Stress: longer copy, soft vs square side-by-side (same lines + placement).
const STRESS_LINES = ["Signal locked. Replay ready.", "We keep moving through the static."];
const stressVariants = [
  {
    name: "stress-soft",
    label: "stress · radius 1 · soft",
    extra: { cornerRadius: 1, edge: "smooth" },
    lines: STRESS_LINES,
  },
  {
    name: "stress-square",
    label: "stress · radius 0 · square",
    extra: { cornerRadius: 0, edge: "smooth" },
    lines: STRESS_LINES,
  },
];
const stressCells = [];
for (const v of stressVariants) {
  const stressPlacement = { x: 300, y: 260, width: 720, height: 300 };
  const result = renderPage(baseManifest(v.name, v.extra, v.lines, stressPlacement), {
    locale: "en",
    profileId: "wubble-default",
  });
  if (!result.svg) {
    console.error("FAIL", v.name, JSON.stringify(result.diagnostics, null, 2));
    continue;
  }
  const svg = result.svg.replace(
    /<svg([^>]*)>/,
    `<svg$1><rect width="100%" height="100%" fill="${BG}"/>`,
  );
  const png = await sharp(Buffer.from(svg))
    .resize(640, 560, { fit: "contain", background: BG })
    .png()
    .toBuffer();
  writeFileSync(join(outDir, `speech-styles-${v.name}.png`), png);
  stressCells.push({ ...v, png });
  console.log("ok", v.name);
}
{
  const n = stressCells.length;
  const W = pad * 2 + n * cellW + (n - 1) * gap;
  const H = pad * 2 + labelH + cellH;
  const labelSvg = `<?xml version="1.0"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <rect width="100%" height="100%" fill="${BG}"/>
  ${stressCells
    .map((c, i) => {
      const x = pad + i * (cellW + gap) + cellW / 2;
      return `<text x="${x}" y="${pad + 28}" text-anchor="middle" font-family="sans-serif" font-size="20" fill="#241f1a">${c.label}</text>`;
    })
    .join("\n")}
</svg>`;
  const base = await sharp(Buffer.from(labelSvg)).png().toBuffer();
  const composites = stressCells.map((c, i) => ({
    input: c.png,
    left: pad + i * (cellW + gap),
    top: pad + labelH,
  }));
  await sharp(base)
    .composite(composites)
    .png()
    .toFile(join(outDir, "speech-styles-stress-strip.png"));
  console.log("wrote speech-styles-stress-strip.png");
}
