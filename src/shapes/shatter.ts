/**
 * shatter — interrupted playback: jagged rect + lightning top notch.
 * Open tail join via rounded-rect builder (cornerRadius 0 / jagged + notchTop).
 */

import { PROFILE } from "../profile";
import type { Bounds, EdgeStyle, Point, ShapeGeometry } from "../types";
import { buildRoundedBalloonPath } from "./rounded-rect";

export interface ShatterInput {
  body: Bounds;
  lobeBodies?: Bounds[];
  tip: Point | null;
  bend: Point | null;
  attachment: "top" | "right" | "bottom" | "left" | "auto";
  cornerRadius: number;
  edge: EdgeStyle;
}

export function buildShatter(input: ShatterInput): ShapeGeometry {
  const shape = PROFILE.shapes["shatter"];
  const bodies = [input.body, ...(input.lobeBodies ?? [])];
  const path = buildRoundedBalloonPath({
    bodies,
    tip: input.tip,
    bend: input.bend,
    attachment: input.attachment,
    cornerRadius: input.cornerRadius,
    edge: input.edge,
    notchTop: bodies.length === 1,
  });
  return {
    path,
    fill: shape.fill,
    stroke: shape.stroke,
    strokeWidth: shape.strokeWidth,
  };
}
