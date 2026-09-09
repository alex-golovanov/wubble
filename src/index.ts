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
} from "./types";
export { PROFILE, PACKAGE_VERSION, SCHEMA_VERSION } from "./profile";
