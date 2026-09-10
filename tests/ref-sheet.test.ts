import { describe, expect, test } from "bun:test";
import {
  REF_SHAPE_IDS,
  REF_TEMPLATES,
  buildRefSheetShape,
  contentBandBox,
  mapTemplatePath,
  isRefShapeId,
  refContentBand,
} from "../src/shapes/ref-sheet";
import { isShapeImplemented } from "../src/profile";
import { buildShape } from "../src/shapes/index";

describe("ref-sheet templates", () => {
  test("nine sheet shapes registered and implemented", () => {
    expect(REF_SHAPE_IDS.length).toBe(9);
    for (const id of REF_SHAPE_IDS) {
      expect(isRefShapeId(id)).toBe(true);
      expect(isShapeImplemented(id)).toBe(true);
      expect(REF_TEMPLATES[id].path.length).toBeGreaterThan(40);
      expect(REF_TEMPLATES[id].path).toContain("Z");
    }
  });

  test("each template maps to a closed path in target bounds", () => {
    const body = { x: 100, y: 80, width: 400, height: 300 };
    for (const id of REF_SHAPE_IDS) {
      const g = buildRefSheetShape(id, body);
      expect(g.path).toMatch(/Z/);
      expect(g.path.startsWith("M ")).toBe(true);
      if (id === "thought") {
        expect((g.path.match(/Z/g) ?? []).length).toBeGreaterThanOrEqual(3);
      } else {
        expect((g.path.match(/Z/g) ?? []).length).toBe(1);
      }
    }
  });

  test("content bands follow the uniformly scaled template instead of the outer frame", () => {
    const frame = { x: 90, y: 70, width: 1008, height: 784 };
    const band = contentBandBox(frame, refContentBand("needle"), "needle");
    // The needle template is narrower than this landscape frame. The old
    // calculation used nearly the full frame width and let text clip through
    // the visible silhouette.
    expect(band.width).toBeLessThan(frame.width * 0.8);
    expect(band.x).toBeGreaterThan(frame.x + frame.width * 0.1);
    expect(band.x + band.width).toBeLessThan(frame.x + frame.width * 0.9);
  });

  test("buildShape routes ref ids to templates", () => {
    const g = buildShape({
      shapeId: "hook",
      body: { x: 0, y: 0, width: 500, height: 400 },
      tip: { x: 200, y: 450 },
      bend: null,
      attachment: "bottom",
    });
    const direct = buildRefSheetShape("hook", {
      x: 0,
      y: 0,
      width: 500,
      height: 400,
    });
    expect(g.path).toEqual(direct.path);
  });

  test("cream hook template exists and is distinct from hook", () => {
    const cream = REF_TEMPLATES["ref-cream-hook"].path;
    const hook = REF_TEMPLATES.hook.path;
    expect(cream).not.toEqual(hook);
    expect(cream).toContain("Z");
    const mapped = mapTemplatePath(cream, [0, 0, 1000, 1000], {
      x: 0,
      y: 0,
      width: 200,
      height: 120,
    });
    expect(mapped.startsWith("M ")).toBe(true);
  });
});
