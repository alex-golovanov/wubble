/**
 * Filled ref-sheet gallery: cool phrases lettered into chain..09.
 * Text drives balloon size (layout expands with ratio padding + content bands);
 * silhouette templates keep their native aspect.
 */
import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";
import { renderPage } from "../src/index";
import { REF_SHAPE_IDS, REF_TEMPLATES } from "../src/shapes/ref-sheet";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "demo-out/gallery");
mkdirSync(outDir, { recursive: true });

const BG = "#f3efe6";
const PAGE = 2200;

const copy = {
  chain: {
    mode: "lobes",
    top: ["We keep moving."],
    bottom: ["No looking back."],
  },
  cloud: {
    mode: "lines",
    lines: ["Plot twist:", "I'm the weather."],
  },
  needle: {
    mode: "lines",
    lines: ["Long story", "short—", "don't."],
  },
  round: {
    mode: "lines",
    lines: ["Trust the", "glitch."],
  },
  hook: {
    mode: "lines",
    lines: ["Soft voice.", "Hard truth."],
  },
  lightning: {
    mode: "lines",
    lines: ["SYSTEM:", "feelings", "overloaded"],
  },
  fluffy: {
    mode: "lines",
    lines: ["Chaos, but", "make it cute."],
  },
  thought: {
    mode: "lines",
    lines: ["…what if we", "just win?"],
  },
  rect: {
    mode: "lines",
    lines: ["Ship it.", "Sleep later."],
  },
};

function templateAspect(id) {
  const [, , w, h] = REF_TEMPLATES[id].viewBox;
  return w / h;
}

/**
 * Seed placement at native template aspect.
 * Modest minimum — layout expands from text + content-band padding.
 */
function seedPlacement(id) {
  const aspect = templateAspect(id);
  // Modest seed — layout expands from text + content-band padding at maxFont.
  let height = 420;
  if (id === "chain") height = 520; // chain needs both lobes + tail
  if (id === "needle" || id === "lightning") height = 480; // long tails
  if (id === "round") height = 400;
  if (id === "rect") height = 440;
  let width = Math.round(height * aspect);
  if (width > 720) {
    width = 720;
    height = Math.round(width / aspect);
  }
  const x = Math.round((PAGE - width) / 2);
  const y = Math.round(PAGE * 0.14);
  return { x, y, width, height };
}

function tipFor(id, body) {
  const tipY = body.y + body.height + 36;
  const tipX =
    body.x +
    body.width * (id === "lightning" ? 0.28 : id === "hook" ? 0.38 : id === "needle" ? 0.5 : 0.55);
  return { tipX, tipY };
}

const cells = [];

for (const id of REF_SHAPE_IDS) {
  const alias = REF_TEMPLATES[id].alias;
  const phrase = copy[id];
  const seed = seedPlacement(id);
  const { tipX, tipY } = tipFor(id, seed);

  let item;
  let speakerBounds;
  let mouth;

  if (phrase.mode === "lobes") {
    // Primary placement = FULL chain frame (shape maps here).
    // Bottom lobe lettering box is remapped from the fitted frame in render.
    const dummyBottom = {
      x: seed.x,
      y: seed.y + seed.height * 0.52,
      width: seed.width,
      height: seed.height * 0.26,
    };
    item = {
      kind: "balloon",
      id: `${id}-B01`,
      panelId: "P1",
      speakerId: "speaker",
      shapeId: id,
      placement: seed,
      lobes: [
        {
          placement: dummyBottom,
          content: { en: { lines: phrase.bottom } },
        },
      ],
      tail: { subjectId: "speaker", anchor: "mouth", attachment: "bottom" },
      content: { en: { lines: phrase.top } },
    };
    speakerBounds = { x: tipX - 40, y: tipY - 20, width: 120, height: 160 };
    mouth = { x: tipX, y: tipY };
  } else {
    const content =
      phrase.mode === "wrap" ? { en: { text: phrase.text } } : { en: { lines: phrase.lines } };
    item = {
      kind: "balloon",
      id: `${id}-B01`,
      panelId: "P1",
      speakerId: "speaker",
      shapeId: id,
      placement: seed,
      tail: { subjectId: "speaker", anchor: "mouth", attachment: "bottom" },
      content,
    };
    speakerBounds = { x: tipX - 40, y: tipY - 20, width: 120, height: 160 };
    mouth = { x: tipX, y: tipY };
  }

  const manifest = {
    schemaVersion: "0.1.0",
    pageId: `filled-${id}`,
    coordinateSpace: {
      width: PAGE,
      height: PAGE,
      origin: "top-left",
      units: "art-px",
    },
    renderProfile: { id: "rift-city-proof", version: "0.1.0" },
    subjects: [
      {
        id: "speaker",
        bounds: speakerBounds,
        anchors: { mouth },
      },
    ],
    exclusionZones: [],
    items: [item],
  };

  const result = renderPage(manifest, { locale: "en", profileId: "rift-city-proof" });
  if (!result.svg) {
    console.error(id, "FAILED", JSON.stringify(result.diagnostics, null, 2));
    continue;
  }

  const label =
    phrase.mode === "lobes"
      ? `${phrase.top.join(" ")} | ${phrase.bottom.join(" ")}`
      : phrase.mode === "wrap"
        ? phrase.text
        : phrase.lines.join(" / ");
  console.log("ok", id, alias, label, "valid=", result.diagnostics.valid);

  const svg = result.svg.replace(
    /<svg([^>]*)>/,
    `<svg$1><rect width="100%" height="100%" fill="${BG}"/>`,
  );
  // Trim page chrome so cell PNGs show lettering density against the balloon.
  const trimmed = await sharp(Buffer.from(svg))
    .trim({ background: BG, threshold: 8 })
    .png()
    .toBuffer();
  const pad = 36;
  const png = await sharp(trimmed)
    .extend({
      top: pad,
      bottom: pad,
      left: pad,
      right: pad,
      background: BG,
    })
    .resize(720, 720, { fit: "contain", background: BG })
    .png()
    .toBuffer();
  writeFileSync(join(outDir, `filled-${id}.png`), png);
  writeFileSync(join(outDir, `filled-${id}.svg`), svg);
  cells.push({ id, png, label: alias });
}

const cell = 720;
const gap = 24;
const pad = 32;
const labelH = 36;
const cols = 3;
const rows = 3;
const W = pad * 2 + cols * cell + (cols - 1) * gap;
const H = pad * 2 + rows * (cell + labelH) + (rows - 1) * gap;
const composites = [];
for (let i = 0; i < cells.length; i++) {
  const r = Math.floor(i / 3);
  const c = i % 3;
  const x = pad + c * (cell + gap);
  const y = pad + r * (cell + labelH + gap) + labelH;
  composites.push({ input: cells[i].png, left: x, top: y });
}
const labelSvg = `<?xml version="1.0"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <rect width="100%" height="100%" fill="${BG}"/>
  ${cells
    .map((cellItem, i) => {
      const r = Math.floor(i / 3);
      const c = i % 3;
      const x = pad + c * (cell + gap) + cell / 2;
      const y = pad + r * (cell + labelH + gap) + 26;
      return `<text x="${x}" y="${y}" text-anchor="middle" font-family="sans-serif" font-size="22" fill="#241f1a">${i + 1}. ${cellItem.label}</text>`;
    })
    .join("\n")}
</svg>`;
const base = await sharp(Buffer.from(labelSvg)).png().toBuffer();
await sharp(base).composite(composites).png().toFile(join(outDir, "filled-ref-sheet-grid.png"));
console.log("wrote filled-ref-sheet-grid.png");
