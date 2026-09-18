/**
 * Which balloons are drawn rather than built from a rounded rectangle, and
 * the text and geometry each one is drawn with.
 */

import { fontVerticalMetrics } from "./font";
import type { LetterFonts } from "./layout";
import { PROFILE } from "./profile";
import { buildDrawnBalloon, drawnLines, drawnSeed } from "./shapes/drawn";
import type { DrawnBalloon } from "./shapes/drawn";
import type { BalloonItem, Bounds, LocaleContent, Point, StyleProfile } from "./types";

/**
 * A drawn style draws plain speech. Bursts (`jagged`), notched and chained
 * balloons, and labelled ones keep the rounded builder.
 */
export function usesDrawnBody(
  item: BalloonItem,
  rules: StyleProfile,
  content: LocaleContent,
): boolean {
  return (
    rules.body === "drawn" &&
    item.shapeId === "speech" &&
    item.edge !== "jagged" &&
    item.notchTop !== true &&
    (item.lobes === undefined || item.lobes.length === 0) &&
    content.label === undefined
  );
}

/** A balloon's own line weight wins, then its register's house rule, then the shape's default. */
export function drawnStrokeWidth(item: BalloonItem, rules: StyleProfile): number {
  return item.strokeWidth ?? rules.strokeWidth ?? PROFILE.shapes.speech.strokeWidth;
}

export interface DrawnLayout {
  lines: string[];
  fontSize: number;
  lineHeight: number;
  baselineOffset: number;
  center: Point;
  balloon: DrawnBalloon;
}

/**
 * The drawn balloon sits on the centre of its placement. Its type size comes
 * from the fitter; its lines are broken again for the smallest balloon unless
 * the manifest wrote them.
 */
export function layoutDrawn(
  item: BalloonItem,
  content: LocaleContent,
  placement: Bounds,
  fontSize: number,
  fonts: LetterFonts,
  strokeWidth: number,
  tip: Point | null,
  bend: Point | null,
): DrawnLayout {
  const raw = content.lines ? content.lines.join("\n") : (content.text ?? "");
  const seed = drawnSeed(item.id, raw);
  const lines = drawnLines(raw, fontSize, fonts.text, seed);
  const metrics = fontVerticalMetrics(fontSize, fonts.text);
  const center = { x: placement.x + placement.width / 2, y: placement.y + placement.height / 2 };
  const balloon = buildDrawnBalloon({
    center,
    text: { lines, fontSize, lineHeight: metrics.lineHeight, fontId: fonts.text },
    seed,
    strokeWidth,
    tip,
    bend,
    mood: item.tail?.mood ?? "calm",
  });
  return {
    lines,
    fontSize,
    lineHeight: metrics.lineHeight,
    baselineOffset: metrics.baselineOffset,
    center,
    balloon,
  };
}
