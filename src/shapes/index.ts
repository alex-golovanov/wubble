import type { Bounds, EdgeStyle, Point, ShapeGeometry, ShapeId } from "../types";
import { buildHuman01 } from "./human-01";
import { buildGlitch01 } from "./glitch-01";
import { buildGlitchBreaking01 } from "./glitch-breaking-01";
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
}

export function resolveStyle(
  shapeId: ShapeId,
  cornerRadius?: number,
  edge?: EdgeStyle,
): { cornerRadius: number; edge: EdgeStyle } {
  return {
    cornerRadius:
      cornerRadius != null
        ? Math.max(0, Math.min(1, cornerRadius))
        : defaultCornerRadius(shapeId),
    edge: edge ?? defaultEdge(shapeId),
  };
}

export function buildShape(input: ShapeBuildInput): ShapeGeometry {
  if (isRefShapeId(input.shapeId)) {
    return buildRefSheetShape(input.shapeId, input.body, input.lobeBodies ?? []);
  }
  const style = resolveStyle(input.shapeId, input.cornerRadius, input.edge);
  const common = {
    body: input.body,
    lobeBodies: input.lobeBodies ?? [],
    tip: input.tip,
    bend: input.bend,
    attachment: input.attachment,
    cornerRadius: style.cornerRadius,
    edge: style.edge,
  };
  switch (input.shapeId) {
    case "human-01":
      return buildHuman01(common);
    case "glitch-01":
      return buildGlitch01(common);
    case "glitch-breaking-01":
      return buildGlitchBreaking01(common);
    default: {
      const _exhaustive: never = input.shapeId;
      return _exhaustive;
    }
  }
}
