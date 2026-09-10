/**
 * Wubble public library API (SPEC §14)
 */
export { validatePage } from "./validate";
export { renderPage } from "./render";
export type {
  Locale,
  RenderOptions,
  RenderResult,
  Diagnostic,
  DiagnosticReport,
  PageManifest,
  LetterStyle,
  FontRole,
  FontBinding,
  Requirement,
  StyleProfile,
  StyleOverrides,
} from "./types";
export { PROFILE, PACKAGE_VERSION, SCHEMA_VERSION, PROFILE_ID } from "./profile";
export { parseRenderConfig, loadRenderConfig } from "./config";
export type { RenderConfig } from "./config";
