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

const sharedFit = {
  paddingX: 48,
  paddingY: 36,
  /** Extra inset as fraction of min(body.w, body.h); 0 = absolute pads only. */
  paddingRatio: 0,
  /** Shrink usable text width vs padded box (scalloped / round silhouettes). */
  usableWidthFactor: 1,
  lineHeightFactor: 1.25,
  minFontSize: 28,
  maxFontSize: 72,
  maxLines: 4,
  maxExpandFactor: 1.35,
  tailBaseWidthFactor: 0.12,
  tailTipTolerance: 2,
} as const;

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
} as const;

/** Proof defaults for registered shapes / typography */
export const PROFILE = {
  id: PROFILE_ID,
  version: PROFILE_VERSION,
  shapes: {
    "human-01": {
      implemented: true as const,
      fill: "#fffaf0",
      stroke: "#241f1a",
      strokeWidth: 10,
      ...sharedFit,
    },
    "glitch-01": {
      implemented: true as const,
      fill: "#e7f2e9",
      stroke: "#142018",
      strokeWidth: 8,
      ...sharedFit,
      paddingX: 40,
      paddingY: 32,
    },
    "glitch-breaking-01": {
      implemented: true as const,
      fill: "#f3e6e6",
      stroke: "#2a1414",
      strokeWidth: 8,
      ...sharedFit,
      paddingX: 40,
      paddingY: 32,
    },
    "ref-01": {
      implemented: true as const,
      fill: "#fffaf0",
      stroke: "#241f1a",
      strokeWidth: 12,
      ...refFit,
      paddingRatio: 0.08,
      usableWidthFactor: 0.96,
      maxFontSize: 64,
    },
    "ref-02": {
      implemented: true as const,
      fill: "#fffaf0",
      stroke: "#241f1a",
      strokeWidth: 12,
      ...refFit,
      paddingRatio: 0.12,
      usableWidthFactor: 0.90,
      maxFontSize: 58,
    },
    "ref-03": {
      implemented: true as const,
      fill: "#fffaf0",
      stroke: "#241f1a",
      strokeWidth: 12,
      ...refFit,
      paddingRatio: 0.10,
      usableWidthFactor: 0.92,
      maxFontSize: 62,
    },
    "ref-04": {
      implemented: true as const,
      fill: "#fffaf0",
      stroke: "#241f1a",
      strokeWidth: 12,
      ...refFit,
      paddingRatio: 0.10,
      usableWidthFactor: 0.92,
      maxFontSize: 64,
    },
    "ref-05": {
      implemented: true as const,
      fill: "#fffaf0",
      stroke: "#241f1a",
      strokeWidth: 12,
      ...refFit,
      paddingRatio: 0.10,
      usableWidthFactor: 0.94,
      maxFontSize: 62,
    },
    "ref-06": {
      implemented: true as const,
      fill: "#fffaf0",
      stroke: "#241f1a",
      strokeWidth: 12,
      ...refFit,
      paddingRatio: 0.10,
      usableWidthFactor: 0.92,
      maxFontSize: 58,
    },
    "ref-07": {
      implemented: true as const,
      fill: "#fffaf0",
      stroke: "#241f1a",
      strokeWidth: 12,
      ...refFit,
      paddingRatio: 0.14,
      usableWidthFactor: 0.86,
      maxFontSize: 56,
    },
    "ref-08": {
      implemented: true as const,
      fill: "#fffaf0",
      stroke: "#241f1a",
      strokeWidth: 12,
      ...refFit,
      paddingRatio: 0.10,
      usableWidthFactor: 0.92,
      maxFontSize: 62,
    },
    "ref-09": {
      implemented: true as const,
      fill: "#fffaf0",
      stroke: "#241f1a",
      strokeWidth: 12,
      ...refFit,
      paddingRatio: 0.09,
      usableWidthFactor: 0.96,
      maxFontSize: 64,
    },
  },
  typography: {
    role: "body",
    fontFamily: "Noto Sans",
    fontFile: "assets/fonts/NotoSans-Regular.otf",
    fontDigestSha256:
      "bfb44de2c2031c391ff856943fe8f105ebb5d725cb9a04d493d211d5bbd5c21b",
  },
  numberPrecision: 2,
} as const;

export type ShapeProfile = (typeof PROFILE.shapes)["human-01"];

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
  return PROFILE.shapes[shapeId] as ShapeProfile;
}

export function isShapeImplemented(shapeId: string): shapeId is ShapeId {
  const s = PROFILE.shapes[shapeId as ShapeId];
  return Boolean(s && s.implemented);
}
