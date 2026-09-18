/**
 * drawn — an inked oval or pillow shaped around its text, with a drawn tail.
 *
 * The body is a superellipse around the lines of text: one line gives an
 * oval, a block of text a pillow. It is drawn as two filled paths — the ink
 * (the body grown by a line that swells and thins) and the fill on top of it —
 * so the fill hides the seam where the tail enters the body.
 *
 * Every small difference between two balloons comes from one seed, so a
 * balloon always draws itself the same way.
 */

import { fontVerticalMetrics, measureWidth } from "../font";
import { fmt } from "../normalize";
import type { Bounds, FontId, Point, TailMood } from "../types";
import { at } from "../util";

export interface DrawnText {
  lines: string[];
  fontSize: number;
  lineHeight: number;
  fontId: FontId;
}

export interface DrawnSpec {
  center: Point;
  text: DrawnText;
  seed: number;
  strokeWidth: number;
  tip: Point | null;
  bend: Point | null;
  mood: TailMood;
}

export interface DrawnTail {
  /** Spine: a cubic from inside the body to the tip. */
  start: Point;
  c1: Point;
  c2: Point;
  tip: Point;
  /** Half the tail's width where it leaves the body. */
  throat: number;
}

export interface DrawnBalloon {
  exponent: number;
  a: number;
  b: number;
  /** Body outline, sampled clockwise. */
  body: Point[];
  ink: string;
  fill: string;
  /** The body's ink extent; the tail is not included. */
  bounds: Bounds;
  tail: DrawnTail | null;
}

const TAU = Math.PI * 2;
/** Outline samples; every PATH_STEP-th becomes a curve point in the SVG. */
const SAMPLES = 360;
const PATH_STEP = 5;
const TAIL_SAMPLES = 24;
/** Light from the top left: the line is heavier on the far side. */
const LIGHT: Point = { x: 0.6, y: 0.8 };
const SWELL = 0.45;

interface MoodShape {
  /** Throat width, relative to a calm tail. */
  throat: number;
  /** 0: leaves straight at the speaker. 1: leaves square to the edge. */
  lean: number;
  /** Sideways bow, as a share of the reach. */
  sway: number;
  /** Width falls as (1 − t)^taper: above 1 a sharp dart, below 1 a fuller tail. */
  taper: number;
}

const MOODS: Record<TailMood, MoodShape> = {
  calm: { throat: 1, lean: 0.42, sway: 0.03, taper: 1 },
  urgent: { throat: 1.5, lean: 0, sway: 0, taper: 1.9 },
  hesitant: { throat: 0.6, lean: 0.3, sway: 0.16, taper: 0.75 },
};

const add = (a: Point, b: Point): Point => ({ x: a.x + b.x, y: a.y + b.y });
const sub = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y });
const mul = (a: Point, k: number): Point => ({ x: a.x * k, y: a.y * k });
const dot = (a: Point, b: Point): number => a.x * b.x + a.y * b.y;
const unit = (a: Point): Point => mul(a, 1 / (Math.hypot(a.x, a.y) || 1));

/** A stable number in [0, 1) for one balloon: its id and the text it renders. */
export function drawnSeed(id: string, text: string): number {
  let h = 0x811c9dc5;
  for (const ch of `${id}\u0000${text}`) {
    h = Math.imul(h ^ (ch.codePointAt(0) ?? 0), 0x01000193);
  }
  return (h >>> 0) / 4294967296;
}

/** An independent number in [0, 1) drawn from the seed for one purpose. */
function part(seed: number, purpose: number): number {
  let h = Math.imul(Math.floor(seed * 4294967296) ^ Math.imul(purpose, 0x9e3779b1), 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** A symmetric offset in [−span, span] from the seed. */
function jitter(seed: number, purpose: number, span: number): number {
  return (part(seed, purpose) - 0.5) * 2 * span;
}

/** Superellipse exponent: an oval for one line, a pillow for a block of text. */
export function drawnExponent(lineCount: number, seed: number): number {
  return 2.2 + 0.7 * Math.min(1, Math.max(0, (lineCount - 1) / 2)) + jitter(seed, 1, 0.15);
}

/** The smallest body axes that hold every padded line box. */
export function drawnAxes(
  lineWidths: number[],
  lineHeight: number,
  fontSize: number,
  exponent: number,
): { a: number; b: number } {
  const padX = fontSize * 0.42;
  const padY = padX * 0.55;
  const blockH = lineWidths.length * lineHeight;
  const corners: Point[] = [];
  lineWidths.forEach((w, i) => {
    const x = w / 2 + padX;
    corners.push({ x, y: Math.abs(i * lineHeight - blockH / 2 - padY) });
    corners.push({ x, y: Math.abs((i + 1) * lineHeight - blockH / 2 + padY) });
  });
  const halfW = Math.max(...corners.map((p) => p.x));
  const halfH = Math.max(...corners.map((p) => p.y));
  const aspect = halfW / halfH;
  const holds = (s: number): boolean =>
    corners.every((p) => (p.x / (s * aspect)) ** exponent + (p.y / s) ** exponent <= 1);
  let lo = halfH;
  let hi = halfH * 3;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (holds(mid)) hi = mid;
    else lo = mid;
  }
  return { a: hi * aspect, b: hi * 1.04 };
}

/**
 * Break text into the lines that give the smallest balloon. A body much wider
 * than tall, or taller than wide, pays for its shape. Explicit newlines are
 * kept as written.
 */
export function drawnLines(text: string, fontSize: number, fontId: FontId, seed: number): string[] {
  if (text.includes("\n")) return text.split("\n");
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length < 2) return [text];
  const widths = new Map<string, number>();
  const widthOf = (line: string): number => {
    const known = widths.get(line);
    if (known !== undefined) return known;
    const w = measureWidth(line, fontSize, fontId);
    widths.set(line, w);
    return w;
  };
  const lineHeight = fontVerticalMetrics(fontSize, fontId).lineHeight;
  let best: string[] = [text];
  let bestScore = Infinity;
  for (let n = 1; n <= Math.min(4, words.length); n++) {
    for (const lines of splits(words, n)) {
      const { a, b } = drawnAxes(lines.map(widthOf), lineHeight, fontSize, drawnExponent(n, seed));
      const ratio = a / b;
      const shape = ratio > 2.4 ? (ratio / 2.4) ** 2 : ratio < 1.3 ? (1.3 / ratio) ** 2 : 1;
      const score = a * b * shape;
      if (score < bestScore) {
        best = lines;
        bestScore = score;
      }
    }
  }
  return best;
}

/** Every way to break the words into n lines, in order. */
function splits(words: string[], n: number): string[][] {
  if (n === 1) return [[words.join(" ")]];
  const out: string[][] = [];
  for (let i = 1; i <= words.length - n + 1; i++) {
    const head = words.slice(0, i).join(" ");
    for (const rest of splits(words.slice(i), n - 1)) out.push([head, ...rest]);
  }
  return out;
}

/** Line weight where the outline faces `normal`: `strokeWidth` on average. */
export function inkWeight(normal: Point, strokeWidth: number): number {
  return strokeWidth * (1 + SWELL * dot(normal, unit(LIGHT)));
}

function outline(center: Point, a: number, b: number, n: number, seed: number): Point[] {
  const tilt = jitter(seed, 2, 0.025);
  const phase1 = part(seed, 3) * TAU;
  const phase2 = part(seed, 4) * TAU;
  const cos = Math.cos(tilt);
  const sin = Math.sin(tilt);
  const pts: Point[] = [];
  for (let i = 0; i < SAMPLES; i++) {
    const t = (i / SAMPLES) * TAU;
    const c = Math.cos(t);
    const s = Math.sin(t);
    const r = 1 + 0.012 * (0.6 * Math.sin(2 * t + phase1) + 0.4 * Math.sin(3 * t + phase2));
    const x = a * Math.sign(c) * Math.abs(c) ** (2 / n) * r;
    const y = b * Math.sign(s) * Math.abs(s) ** (2 / n) * r;
    pts.push({ x: center.x + x * cos - y * sin, y: center.y + x * sin + y * cos });
  }
  return pts;
}

/** Outward normal of a clockwise outline (y down) at sample i. */
function normalAt(pts: Point[], i: number): Point {
  const n = pts.length;
  const tangent = unit(sub(at(pts, (i + 1) % n), at(pts, (i - 1 + n) % n)));
  return { x: tangent.y, y: -tangent.x };
}

function cubicAt(p0: Point, c1: Point, c2: Point, p3: Point, t: number): Point {
  const u = 1 - t;
  return {
    x: u * u * u * p0.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * p3.y,
  };
}

function pt(p: Point): string {
  return `${fmt(p.x)} ${fmt(p.y)}`;
}

/** Catmull-Rom through the points as cubic Béziers, starting from the current point. */
function curveThrough(run: Point[], closed: boolean): string {
  const n = run.length;
  const get = (i: number): Point => {
    if (closed) return at(run, ((i % n) + n) % n);
    return at(run, Math.max(0, Math.min(n - 1, i)));
  };
  const parts: string[] = [];
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = get(i - 1);
    const p1 = get(i);
    const p2 = get(i + 1);
    const p3 = get(i + 2);
    const c1 = add(p1, mul(sub(p2, p0), 1 / 6));
    const c2 = sub(p2, mul(sub(p3, p1), 1 / 6));
    parts.push(`C ${pt(c1)} ${pt(c2)} ${pt(p2)}`);
  }
  return parts.join(" ");
}

function closedCurve(pts: Point[]): string {
  return `M ${pt(at(pts, 0))} ${curveThrough(pts, true)} Z`;
}

/** Two open runs meeting at a sharp point: out along the first, back along the second. */
function pointedCurve(out: Point[], back: Point[]): string {
  return `M ${pt(at(out, 0))} ${curveThrough(out, false)} ${curveThrough(back, false)} Z`;
}

/** Twice the signed area; positive for a clockwise outline in y-down space. */
function area(pts: Point[]): number {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = at(pts, i);
    const q = at(pts, (i + 1) % pts.length);
    s += p.x * q.y - q.x * p.y;
  }
  return s;
}

/** Orient a pointed shape clockwise, so the nonzero rule unions it with the body. */
function clockwise(out: Point[], back: Point[]): [Point[], Point[]] {
  if (area([...out, ...back.slice(1)]) >= 0) return [out, back];
  return [[...back].reverse(), [...out].reverse()];
}

function bounds(pts: Point[]): Bounds {
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const x = Math.min(...xs) - 1;
  const y = Math.min(...ys) - 1;
  return { x, y, width: Math.max(...xs) + 1 - x, height: Math.max(...ys) + 1 - y };
}

interface TailParts {
  spine: DrawnTail;
  fill: [Point[], Point[]];
  ink: [Point[], Point[]];
}

function drawTail(
  body: Point[],
  center: Point,
  a: number,
  b: number,
  spec: DrawnSpec,
  tip: Point,
): TailParts {
  const { seed, strokeWidth } = spec;
  // The tail leaves where the line from the centre to the tip crosses the outline.
  const toward = unit(sub(tip, center));
  let attach = 0;
  let best = -Infinity;
  body.forEach((p, i) => {
    const d = dot(unit(sub(p, center)), toward);
    if (d > best) {
      best = d;
      attach = i;
    }
  });
  const root = at(body, attach);
  const normal = normalAt(body, attach);
  const mood = MOODS[spec.mood];

  const throat =
    Math.max(9, Math.min(a * 2 * 0.045, b * 0.3)) * mood.throat * (1 + jitter(seed, 5, 0.12));
  const lean = Math.max(0, Math.min(0.7, mood.lean + (mood.lean > 0 ? jitter(seed, 6, 0.12) : 0)));
  const side = part(seed, 8) < 0.5 ? -1 : 1;
  const sway = mood.sway > 0 ? (mood.sway + jitter(seed, 7, 0.03)) * side : 0;

  const reach = Math.hypot(tip.x - root.x, tip.y - root.y);
  const heading = unit(sub(tip, root));
  const across = { x: -heading.y, y: heading.x };
  const leave = unit(add(mul(normal, lean), mul(heading, 1 - lean)));
  const start = sub(root, mul(normal, strokeWidth * 2 + 10));
  // A sway bows the first half one way and the second the other: a soft S.
  const c1 = add(add(root, mul(leave, reach * 0.36)), mul(across, -reach * sway * 0.7));
  const c2 = spec.bend ?? add(sub(tip, mul(heading, reach * 0.32)), mul(across, reach * sway));

  const joinInk = inkWeight(normal, strokeWidth);
  const tipInk = strokeWidth * 0.2;
  const leftFill: Point[] = [];
  const rightFill: Point[] = [];
  const leftInk: Point[] = [];
  const rightInk: Point[] = [];
  for (let i = 0; i <= TAIL_SAMPLES; i++) {
    const t = i / TAIL_SAMPLES;
    const p = i === TAIL_SAMPLES ? tip : cubicAt(start, c1, c2, tip, t);
    const ahead = cubicAt(start, c1, c2, tip, Math.min(1, t + 0.005));
    const behind = cubicAt(start, c1, c2, tip, Math.max(0, t - 0.005));
    const d = unit(sub(ahead, behind));
    const n = { x: -d.y, y: d.x };
    const half = throat * (1 - t) ** mood.taper;
    const ink = joinInk * (1 - t) + tipInk * t;
    leftFill.push(add(p, mul(n, half)));
    rightFill.push(add(p, mul(n, -half)));
    leftInk.push(add(p, mul(n, half + ink)));
    rightInk.push(add(p, mul(n, -half - ink)));
  }
  const end = unit(sub(tip, cubicAt(start, c1, c2, tip, 0.97)));
  const inkTip = add(tip, mul(end, tipInk * 3));
  leftInk[TAIL_SAMPLES] = inkTip;
  rightInk[TAIL_SAMPLES] = inkTip;

  return {
    spine: { start, c1, c2, tip, throat },
    fill: clockwise(leftFill, [...rightFill].reverse()),
    ink: clockwise(leftInk, [...rightInk].reverse()),
  };
}

export function buildDrawnBalloon(spec: DrawnSpec): DrawnBalloon {
  const { center, text, seed, strokeWidth } = spec;
  const widths = text.lines.map((l) => measureWidth(l, text.fontSize, text.fontId));
  const exponent = drawnExponent(text.lines.length, seed);
  const { a, b } = drawnAxes(widths, text.lineHeight, text.fontSize, exponent);
  const body = outline(center, a, b, exponent, seed);
  const ring = body.map((p, i) => {
    const n = normalAt(body, i);
    return add(p, mul(n, inkWeight(n, strokeWidth)));
  });
  const coarse = (pts: Point[]): Point[] => pts.filter((_, i) => i % PATH_STEP === 0);

  const inkParts = [closedCurve(coarse(ring))];
  const fillParts = [closedCurve(coarse(body))];
  let tail: DrawnTail | null = null;
  if (spec.tip) {
    const t = drawTail(body, center, a, b, spec, spec.tip);
    tail = t.spine;
    inkParts.push(pointedCurve(t.ink[0], t.ink[1]));
    fillParts.push(pointedCurve(t.fill[0], t.fill[1]));
  }
  return {
    exponent,
    a,
    b,
    body,
    ink: inkParts.join(" "),
    fill: fillParts.join(" "),
    bounds: bounds(ring),
    tail,
  };
}
