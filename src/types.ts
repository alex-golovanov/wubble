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
  | "READING_ORDER_AMBIGUOUS"
  | "STYLE_RULE";

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
  /** Small label set above the text inside the same body. */
  label?: string;
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
  | "speech"
  | "chain"
  | "cloud"
  | "needle"
  | "round"
  | "hook"
  | "lightning"
  | "fluffy"
  | "thought"
  | "rect";

/**
 * Outline treatment.
 * smooth — even machine curve; jagged — angular teeth;
 * hand — smooth curve with a small deterministic wobble, so the outline
 * reads as drawn rather than constructed.
 */
export type EdgeStyle = "smooth" | "jagged" | "hand";

/**
 * Lettering register — what kind of object this is on the page, named for its
 * form rather than for who is talking. A project maps its own cast onto these.
 *
 * dialogue — someone speaking; rounded, hand-drawn outline, tail permitted.
 * notice   — a squared, strict, formal box; carries a small label; no tail.
 * caption  — a plain box with no speaker and no tail.
 *
 * What each one looks like, and which of them may take a tail or a label, is
 * the render profile's business, not this union's.
 */
export type LetterStyle = "dialogue" | "notice" | "caption";

/** Registered font assets. Nothing outside this union can be loaded. */
export type FontId =
  | "shantell-sans-semibold"
  | "noto-sans-regular"
  | "jetbrains-mono-regular"
  | "ibm-plex-mono-regular"
  | "roboto-mono-regular"
  | "oswald-medium";

/** A lettering role. Roles, not characters, own a typeface. */
export type FontRole = "dialogue" | "notice" | "noticeLabel";

/** Whether a feature is compulsory, optional or refused for a lettering style. */
export type Requirement = "required" | "allowed" | "forbidden";

/**
 * What one lettering style looks like and what it will accept.
 *
 * This table is the whole of a project's house rules. Wubble itself has no
 * opinion about who may speak in which balloon: it ships plain defaults, and a
 * project overrides them per render.
 */
export interface StyleProfile {
  /** 0..1 of min(w, h) / 2. 0 = square corners, 1 = full pill. */
  cornerRadius: number;
  edge: EdgeStyle;
  fontRole: FontRole;
  labelFontRole: FontRole;
  tail: Requirement;
  label: Requirement;
  /** Draw ⟦ ⟧ marks around the label. */
  labelBrackets: boolean;
}

/** Per-render house rules, layered over the profile's defaults. */
export type StyleOverrides = Partial<Record<LetterStyle, Partial<StyleProfile>>>;

/** Which face each role uses for one render. */
export interface FontBinding {
  dialogue: FontId;
  notice: FontId;
  noticeLabel: FontId;
}

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
  /**
   * Lettering register. Selects the silhouette, the typeface, the label casing
   * and the rules the validator enforces. Default: "dialogue".
   */
  style?: LetterStyle;
  placement: Bounds;
  /**
   * Corner roundness as 0..1 × min(body.w, body.h) / 2.
   * 0 = sharp rectangle, 1 = full pill/stadium.
   * Default for `speech`: 1. Ref shapes ignore.
   */
  cornerRadius?: number;
  /** Outline treatment. Default for `speech`: smooth. Ref shapes ignore. */
  edge?: EdgeStyle;
  /**
   * When true, punch a lightning notch into the top edge (speech only).
   * Ref shapes ignore. Default: false.
   */
  notchTop?: boolean;
  /** Optional fill override; default from PROFILE.shapes.speech. */
  fill?: string;
  /** Optional stroke override; default from PROFILE.shapes.speech. */
  stroke?: string;
  /** Optional stroke width override; default from PROFILE.shapes.speech. */
  strokeWidth?: number;
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
  /** Per-role face overrides for this render, for candidate comparisons. */
  fonts?: Partial<FontBinding>;
  /** Per-style house rules for this render, layered over the profile. */
  styles?: StyleOverrides;
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
  sourceLabel?: {
    text: string;
    fontSize: number;
    lineHeight: number;
    contentWidth: number;
    gapAfter: number;
  };
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
