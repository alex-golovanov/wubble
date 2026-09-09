/**
 * human-01 — soft comic balloon via parameterized rounded-rect + open tail.
 * Default cornerRadius=1 (pill). Respects author cornerRadius / edge / lobes.
 */

import { PROFILE } from "../profile";
import type { Bounds, EdgeStyle, Point, ShapeGeometry } from "../types";
import { buildRoundedBalloonPath } from "./rounded-rect";

export interface Human01Input {
  body: Bounds;
  lobeBodies?: Bounds[];
  tip: Point | null;
  bend: Point | null;
  attachment: "top" | "right" | "bottom" | "left" | "auto";
  cornerRadius: number;
  edge: EdgeStyle;
}

export function buildHuman01(input: Human01Input): ShapeGeometry {
  const shape = PROFILE.shapes["human-01"];
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
