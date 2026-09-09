/** Wubble core types — schema 0.1.0 */

export type Locale = string;

export type DiagnosticLevel = "error" | "warning";

export type DiagnosticCode =
  | "SCHEMA_INVALID"
  | "LOCALE_MISSING"
  | "GLYPH_MISSING"
  | "TEXT_OVERFLOW"
  | "OUT_OF_BOUNDS"
  | "HARD_EXCLUSION_OVERLAP"
  | "UNKNOWN_SHAPE"
  | "UNKNOWN_ANCHOR"
  | "BALLOON_OVERLAP"
  | "SOFT_EXCLUSION_OVERLAP"
  | "TAIL_CROSSES_BODY"
  | "READING_ORDER_AMBIGUOUS";

export interface DiagnosticSuggestion {
  field: string;
  minimum?: number;
  maximum?: number;
  value?: string | number;
}

export interface Diagnostic {
  code: DiagnosticCode;
  level: DiagnosticLevel;
  itemId?: string;
  message: string;
  suggestions?: DiagnosticSuggestion[];
}

export interface DiagnosticReport {
  valid: boolean;
  pageId: string | null;
  locale: Locale | null;
  diagnostics: Diagnostic[];
}

export interface Point {
  x: number;
  y: number;
}

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CoordinateSpace {
  width: number;
  height: number;
  origin: "top-left";
  units: "art-px";
}

export interface Subject {
  id: string;
  bounds: Bounds;
  anchors: Record<string, Point>;
}

export interface ExclusionZone {
  id: string;
  bounds: Bounds;
  severity: "hard" | "soft";
}

export interface LocaleContent {
  text?: string;
  lines?: string[];
  sourceLabel?: string;
}

export interface Tail {
  subjectId: string;
  anchor: string;
  attachment: "top" | "right" | "bottom" | "left" | "auto";
  bend?: Point;
}

export interface LocaleOverride {
  placement?: Bounds;
  tailBend?: Point;
}

export type ShapeId =
  | "human-01"
  | "glitch-01"
  | "glitch-breaking-01"
  | "ref-01"
  | "ref-02"
  | "ref-03"
  | "ref-04"
  | "ref-05"
  | "ref-06"
  | "ref-07"
  | "ref-08"
  | "ref-09";

/** Outline treatment — smooth comic stroke vs angular/robot edgy. */
export type EdgeStyle = "smooth" | "jagged";

/**
 * Extra lobe in a chained multi-bubble.
 * Fused with the primary `placement` into one open silhouette (no crossbars).
 */
export interface BalloonLobe {
  placement: Bounds;
  content: Record<string, LocaleContent>;
}

export interface BalloonItem {
  kind: "balloon";
  id: string;
  panelId: string;
  speakerId: string;
  shapeId: ShapeId;
  placement: Bounds;
  /**
   * Corner roundness as 0..1 × min(body.w, body.h) / 2.
   * 0 = sharp rectangle, 1 = full pill/stadium.
   * Default: human-01 → 1, glitch-* → 0.
   */
  cornerRadius?: number;
  /** Outline treatment. Default: human-01 → smooth, glitch-* → jagged. */
  edge?: EdgeStyle;
  /**
   * Additional lobes fused with `placement` into one chained silhouette
   * (open necks, single outline). Reading order typically top→bottom.
   */
  lobes?: BalloonLobe[];
  tail?: Tail;
  content: Record<string, LocaleContent>;
  localeOverrides?: Record<string, LocaleOverride>;
}

export interface SilentItem {
  kind: "silent";
  id: string;
  panelId: string;
  speakerId: string;
}

export type PageItem = BalloonItem | SilentItem;

export interface PageManifest {
  schemaVersion: "0.1.0";
  pageId: string;
  coordinateSpace: CoordinateSpace;
  renderProfile: { id: string; version: string };
  subjects: Subject[];
  exclusionZones: ExclusionZone[];
  items: PageItem[];
}

export interface RenderOptions {
  locale: Locale;
  profileId: string;
}

export interface RenderResult {
  svg: string | null;
  diagnostics: DiagnosticReport;
}

export interface FittedText {
  lines: string[];
  fontSize: number;
  lineHeight: number;
  contentWidth: number;
  contentHeight: number;
  /** Full balloon frame (shape template maps here). */
  bodyBounds: Bounds;
  /**
   * Lettering box inside the body (content band inset).
   * When omitted, renderers fall back to bodyBounds.
   */
  textBounds?: Bounds;
}

export interface ShapeGeometry {
  /** Single closed silhouette (body + integrated tail when present). */
  path: string;
  fill: string;
  stroke: string;
  strokeWidth: number;
}
