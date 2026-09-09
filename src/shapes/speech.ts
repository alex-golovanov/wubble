/**
 * speech — parametric rounded-rect / pill balloon + open tail.
 * Defaults: cornerRadius=1, edge=smooth, notchTop=false.
 * Appearance (fill/stroke/strokeWidth) from PROFILE unless overridden.
 */

import { PROFILE } from "../profile";
import type { Bounds, EdgeStyle, Point, ShapeGeometry } from "../types";
import { buildRoundedBalloonPath } from "./rounded-rect";

export interface SpeechInput {
  body: Bounds;
  lobeBodies?: Bounds[];
  tip: Point | null;
  bend: Point | null;
  attachment: "top" | "right" | "bottom" | "left" | "auto";
  cornerRadius: number;
  edge: EdgeStyle;
  /** Lightning notch on top edge (ignored for multi-lobe chains by the path builder). */
  notchTop?: boolean;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
}

export function buildSpeech(input: SpeechInput): ShapeGeometry {
  const shape = PROFILE.shapes.speech;
  const bodies = [input.body, ...(input.lobeBodies ?? [])];
  const path = buildRoundedBalloonPath({
    bodies,
    tip: input.tip,
    bend: input.bend,
    attachment: input.attachment,
    cornerRadius: input.cornerRadius,
    edge: input.edge,
    notchTop: Boolean(input.notchTop),
  });
  return {
    path,
    fill: input.fill ?? shape.fill,
    stroke: input.stroke ?? shape.stroke,
    strokeWidth: input.strokeWidth ?? shape.strokeWidth,
  };
}
