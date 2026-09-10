import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { FontBinding, FontId, FontRole, ShapeId, Voice } from "./types";

export type { FontBinding, FontId, FontRole } from "./types";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

export const PACKAGE_VERSION = "0.1.0";
export const SCHEMA_VERSION = "0.1.0";

export const PROFILE_ID = "rift-city-proof";
export const PROFILE_VERSION = "0.1.0";

export interface FitParams {
  paddingX: number;
  paddingY: number;
  /** Extra inset as fraction of min(body.w, body.h); 0 = absolute pads only. */
  paddingRatio: number;
  /** Shrink usable text width vs padded box (scalloped / round silhouettes). */
  usableWidthFactor: number;
  lineHeightFactor: number;
  minFontSize: number;
  maxFontSize: number;
  maxLines: number;
  maxExpandFactor: number;
  tailBaseWidthFactor: number;
  tailTipTolerance: number;
}

export interface ShapeProfile extends FitParams {
  implemented: true;
  fill: string;
  stroke: string;
  strokeWidth: number;
}

export type FontFormat = "opentype" | "truetype";

export interface FontAsset {
  id: FontId;
  /** Name declared in the SVG @font-face and referenced by every text node. */
  family: string;
  file: string;
  format: FontFormat;
  digestSha256: string;
  licenceFile: string;
}

export const FONTS = {
  "shantell-sans-semibold": {
    id: "shantell-sans-semibold",
    family: "Shantell Sans SemiBold",
    file: "assets/fonts/ShantellSans-SemiBold.otf",
    format: "opentype",
    digestSha256: "e3e56024242b3ba40da25854a8fe9080e9bde0ea20fddd0c807e2e246d659097",
    licenceFile: "assets/fonts/OFL-Shantell-Sans.txt",
  },
  "noto-sans-regular": {
    id: "noto-sans-regular",
    family: "Noto Sans",
    file: "assets/fonts/NotoSans-Regular.otf",
    format: "opentype",
    digestSha256: "bfb44de2c2031c391ff856943fe8f105ebb5d725cb9a04d493d211d5bbd5c21b",
    licenceFile: "assets/fonts/OFL.txt",
  },
  "jetbrains-mono-regular": {
    id: "jetbrains-mono-regular",
    family: "JetBrains Mono",
    file: "assets/fonts/JetBrainsMono-Regular.ttf",
    format: "truetype",
    digestSha256: "e6fd0d7e91550b3ed2b735d4312474362c4716edc4fc0577a0f61ed782d5aed1",
    licenceFile: "assets/fonts/OFL-JetBrains-Mono.txt",
  },
  "ibm-plex-mono-regular": {
    id: "ibm-plex-mono-regular",
    family: "IBM Plex Mono",
    file: "assets/fonts/IBMPlexMono-Regular.ttf",
    format: "truetype",
    digestSha256: "7c6fbddca4b700be918f5f6183d9bd4464fa427fe435f0b480d77fe2bb8c5a43",
    licenceFile: "assets/fonts/OFL-IBM-Plex-Mono.txt",
  },
  "roboto-mono-regular": {
    id: "roboto-mono-regular",
    family: "Roboto Mono",
    file: "assets/fonts/RobotoMono-Regular.ttf",
    format: "truetype",
    digestSha256: "af0bff7599c3df3831755c16e39b3c496df74b8c8d8a1161b14dc8461be17cb4",
    licenceFile: "assets/fonts/OFL-Roboto-Mono.txt",
  },
  "oswald-medium": {
    id: "oswald-medium",
    family: "Oswald Medium",
    file: "assets/fonts/Oswald-Medium.ttf",
    format: "truetype",
    digestSha256: "d8b3ac8668c6ddbcecd299567e2130e2b933ad8b6c98b5b8ac6ff2bee9c0848a",
    licenceFile: "assets/fonts/OFL-Oswald.txt",
  },
} satisfies Record<FontId, FontAsset>;

export interface TypographyRole {
  fontId: FontId;
  /** Render upper-case. Measurement runs on the transformed string. */
  uppercase: boolean;
}

export interface TypographyProfile {
  roles: Record<FontRole, TypographyRole>;
  sourceLabelScale: number;
  sourceLabelMinFontSize: number;
  sourceLabelMaxFontSize: number;
  sourceLabelGapFactor: number;
}

/** Every face Wubble may load, pinned by digest. */
export const FONT_IDS: readonly FontId[] = [
  "shantell-sans-semibold",
  "noto-sans-regular",
  "jetbrains-mono-regular",
  "ibm-plex-mono-regular",
  "roboto-mono-regular",
  "oswald-medium",
];

export interface RenderProfile {
  id: string;
  version: string;
  shapes: Record<ShapeId, ShapeProfile>;
  typography: TypographyProfile;
  numberPrecision: number;
}

const sharedFit = {
  paddingX: 48,
  paddingY: 36,
  paddingRatio: 0,
  usableWidthFactor: 1,
  lineHeightFactor: 1.25,
  minFontSize: 28,
  maxFontSize: 72,
  maxLines: 4,
  maxExpandFactor: 1.35,
  tailBaseWidthFactor: 0.12,
  tailTipTolerance: 2,
} satisfies FitParams;

/** Ref-sheet balloons: text drives size; comic lettering density (air, not sparse). */
const refFit = {
  ...sharedFit,
  paddingX: 44,
  paddingY: 34,
  paddingRatio: 0.12,
  usableWidthFactor: 0.9,
  minFontSize: 30,
  maxFontSize: 64,
  maxLines: 5,
  maxExpandFactor: 4,
} satisfies FitParams;

function shape(
  overrides: Partial<FitParams> & Pick<ShapeProfile, "fill" | "stroke" | "strokeWidth">,
): ShapeProfile {
  return {
    implemented: true,
    ...sharedFit,
    ...overrides,
  } satisfies ShapeProfile;
}

function refShape(
  overrides: Partial<FitParams> & Pick<ShapeProfile, "fill" | "stroke" | "strokeWidth">,
): ShapeProfile {
  return {
    implemented: true,
    ...refFit,
    ...overrides,
  } satisfies ShapeProfile;
}

/** Proof defaults for registered shapes / typography */
export const PROFILE = {
  id: PROFILE_ID,
  version: PROFILE_VERSION,
  shapes: {
    speech: shape({
      fill: "#fffaf0",
      stroke: "#241f1a",
      strokeWidth: 10,
    }),
    chain: refShape({
      fill: "#fffaf0",
      stroke: "#241f1a",
      strokeWidth: 12,
      paddingRatio: 0.08,
      usableWidthFactor: 0.96,
      maxFontSize: 64,
    }),
    cloud: refShape({
      fill: "#fffaf0",
      stroke: "#241f1a",
      strokeWidth: 12,
      paddingRatio: 0.12,
      usableWidthFactor: 0.9,
      maxFontSize: 58,
    }),
    needle: refShape({
      fill: "#fffaf0",
      stroke: "#241f1a",
      strokeWidth: 12,
      paddingRatio: 0.1,
      usableWidthFactor: 0.92,
      maxFontSize: 62,
    }),
    round: refShape({
      fill: "#fffaf0",
      stroke: "#241f1a",
      strokeWidth: 12,
      paddingRatio: 0.1,
      usableWidthFactor: 0.92,
      maxFontSize: 64,
    }),
    hook: refShape({
      fill: "#fffaf0",
      stroke: "#241f1a",
      strokeWidth: 12,
      paddingRatio: 0.1,
      usableWidthFactor: 0.94,
      maxFontSize: 62,
    }),
    lightning: refShape({
      fill: "#fffaf0",
      stroke: "#241f1a",
      strokeWidth: 12,
      paddingRatio: 0.1,
      usableWidthFactor: 0.92,
      maxFontSize: 58,
    }),
    fluffy: refShape({
      fill: "#fffaf0",
      stroke: "#241f1a",
      strokeWidth: 12,
      paddingRatio: 0.14,
      usableWidthFactor: 0.86,
      maxFontSize: 56,
    }),
    thought: refShape({
      fill: "#fffaf0",
      stroke: "#241f1a",
      strokeWidth: 12,
      paddingRatio: 0.1,
      usableWidthFactor: 0.92,
      maxFontSize: 62,
    }),
    rect: refShape({
      fill: "#fffaf0",
      stroke: "#241f1a",
      strokeWidth: 12,
      paddingRatio: 0.12,
      usableWidthFactor: 0.9,
      maxFontSize: 64,
    }),
  },
  typography: {
    roles: {
      human: { fontId: "shantell-sans-semibold", uppercase: false },
      // Provisional until the machine voice is selected by name.
      machine: { fontId: "ibm-plex-mono-regular", uppercase: false },
      machineLabel: { fontId: "ibm-plex-mono-regular", uppercase: true },
    },
    sourceLabelScale: 0.36,
    sourceLabelMinFontSize: 14,
    sourceLabelMaxFontSize: 24,
    sourceLabelGapFactor: 0.35,
  },
  numberPrecision: 2,
} satisfies RenderProfile;

const SHAPE_IDS = new Set<string>(Object.keys(PROFILE.shapes));

const fontBytesCache = new Map<FontId, Buffer>();
const fontBase64Cache = new Map<FontId, string>();

export function isFontId(value: string): value is FontId {
  return Object.prototype.hasOwnProperty.call(FONTS, value);
}

export function fontAsset(id: FontId): FontAsset {
  return FONTS[id];
}

export function fontAbsolutePath(id: FontId): string {
  return join(ROOT, fontAsset(id).file);
}

/** Load a registered face, refusing any bytes that do not match its digest. */
export function loadFontBytes(id: FontId): Buffer {
  const cached = fontBytesCache.get(id);
  if (cached) return cached;
  const asset = fontAsset(id);
  const bytes = readFileSync(join(ROOT, asset.file));
  const digest = createHash("sha256").update(bytes).digest("hex");
  if (digest !== asset.digestSha256) {
    throw new Error(
      `Font digest mismatch for ${id}: expected ${asset.digestSha256}, got ${digest}`,
    );
  }
  fontBytesCache.set(id, bytes);
  return bytes;
}

export function fontBase64(id: FontId): string {
  const cached = fontBase64Cache.get(id);
  if (cached) return cached;
  const b64 = loadFontBytes(id).toString("base64");
  fontBase64Cache.set(id, b64);
  return b64;
}

/** Mime type used inside the embedded data URL. */
export function fontMime(id: FontId): string {
  return fontAsset(id).format === "opentype" ? "font/otf" : "font/ttf";
}

export function defaultFontBinding(): FontBinding {
  const roles = PROFILE.typography.roles;
  return {
    human: roles.human.fontId,
    machine: roles.machine.fontId,
    machineLabel: roles.machineLabel.fontId,
  };
}

/**
 * Resolve one render's faces. Overriding `machine` moves the source label with
 * it unless the label is overridden separately, so a candidate is one decision.
 */
export function resolveFontBinding(overrides?: Partial<FontBinding>): FontBinding {
  const base = defaultFontBinding();
  if (!overrides) return base;
  return {
    human: overrides.human ?? base.human,
    machine: overrides.machine ?? base.machine,
    machineLabel: overrides.machineLabel ?? overrides.machine ?? base.machineLabel,
  };
}

export function voiceOf(item: { voice?: Voice }): Voice {
  return item.voice ?? "human";
}

/** Dialogue face for a voice. Narration is set in the human hand. */
export function textFontIdFor(binding: FontBinding, voice: Voice): FontId {
  return voice === "machine" ? binding.machine : binding.human;
}

export function labelFontIdFor(binding: FontBinding): FontId {
  return binding.machineLabel;
}

export function shapeProfile(shapeId: ShapeId): ShapeProfile {
  return PROFILE.shapes[shapeId];
}

export function isShapeImplemented(shapeId: string): shapeId is ShapeId {
  return SHAPE_IDS.has(shapeId);
}
