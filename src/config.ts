/**
 * Optional per-project render config.
 *
 * Wubble ships neutral defaults. A project's house rules — which register may
 * take a tail, which must carry a label, which typeface each register speaks
 * in — live in a file the project owns, not in this package.
 */

import { readFileSync } from "node:fs";
import { isFontId } from "./profile";
import type {
  EdgeStyle,
  FontBinding,
  FontId,
  FontRole,
  LetterStyle,
  Requirement,
  StyleOverrides,
  StyleProfile,
} from "./types";

export interface RenderConfig {
  fonts?: Partial<FontBinding>;
  styles?: StyleOverrides;
}

const FONT_ROLES: FontRole[] = ["dialogue", "notice", "noticeLabel"];
const LETTER_STYLES: LetterStyle[] = ["dialogue", "notice", "caption"];
const REQUIREMENTS: Requirement[] = ["required", "allowed", "forbidden"];
const EDGES: EdgeStyle[] = ["smooth", "jagged", "hand"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFontRole(value: string): value is FontRole {
  return FONT_ROLES.some((role) => role === value);
}

function isLetterStyle(value: string): value is LetterStyle {
  return LETTER_STYLES.some((style) => style === value);
}

function isRequirement(value: unknown): value is Requirement {
  return typeof value === "string" && REQUIREMENTS.some((r) => r === value);
}

function isEdge(value: unknown): value is EdgeStyle {
  return typeof value === "string" && EDGES.some((e) => e === value);
}

function readFonts(raw: unknown, errors: string[]): Partial<FontBinding> | null {
  if (!isRecord(raw)) {
    errors.push("`fonts` must be an object of role → font id.");
    return null;
  }
  const fonts: Partial<FontBinding> = {};
  for (const [role, value] of Object.entries(raw)) {
    if (!isFontRole(role)) {
      errors.push(`Unknown font role "${role}". Roles: ${FONT_ROLES.join(", ")}.`);
      continue;
    }
    if (typeof value !== "string" || !isFontId(value)) {
      errors.push(`Font for role "${role}" is not a registered font id.`);
      continue;
    }
    const id: FontId = value;
    if (role === "dialogue") fonts.dialogue = id;
    else if (role === "notice") fonts.notice = id;
    else fonts.noticeLabel = id;
  }
  return fonts;
}

function readStyle(
  raw: Record<string, unknown>,
  style: string,
  errors: string[],
): Partial<StyleProfile> {
  const patch: Partial<StyleProfile> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (key === "cornerRadius") {
      if (typeof value === "number" && value >= 0 && value <= 1) patch.cornerRadius = value;
      else errors.push(`${style}.cornerRadius must be a number between 0 and 1.`);
    } else if (key === "edge") {
      if (isEdge(value)) patch.edge = value;
      else errors.push(`${style}.edge must be one of ${EDGES.join(", ")}.`);
    } else if (key === "fontRole" || key === "labelFontRole") {
      if (typeof value === "string" && isFontRole(value)) {
        if (key === "fontRole") patch.fontRole = value;
        else patch.labelFontRole = value;
      } else errors.push(`${style}.${key} must be one of ${FONT_ROLES.join(", ")}.`);
    } else if (key === "tail" || key === "label") {
      if (isRequirement(value)) {
        if (key === "tail") patch.tail = value;
        else patch.label = value;
      } else errors.push(`${style}.${key} must be one of ${REQUIREMENTS.join(", ")}.`);
    } else if (key === "strokeWidth") {
      if (typeof value === "number" && Number.isFinite(value) && value > 0) {
        patch.strokeWidth = value;
      } else errors.push(`${style}.strokeWidth must be a positive number.`);
    } else if (key === "labelBrackets") {
      if (typeof value === "boolean") patch.labelBrackets = value;
      else errors.push(`${style}.labelBrackets must be true or false.`);
    } else {
      errors.push(`Unknown key "${key}" in style "${style}".`);
    }
  }
  return patch;
}

function readStyles(raw: unknown, errors: string[]): StyleOverrides | null {
  if (!isRecord(raw)) {
    errors.push("`styles` must be an object of style → overrides.");
    return null;
  }
  const styles: StyleOverrides = {};
  for (const [style, value] of Object.entries(raw)) {
    if (!isLetterStyle(style)) {
      errors.push(`Unknown style "${style}". Styles: ${LETTER_STYLES.join(", ")}.`);
      continue;
    }
    if (!isRecord(value)) {
      errors.push(`Overrides for style "${style}" must be an object.`);
      continue;
    }
    const patch = readStyle(value, style, errors);
    if (style === "dialogue") styles.dialogue = patch;
    else if (style === "notice") styles.notice = patch;
    else styles.caption = patch;
  }
  return styles;
}

export interface ConfigResult {
  config: RenderConfig;
  errors: string[];
}

export function parseRenderConfig(raw: unknown): ConfigResult {
  const errors: string[] = [];
  const config: RenderConfig = {};
  if (!isRecord(raw)) {
    return { config, errors: ["Config must be a JSON object."] };
  }
  for (const [key, value] of Object.entries(raw)) {
    if (key === "fonts") {
      const fonts = readFonts(value, errors);
      if (fonts) config.fonts = fonts;
    } else if (key === "styles") {
      const styles = readStyles(value, errors);
      if (styles) config.styles = styles;
    } else if (key !== "id" && key !== "description") {
      errors.push(`Unknown config key "${key}".`);
    }
  }
  return { config, errors };
}

export function loadRenderConfig(path: string): ConfigResult {
  const text = readFileSync(path, "utf8");
  const parsed: unknown = JSON.parse(text);
  return parseRenderConfig(parsed);
}
