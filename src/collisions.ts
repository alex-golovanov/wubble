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

/**
 * How far a point lies outside a balloon body; 0 when it is inside. A tail
 * shorter than a quarter of the balloon's short side reads as a bump in the
 * outline, not as a pointer to a speaker.
 */
export function distanceOutside(p: Point, b: Bounds): number {
  const dx = Math.max(b.x - p.x, 0, p.x - (b.x + b.width));
  const dy = Math.max(b.y - p.y, 0, p.y - (b.y + b.height));
  return Math.hypot(dx, dy);
}
