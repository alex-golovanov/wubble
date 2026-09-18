import { describe, expect, test } from "bun:test";
import { buildRoundedBalloonPath, tailHalfWidth } from "../src/shapes/rounded-rect";
import type { Bounds, Point } from "../src/types";

type Command = { op: string; control: Point | null; end: Point };

/** Read a Wubble balloon path into commands with their control and end points. */
function commands(path: string): Command[] {
  const out: Command[] = [];
  const pattern = /([MLQA])([^MLQAZ]*)/g;
  for (const match of path.matchAll(pattern)) {
    const op = match[1] ?? "";
    const n = (match[2] ?? "").trim().split(/\s+/).map(Number);
    const at = (i: number): number => {
      const v = n.at(i);
      if (v === undefined) throw new Error(`missing number ${i} in ${op}`);
      return v;
    };
    if (op === "Q") out.push({ op, control: { x: at(0), y: at(1) }, end: { x: at(2), y: at(3) } });
    else out.push({ op, control: null, end: { x: at(-2), y: at(-1) } });
  }
  return out;
}

/** The run of commands between the outline leaving the bottom edge and rejoining it. */
function bottomTail(path: string, edgeY: number): { leave: Point; cmds: Command[] } {
  const all = commands(path);
  const first = all.findIndex((c) => c.end.y > edgeY + 0.5);
  const back = all.findIndex((c, i) => i > first && Math.abs(c.end.y - edgeY) < 0.01);
  const before = all.at(first - 1);
  if (first < 1 || back < 0 || before === undefined) throw new Error(`no tail in ${path}`);
  return { leave: before.end, cmds: all.slice(first, back + 1) };
}

function quad(a: Point, c: Point, b: Point, t: number): Point {
  const u = 1 - t;
  return {
    x: u * u * a.x + 2 * u * t * c.x + t * t * b.x,
    y: u * u * a.y + 2 * u * t * c.y + t * t * b.y,
  };
}

const body: Bounds = { x: 130, y: 90, width: 700, height: 230 };
const edgeY = body.y + body.height;

function tailPath(tip: Point): string {
  return buildRoundedBalloonPath({
    bodies: [body],
    tip,
    bend: null,
    attachment: "bottom",
    cornerRadius: 0.9,
    edge: "smooth",
  });
}

describe("classic tail", () => {
  test("the throat is slim: under a tenth of the balloon's width at any reach", () => {
    const rr = 0.9 * (body.height / 2);
    for (const tip of [
      { x: 420, y: 420 },
      { x: 360, y: 640 },
      { x: 150, y: 900 },
    ]) {
      expect(tailHalfWidth(body, tip, "bottom", rr) * 2).toBeLessThanOrEqual(body.width * 0.1);
    }
  });

  test("the outline flows into the tail through a rounded join, not a corner", () => {
    const { cmds } = bottomTail(tailPath({ x: 360, y: 640 }), edgeY);
    const leaving = cmds.at(0);
    const rejoining = cmds.at(-1);
    if (leaving?.control == null || rejoining?.control == null) {
      throw new Error("the tail must leave and rejoin the edge with a curve");
    }
    // A control point on the edge line keeps the outline's direction through the join.
    expect(leaving.control.y).toBeCloseTo(edgeY, 2);
    expect(rejoining.control.y).toBeCloseTo(edgeY, 2);
  });

  test("a tail reaching a speaker well off to one side bows: both sides curve the same way", () => {
    const tip = { x: 150, y: 900 };
    const { leave, cmds } = bottomTail(tailPath(tip), edgeY);
    const rejoin = cmds.at(-1)?.end;
    if (rejoin === undefined) throw new Error("no rejoin point");
    const base = { x: (leave.x + rejoin.x) / 2, y: edgeY };
    const reachTip = cmds.findIndex((c) => c.end.x === tip.x && c.end.y === tip.y);
    const inward = cmds.at(reachTip)?.control;
    const outward = cmds.at(reachTip + 1)?.control;
    if (inward == null || outward == null) throw new Error("tail sides must be curves");
    const side = (p: Point): number =>
      (tip.x - base.x) * (p.y - base.y) - (tip.y - base.y) * (p.x - base.x);
    expect(Math.sign(side(inward))).toBe(Math.sign(side(outward)));
    expect(Math.abs(side(inward))).toBeGreaterThan(0);
  });

  test("a tail running out sideways keeps its width across the run", () => {
    // An off-panel speaker far to the left and barely below: the tail leaves the
    // bottom edge and runs almost level.
    const pill: Bounds = { x: 420, y: 130, width: 528, height: 187 };
    const floor = pill.y + pill.height;
    const tip = { x: 60, y: 520 };
    const path = buildRoundedBalloonPath({
      bodies: [pill],
      tip,
      bend: null,
      attachment: "auto",
      cornerRadius: 0.9,
      edge: "smooth",
    });
    const { leave, cmds } = bottomTail(path, floor);
    const rejoin = cmds.at(-1)?.end;
    const reachTip = cmds.findIndex((c) => c.end.x === tip.x && c.end.y === tip.y);
    const inward = cmds.at(reachTip);
    const outward = cmds.at(reachTip + 1);
    const start = cmds.at(reachTip - 1)?.end;
    if (inward?.control == null || outward?.control == null || !start || !rejoin) {
      throw new Error("tail sides must be curves");
    }
    const base = { x: (leave.x + rejoin.x) / 2, y: floor };
    const length = Math.hypot(tip.x - base.x, tip.y - base.y);
    const across = { x: -(tip.y - base.y) / length, y: (tip.x - base.x) / length };
    const a = quad(start, inward.control, tip, 0.5);
    const b = quad(tip, outward.control, outward.end, 0.5);
    const width = Math.abs((a.x - b.x) * across.x + (a.y - b.y) * across.y);
    const rr = 0.9 * (pill.height / 2);
    const throat = tailHalfWidth(pill, tip, "bottom", rr) * 2;
    expect(width).toBeGreaterThan(throat * 0.35);
  });

  test("the tail runs out to the tip and back with no hook", () => {
    const wide: Bounds = { x: 260, y: 150, width: 560, height: 280 };
    const cases = [
      { box: body, tip: { x: 420, y: 420 } },
      { box: body, tip: { x: 150, y: 900 } },
      { box: body, tip: { x: 820, y: 700 } },
      // The tip lies beyond the end of the throat's reach along the edge.
      { box: wide, tip: { x: 720, y: 770 } },
    ];
    for (const { box, tip } of cases) {
      const floor = box.y + box.height;
      const path = buildRoundedBalloonPath({
        bodies: [box],
        tip,
        bend: null,
        attachment: "bottom",
        cornerRadius: 1,
        edge: "smooth",
      });
      const { cmds } = bottomTail(path, floor);
      const depths = cmds.map((c) => c.end.y);
      const peak = depths.indexOf(Math.max(...depths));
      expect(cmds.at(peak)?.end).toEqual(tip);
      for (let i = 1; i <= peak; i++) {
        expect(depths[i] ?? 0).toBeGreaterThan(depths[i - 1] ?? 0);
      }
      for (let i = peak + 1; i < depths.length; i++) {
        expect(depths[i] ?? 0).toBeLessThan(depths[i - 1] ?? 0);
      }
      for (const c of cmds) {
        if (c.control) expect(c.control.y).toBeGreaterThanOrEqual(floor - 0.01);
      }
    }
  });
});
