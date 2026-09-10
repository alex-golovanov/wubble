import { expect } from "bun:test";
import type { FittedText, RenderResult } from "../src/types";

/** Narrow a successful render SVG without non-null assertions. */
export function requireSvg(result: RenderResult): string {
  expect(result.svg).not.toBeNull();
  if (result.svg === null) {
    throw new Error("expected svg");
  }
  return result.svg;
}

/** Narrow a successful fit result without non-null assertions. */
export function requireFitted(fitted: FittedText | null | undefined): FittedText {
  expect(fitted).not.toBeNull();
  if (fitted == null) {
    throw new Error("expected fitted text");
  }
  return fitted;
}
