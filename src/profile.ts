import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ShapeId } from "./types";

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

export interface TypographyProfile {
  role: string;
  fontFamily: string;
  fontFile: string;
  fontDigestSha256: string;
}

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
  paddingX: 28,
  paddingY: 24,
  paddingRatio: 0.09,
  usableWidthFactor: 0.94,
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
      paddingRatio: 0.09,
      usableWidthFactor: 0.96,
      maxFontSize: 64,
    }),
  },
  typography: {
    role: "body",
    fontFamily: "Noto Sans",
    fontFile: "assets/fonts/NotoSans-Regular.otf",
    fontDigestSha256: "bfb44de2c2031c391ff856943fe8f105ebb5d725cb9a04d493d211d5bbd5c21b",
  },
  numberPrecision: 2,
} satisfies RenderProfile;

const SHAPE_IDS = new Set<string>(Object.keys(PROFILE.shapes));

let cachedFontBytes: Buffer | null = null;
let cachedFontBase64: string | null = null;

export function fontAbsolutePath(): string {
  return join(ROOT, PROFILE.typography.fontFile);
}

export function loadFontBytes(): Buffer {
  if (cachedFontBytes) return cachedFontBytes;
  const bytes = readFileSync(fontAbsolutePath());
  const digest = createHash("sha256").update(bytes).digest("hex");
  if (digest !== PROFILE.typography.fontDigestSha256) {
    throw new Error(
      `Font digest mismatch: expected ${PROFILE.typography.fontDigestSha256}, got ${digest}`,
    );
  }
  cachedFontBytes = bytes;
  return bytes;
}

export function fontBase64(): string {
  if (cachedFontBase64) return cachedFontBase64;
  cachedFontBase64 = loadFontBytes().toString("base64");
  return cachedFontBase64;
}

export function shapeProfile(shapeId: ShapeId): ShapeProfile {
  return PROFILE.shapes[shapeId];
}

export function isShapeImplemented(shapeId: string): shapeId is ShapeId {
  return SHAPE_IDS.has(shapeId);
}
