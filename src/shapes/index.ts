import type { Bounds, EdgeStyle, Point, ShapeGeometry, ShapeId } from "../types";
import { buildSpeech } from "./speech";
import { buildRefSheetShape, isRefShapeId } from "./ref-sheet";
import { defaultCornerRadius, defaultEdge } from "./rounded-rect";

export interface ShapeBuildInput {
  shapeId: ShapeId;
  body: Bounds;
  /** Extra chain lobe bodies (already fitted), excluding primary `body`. */
  lobeBodies?: Bounds[];
  tip: Point | null;
  bend: Point | null;
  attachment: "top" | "right" | "bottom" | "left" | "auto";
  cornerRadius?: number;
  edge?: EdgeStyle;
  notchTop?: boolean;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
}

export function resolveStyle(
  shapeId: ShapeId,
  cornerRadius?: number,
  edge?: EdgeStyle,
): { cornerRadius: number; edge: EdgeStyle } {
  return {
    cornerRadius:
      cornerRadius != null ? Math.max(0, Math.min(1, cornerRadius)) : defaultCornerRadius(shapeId),
    edge: edge ?? defaultEdge(shapeId),
  };
}

export function buildShape(input: ShapeBuildInput): ShapeGeometry {
  if (isRefShapeId(input.shapeId)) {
    return buildRefSheetShape(input.shapeId, input.body, input.lobeBodies ?? []);
  }
  const style = resolveStyle(input.shapeId, input.cornerRadius, input.edge);
  // Rounded-rect family is a single public shape: speech.
  return buildSpeech({
    body: input.body,
    lobeBodies: input.lobeBodies ?? [],
    tip: input.tip,
    bend: input.bend,
    attachment: input.attachment,
    cornerRadius: style.cornerRadius,
    edge: style.edge,
    ...(input.notchTop !== undefined ? { notchTop: input.notchTop } : {}),
    ...(input.fill !== undefined ? { fill: input.fill } : {}),
    ...(input.stroke !== undefined ? { stroke: input.stroke } : {}),
    ...(input.strokeWidth !== undefined ? { strokeWidth: input.strokeWidth } : {}),
  });
}
