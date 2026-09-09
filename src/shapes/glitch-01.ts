/**
 * glitch-01 — robot / found-recording balloon.
 * Defaults: cornerRadius=0, edge=jagged. Open tail join (no crossbar).
 */

import { PROFILE } from "../profile";
import type { Bounds, EdgeStyle, Point, ShapeGeometry } from "../types";
import { buildRoundedBalloonPath } from "./rounded-rect";

export interface GlitchInput {
  body: Bounds;
  lobeBodies?: Bounds[];
  tip: Point | null;
  bend: Point | null;
  attachment: "top" | "right" | "bottom" | "left" | "auto";
  cornerRadius: number;
  edge: EdgeStyle;
}

export function buildGlitch01(input: GlitchInput): ShapeGeometry {
  const shape = PROFILE.shapes["glitch-01"];
  const bodies = [input.body, ...(input.lobeBodies ?? [])];
  const path = buildRoundedBalloonPath({
    bodies,
    tip: input.tip,
    bend: input.bend,
    attachment: input.attachment,
    cornerRadius: input.cornerRadius,
    edge: input.edge,
  });
  return {
    path,
    fill: shape.fill,
    stroke: shape.stroke,
    strokeWidth: shape.strokeWidth,
  };
}
