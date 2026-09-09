import type { Bounds, Point } from "./types";

export function rectsOverlap(a: Bounds, b: Bounds): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

export function boundsInside(inner: Bounds, spaceW: number, spaceH: number): boolean {
  return (
    inner.x >= 0 &&
    inner.y >= 0 &&
    inner.x + inner.width <= spaceW &&
    inner.y + inner.height <= spaceH
  );
}

export function pointInsideBounds(p: Point, b: Bounds): boolean {
  return p.x >= b.x && p.x <= b.x + b.width && p.y >= b.y && p.y <= b.y + b.height;
}

/** Approximate whether a tail segment (start→end via bend) crosses another body */
export function segmentCrossesBounds(a: Point, b: Point, rect: Bounds): boolean {
  // Sample a few points along the quadratic-ish path
  for (let i = 1; i <= 8; i++) {
    const t = i / 9;
    const x = a.x + (b.x - a.x) * t;
    const y = a.y + (b.y - a.y) * t;
    if (pointInsideBounds({ x, y }, rect)) return true;
  }
  return false;
}
