/**
 * Universal rounded-rect / pill balloon silhouette.
 *
 * cornerRadius: 0..1 × min(w,h)/2  (0 = sharp rect, 1 = full stadium/pill)
 * edge: smooth | jagged
 *
 * Single closed path with OPEN tail join (no crossbar cutting the tip).
 * Optional chained lobes fuse via open necks into one silhouette.
 */

import { fmt, roundN } from "../normalize";
import type { Bounds, Point } from "../types";

export type EdgeStyle = "smooth" | "jagged";
export type Attachment = "top" | "right" | "bottom" | "left" | "auto";
type Side = "top" | "right" | "bottom" | "left";

export interface RoundedBalloonInput {
  /** Primary + extra chain lobes (any order; sorted top→bottom internally). */
  bodies: Bounds[];
  tip: Point | null;
  bend: Point | null;
  attachment: Attachment;
  /** 0..1 of min(w,h)/2 */
  cornerRadius: number;
  edge: EdgeStyle;
  /** Lightning notch punched into the top edge (speech authoring knob). */
  notchTop?: boolean;
}

function R(n: number): number {
  return roundN(n);
}

function clamp01(n: number): number {
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

export function resolveAttachmentSide(body: Bounds, tip: Point, attachment: Attachment): Side {
  if (attachment !== "auto") return attachment;
  const cx = body.x + body.width / 2;
  const cy = body.y + body.height / 2;
  const dx = tip.x - cx;
  const dy = tip.y - cy;
  if (Math.abs(dx) > Math.abs(dy)) return dx >= 0 ? "right" : "left";
  return dy >= 0 ? "bottom" : "top";
}

function radiusPx(body: Bounds, cornerRadius: number, edge: EdgeStyle): number {
  const t = clamp01(cornerRadius);
  let r = (Math.min(body.width, body.height) / 2) * t;
  if (edge === "jagged") {
    r = Math.min(r, Math.min(body.width, body.height) * 0.035);
  }
  return Math.min(r, body.width / 2, body.height / 2);
}

function tailHalfWidth(body: Bounds): number {
  return Math.max(10, Math.min(body.width, body.height) * 0.11);
}

/** Join points on attachment edge. `first`/`second` are in clockwise outline order. */
function joinClockwise(
  body: Bounds,
  side: Side,
  tip: Point,
): { first: Point; second: Point; mid: Point } {
  const hw = tailHalfWidth(body);
  const cx = body.x + body.width / 2;
  const cy = body.y + body.height / 2;
  switch (side) {
    case "bottom": {
      const ideal = Math.max(body.x + hw + 4, Math.min(body.x + body.width - hw - 4, tip.x));
      const midX = ideal * 0.65 + cx * 0.35;
      const y = body.y + body.height;
      return {
        first: { x: midX + hw, y }, // right (hit first clockwise)
        second: { x: midX - hw, y }, // left
        mid: { x: midX, y },
      };
    }
    case "top": {
      const ideal = Math.max(body.x + hw + 4, Math.min(body.x + body.width - hw - 4, tip.x));
      const midX = ideal * 0.65 + cx * 0.35;
      const y = body.y;
      // Clockwise top edge runs left → right.
      return {
        first: { x: midX - hw, y },
        second: { x: midX + hw, y },
        mid: { x: midX, y },
      };
    }
    case "right": {
      const ideal = Math.max(body.y + hw + 4, Math.min(body.y + body.height - hw - 4, tip.y));
      const midY = ideal * 0.65 + cy * 0.35;
      const x = body.x + body.width;
      // Clockwise on right: top → bottom. first=upper, second=lower
      return {
        first: { x, y: midY - hw },
        second: { x, y: midY + hw },
        mid: { x, y: midY },
      };
    }
    case "left": {
      const ideal = Math.max(body.y + hw + 4, Math.min(body.y + body.height - hw - 4, tip.y));
      const midY = ideal * 0.65 + cy * 0.35;
      const x = body.x;
      // Clockwise on left: bottom → top. first=lower, second=upper
      return {
        first: { x, y: midY + hw },
        second: { x, y: midY - hw },
        mid: { x, y: midY },
      };
    }
  }
}

type Cmd =
  | { t: "M"; p: Point }
  | { t: "L"; p: Point }
  | { t: "Q"; c: Point; p: Point }
  | { t: "A"; r: number; p: Point; sweep: 0 | 1 };

function emit(cmds: Cmd[]): string {
  const parts: string[] = [];
  for (const c of cmds) {
    if (c.t === "M") parts.push(`M ${fmt(R(c.p.x))} ${fmt(R(c.p.y))}`);
    else if (c.t === "L") parts.push(`L ${fmt(R(c.p.x))} ${fmt(R(c.p.y))}`);
    else if (c.t === "Q")
      parts.push(`Q ${fmt(R(c.c.x))} ${fmt(R(c.c.y))} ${fmt(R(c.p.x))} ${fmt(R(c.p.y))}`);
    else
      parts.push(
        `A ${fmt(R(c.r))} ${fmt(R(c.r))} 0 0 ${c.sweep} ${fmt(R(c.p.x))} ${fmt(R(c.p.y))}`,
      );
  }
  parts.push("Z");
  return parts.join(" ");
}

function pushSmoothTail(
  cmds: Cmd[],
  enter: Point,
  tip: Point,
  exit: Point,
  bend: Point | null,
  mid: Point,
): void {
  const reach = Math.hypot(tip.x - mid.x, tip.y - mid.y);
  // Keep a fat comic hook near the body; only the last third tapers hard.
  const near = Math.min(0.38, 55 / Math.max(reach, 1));
  const kink = bend ?? {
    x: mid.x + (tip.x - mid.x) * Math.max(0.32, near),
    y: mid.y + (tip.y - mid.y) * Math.max(0.32, near),
  };
  // Side control points stay wide (near enter/exit) so the join reads open and stubby
  const c1 = {
    x: enter.x * 0.55 + kink.x * 0.45,
    y: enter.y * 0.55 + kink.y * 0.45,
  };
  const c2 = {
    x: exit.x * 0.55 + kink.x * 0.45,
    y: exit.y * 0.55 + kink.y * 0.45,
  };
  cmds.push({ t: "Q", c: c1, p: tip });
  cmds.push({ t: "Q", c: c2, p: exit });
}

function pushJaggedTail(
  cmds: Cmd[],
  enter: Point,
  tip: Point,
  exit: Point,
  bend: Point | null,
  mid: Point,
): void {
  const kink = bend ?? {
    x: mid.x + (tip.x - mid.x) * 0.4,
    y: mid.y + (tip.y - mid.y) * 0.4,
  };
  cmds.push({
    t: "L",
    p: {
      x: kink.x + (enter.x - mid.x) * 0.3,
      y: kink.y + (enter.y - mid.y) * 0.3,
    },
  });
  cmds.push({ t: "L", p: tip });
  cmds.push({
    t: "L",
    p: {
      x: kink.x + (exit.x - mid.x) * 0.3,
      y: kink.y + (exit.y - mid.y) * 0.3,
    },
  });
  cmds.push({ t: "L", p: exit });
}

function pushTail(
  cmds: Cmd[],
  enter: Point,
  tip: Point,
  exit: Point,
  bend: Point | null,
  mid: Point,
  edge: EdgeStyle,
): void {
  if (edge === "jagged") pushJaggedTail(cmds, enter, tip, exit, bend, mid);
  else pushSmoothTail(cmds, enter, tip, exit, bend, mid);
}

function jagPoints(from: Point, to: Point, amp: number, steps: number): Point[] {
  const out: Point[] = [];
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * amp;
  const ny = (dx / len) * amp;
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const wave = i % 2 === 0 ? 1 : -1;
    out.push({
      x: from.x + dx * t + nx * wave,
      y: from.y + dy * t + ny * wave,
    });
  }
  return out;
}

function edgeTo(cmds: Cmd[], from: Point, to: Point, edge: EdgeStyle, body: Bounds): void {
  if (edge === "jagged") {
    const amp = Math.min(body.width, body.height) * 0.045;
    for (const p of jagPoints(from, to, amp, 5)) cmds.push({ t: "L", p });
  }
  cmds.push({ t: "L", p: to });
}

function arcCorner(cmds: Cmd[], r: number, to: Point): void {
  if (r < 0.5) cmds.push({ t: "L", p: to });
  else cmds.push({ t: "A", r, p: to, sweep: 1 });
}

/**
 * Single body + open tail. Clockwise from top-left flat.
 */
function singleBodyPath(
  body: Bounds,
  tip: Point | null,
  bend: Point | null,
  attachment: Attachment,
  cornerRadius: number,
  edge: EdgeStyle,
  notchTop = false,
): string {
  const rr = radiusPx(body, cornerRadius, edge);
  const x0 = body.x;
  const y0 = body.y;
  const x1 = body.x + body.width;
  const y1 = body.y + body.height;

  const side = tip ? resolveAttachmentSide(body, tip, attachment) : null;
  const join = tip && side ? joinClockwise(body, side, tip) : null;

  const cmds: Cmd[] = [];
  cmds.push({ t: "M", p: { x: x0 + rr, y: y0 } });

  // TOP (L→R)
  if (side === "top" && join && tip) {
    edgeTo(cmds, { x: x0 + rr, y: y0 }, join.first, edge, body);
    pushTail(cmds, join.first, tip, join.second, bend, join.mid, edge);
    edgeTo(cmds, join.second, { x: x1 - rr, y: y0 }, edge, body);
  } else if (notchTop) {
    const nx = body.x + body.width * 0.62;
    const d = Math.min(body.width, body.height) * 0.12;
    edgeTo(cmds, { x: x0 + rr, y: y0 }, { x: nx, y: y0 }, edge, body);
    cmds.push({ t: "L", p: { x: nx + d * 0.35, y: y0 + d } });
    cmds.push({ t: "L", p: { x: nx - d * 0.15, y: y0 + d * 0.55 } });
    cmds.push({ t: "L", p: { x: nx + d * 0.55, y: y0 + d * 1.35 } });
    cmds.push({ t: "L", p: { x: nx + d * 0.15, y: y0 + d * 0.7 } });
    cmds.push({ t: "L", p: { x: nx + d * 0.9, y: y0 } });
    edgeTo(cmds, { x: nx + d * 0.9, y: y0 }, { x: x1 - rr, y: y0 }, edge, body);
  } else {
    edgeTo(cmds, { x: x0 + rr, y: y0 }, { x: x1 - rr, y: y0 }, edge, body);
  }
  arcCorner(cmds, rr, { x: x1, y: y0 + rr });

  // RIGHT (T→B)
  if (side === "right" && join && tip) {
    edgeTo(cmds, { x: x1, y: y0 + rr }, join.first, edge, body);
    pushTail(cmds, join.first, tip, join.second, bend, join.mid, edge);
    edgeTo(cmds, join.second, { x: x1, y: y1 - rr }, edge, body);
  } else {
    edgeTo(cmds, { x: x1, y: y0 + rr }, { x: x1, y: y1 - rr }, edge, body);
  }
  arcCorner(cmds, rr, { x: x1 - rr, y: y1 });

  // BOTTOM (R→L)
  if (side === "bottom" && join && tip) {
    edgeTo(cmds, { x: x1 - rr, y: y1 }, join.first, edge, body);
    pushTail(cmds, join.first, tip, join.second, bend, join.mid, edge);
    edgeTo(cmds, join.second, { x: x0 + rr, y: y1 }, edge, body);
  } else {
    edgeTo(cmds, { x: x1 - rr, y: y1 }, { x: x0 + rr, y: y1 }, edge, body);
  }
  arcCorner(cmds, rr, { x: x0, y: y1 - rr });

  // LEFT (B→T)
  if (side === "left" && join && tip) {
    edgeTo(cmds, { x: x0, y: y1 - rr }, join.first, edge, body);
    pushTail(cmds, join.first, tip, join.second, bend, join.mid, edge);
    edgeTo(cmds, join.second, { x: x0, y: y0 + rr }, edge, body);
  } else {
    edgeTo(cmds, { x: x0, y: y1 - rr }, { x: x0, y: y0 + rr }, edge, body);
  }
  arcCorner(cmds, rr, { x: x0 + rr, y: y0 });

  return emit(cmds);
}

/**
 * Vertically stacked chain — open necks, one outline, tail on closest lobe.
 */
function chainedPath(
  bodiesIn: Bounds[],
  tip: Point | null,
  bend: Point | null,
  attachment: Attachment,
  cornerRadius: number,
  edge: EdgeStyle,
): string {
  const lobes = [...bodiesIn].sort((a, b) => a.y + a.height / 2 - (b.y + b.height / 2));
  if (lobes.length === 1) {
    return singleBodyPath(lobes[0]!, tip, bend, attachment, cornerRadius, edge);
  }

  let tailIdx = lobes.length - 1;
  if (tip) {
    let best = Infinity;
    for (let i = 0; i < lobes.length; i++) {
      const b = lobes[i]!;
      const d = Math.hypot(tip.x - (b.x + b.width / 2), tip.y - (b.y + b.height / 2));
      if (d < best) {
        best = d;
        tailIdx = i;
      }
    }
  }

  const rOf = (b: Bounds) => radiusPx(b, cornerRadius, edge);
  const neckHalf = (a: Bounds, b: Bounds) => Math.max(14, Math.min(a.width, b.width) * 0.22);

  type Neck = { mid: number; half: number; yTop: number; yBot: number };
  const necks: Neck[] = [];
  for (let i = 0; i < lobes.length - 1; i++) {
    const a = lobes[i]!;
    const b = lobes[i + 1]!;
    let yTop = a.y + a.height;
    let yBot = b.y;
    // Layout expand can close the authored gap — keep a readable neck band
    if (yBot < yTop + 12) {
      const midY = (yTop + yBot) / 2;
      yTop = midY - 6;
      yBot = midY + 6;
    }
    necks.push({
      mid: (a.x + a.width / 2 + b.x + b.width / 2) / 2,
      half: Math.max(neckHalf(a, b), Math.min(a.width, b.width) * 0.2),
      yTop,
      yBot,
    });
  }

  const cmds: Cmd[] = [];
  const top = lobes[0]!;
  const rTop = rOf(top);

  // Start top-left of top lobe
  cmds.push({ t: "M", p: { x: top.x + rTop, y: top.y } });

  // Top edge (+ optional top tail)
  if (tailIdx === 0 && tip) {
    const side = resolveAttachmentSide(top, tip, attachment);
    if (side === "top") {
      const j = joinClockwise(top, side, tip);
      edgeTo(cmds, { x: top.x + rTop, y: top.y }, j.first, edge, top);
      pushTail(cmds, j.first, tip, j.second, bend, j.mid, edge);
      edgeTo(cmds, j.second, { x: top.x + top.width - rTop, y: top.y }, edge, top);
    } else {
      edgeTo(
        cmds,
        { x: top.x + rTop, y: top.y },
        { x: top.x + top.width - rTop, y: top.y },
        edge,
        top,
      );
    }
  } else {
    edgeTo(
      cmds,
      { x: top.x + rTop, y: top.y },
      { x: top.x + top.width - rTop, y: top.y },
      edge,
      top,
    );
  }
  arcCorner(cmds, rTop, { x: top.x + top.width, y: top.y + rTop });

  // RIGHT descent through all lobes
  for (let i = 0; i < lobes.length; i++) {
    const b = lobes[i]!;
    const r = rOf(b);

    // Vertical right edge of this lobe
    if (i > 0) {
      // Arrive at top edge via neck; go to top-right corner and arc down
      const n = necks[i - 1]!;
      edgeTo(cmds, { x: n.mid + n.half, y: n.yBot }, { x: b.x + b.width - r, y: b.y }, edge, b);
      arcCorner(cmds, r, { x: b.x + b.width, y: b.y + r });
    }

    const rightTop = { x: b.x + b.width, y: b.y + r };
    const rightBot = { x: b.x + b.width, y: b.y + b.height - r };

    if (i === tailIdx && tip && resolveAttachmentSide(b, tip, attachment) === "right") {
      const j = joinClockwise(b, "right", tip);
      edgeTo(cmds, rightTop, j.first, edge, b);
      pushTail(cmds, j.first, tip, j.second, bend, j.mid, edge);
      edgeTo(cmds, j.second, rightBot, edge, b);
    } else {
      edgeTo(cmds, i === 0 ? rightTop : rightTop, rightBot, edge, b);
    }

    if (i < lobes.length - 1) {
      arcCorner(cmds, r, { x: b.x + b.width - r, y: b.y + b.height });
      const n = necks[i]!;
      edgeTo(
        cmds,
        { x: b.x + b.width - r, y: b.y + b.height },
        { x: n.mid + n.half, y: n.yTop },
        edge,
        b,
      );
      // Neck right side down (concave scoop into neck)
      cmds.push({
        t: "Q",
        c: { x: n.mid + n.half + 8, y: (n.yTop + n.yBot) / 2 },
        p: { x: n.mid + n.half, y: n.yBot },
      });
    } else {
      arcCorner(cmds, r, { x: b.x + b.width - r, y: b.y + b.height });
    }
  }

  // BOTTOM of last lobe
  {
    const b = lobes[lobes.length - 1]!;
    const r = rOf(b);
    const bottomRight = { x: b.x + b.width - r, y: b.y + b.height };
    const bottomLeft = { x: b.x + r, y: b.y + b.height };

    if (
      tailIdx === lobes.length - 1 &&
      tip &&
      resolveAttachmentSide(b, tip, attachment) === "bottom"
    ) {
      const j = joinClockwise(b, "bottom", tip);
      edgeTo(cmds, bottomRight, j.first, edge, b);
      pushTail(cmds, j.first, tip, j.second, bend, j.mid, edge);
      edgeTo(cmds, j.second, bottomLeft, edge, b);
    } else {
      edgeTo(cmds, bottomRight, bottomLeft, edge, b);
    }
    arcCorner(cmds, r, { x: b.x, y: b.y + b.height - r });
  }

  // LEFT ascent through all lobes
  for (let i = lobes.length - 1; i >= 0; i--) {
    const b = lobes[i]!;
    const r = rOf(b);
    const leftBot = { x: b.x, y: b.y + b.height - r };
    const leftTop = { x: b.x, y: b.y + r };

    if (i === tailIdx && tip && resolveAttachmentSide(b, tip, attachment) === "left") {
      const j = joinClockwise(b, "left", tip);
      edgeTo(cmds, leftBot, j.first, edge, b);
      pushTail(cmds, j.first, tip, j.second, bend, j.mid, edge);
      edgeTo(cmds, j.second, leftTop, edge, b);
    } else {
      edgeTo(cmds, leftBot, leftTop, edge, b);
    }

    if (i > 0) {
      arcCorner(cmds, r, { x: b.x + r, y: b.y });
      const n = necks[i - 1]!;
      edgeTo(cmds, { x: b.x + r, y: b.y }, { x: n.mid - n.half, y: n.yBot }, edge, b);
      // Neck left side up
      const prev = lobes[i - 1]!;
      cmds.push({
        t: "Q",
        c: { x: n.mid - n.half - 6, y: (n.yTop + n.yBot) / 2 },
        p: { x: n.mid - n.half, y: n.yTop },
      });
      const pr = rOf(prev);
      edgeTo(
        cmds,
        { x: n.mid - n.half, y: n.yTop },
        { x: prev.x + pr, y: prev.y + prev.height },
        edge,
        prev,
      );
      arcCorner(cmds, pr, { x: prev.x, y: prev.y + prev.height - pr });
    } else {
      arcCorner(cmds, r, { x: b.x + r, y: b.y });
    }
  }

  return emit(cmds);
}

export function buildRoundedBalloonPath(input: RoundedBalloonInput): string {
  const bodies = input.bodies.filter((b) => b.width > 0 && b.height > 0);
  if (bodies.length === 0) return "M 0 0 Z";
  if (bodies.length === 1) {
    return singleBodyPath(
      bodies[0]!,
      input.tip,
      input.bend,
      input.attachment,
      input.cornerRadius,
      input.edge,
      Boolean(input.notchTop),
    );
  }
  return chainedPath(
    bodies,
    input.tip,
    input.bend,
    input.attachment,
    input.cornerRadius,
    input.edge,
  );
}

/** Explicit endpoint/control samples from a path (for unit tests). */
export function pathHasPointNear(path: string, x: number, y: number, tol = 1.5): boolean {
  const re = /(-?\d+\.\d+|-?\d+)/g;
  const nums: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(path))) nums.push(Number(m[1]));
  // Scan consecutive pairs — false positives possible with arc radii, so also
  // check known command forms.
  for (let i = 0; i + 1 < nums.length; i++) {
    if (Math.abs(nums[i]! - x) <= tol && Math.abs(nums[i + 1]! - y) <= tol) {
      return true;
    }
  }
  return false;
}

/**
 * Effective lettering insets for a rounded/jagged body.
 * Padding policy stays the same; corners (and jagged teeth) reduce usable area.
 * When radius=0 and smooth, returns the input pads unchanged (jagged still adds amp).
 */
export function contentInsetsForRoundedBody(
  bodyW: number,
  bodyH: number,
  padX: number,
  padY: number,
  cornerRadius: number,
  edge: EdgeStyle,
): { padX: number; padY: number } {
  const r = radiusPx({ x: 0, y: 0, width: bodyW, height: bodyH }, cornerRadius, edge);
  const jag = edge === "jagged" ? Math.min(bodyW, bodyH) * 0.045 : 0;
  let ix = Math.max(padX, jag);
  let iy = Math.max(padY, jag);
  if (r > 0.5) {
    // Inset so the content-box corner lies on/inside the quarter-circle (45° clearance).
    const clear = r * (1 - Math.SQRT1_2);
    ix = Math.max(ix, clear);
    iy = Math.max(iy, clear);
    if (ix < r && iy < r && (ix - r) ** 2 + (iy - r) ** 2 > r * r + 1e-6) {
      const ixNeed = r - Math.sqrt(Math.max(0, r * r - (iy - r) ** 2));
      const iyNeed = r - Math.sqrt(Math.max(0, r * r - (ix - r) ** 2));
      if (ixNeed - ix <= iyNeed - iy) ix = Math.max(ix, ixNeed);
      else iy = Math.max(iy, iyNeed);
    }
  }
  return { padX: R(ix), padY: R(iy) };
}

export function defaultCornerRadius(_shapeId: string): number {
  // speech (+ any future rounded-rect) defaults to full pill; ref shapes ignore.
  return 1;
}

export function defaultEdge(_shapeId: string): EdgeStyle {
  return "smooth";
}
