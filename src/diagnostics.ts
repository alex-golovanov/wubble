import type {
  Diagnostic,
  DiagnosticCode,
  DiagnosticLevel,
  DiagnosticReport,
  DiagnosticSuggestion,
  Locale,
} from "./types";

const LEVEL: Record<DiagnosticCode, DiagnosticLevel> = {
  SCHEMA_INVALID: "error",
  LOCALE_MISSING: "error",
  GLYPH_MISSING: "error",
  TEXT_OVERFLOW: "error",
  OUT_OF_BOUNDS: "error",
  HARD_EXCLUSION_OVERLAP: "error",
  UNKNOWN_PROFILE: "error",
  UNKNOWN_SHAPE: "error",
  UNKNOWN_ANCHOR: "error",
  BALLOON_OVERLAP: "warning",
  SOFT_EXCLUSION_OVERLAP: "warning",
  TAIL_CROSSES_BODY: "warning",
  TAIL_TOO_SHORT: "error",
  READING_ORDER_AMBIGUOUS: "warning",
  STYLE_RULE: "error",
};

export function diag(
  code: DiagnosticCode,
  message: string,
  opts?: {
    itemId?: string;
    suggestions?: DiagnosticSuggestion[];
    level?: DiagnosticLevel;
  },
): Diagnostic {
  return {
    code,
    level: opts?.level ?? LEVEL[code],
    ...(opts?.itemId !== undefined ? { itemId: opts.itemId } : {}),
    message,
    ...(opts?.suggestions ? { suggestions: opts.suggestions } : {}),
  };
}

export function makeReport(
  diagnostics: Diagnostic[],
  pageId: string | null,
  locale: Locale | null,
): DiagnosticReport {
  const sorted = [...diagnostics].sort((a, b) => {
    const order = a.code.localeCompare(b.code);
    if (order !== 0) return order;
    return (a.itemId ?? "").localeCompare(b.itemId ?? "");
  });
  const hasError = sorted.some((d) => d.level === "error");
  return {
    valid: !hasError,
    pageId,
    locale,
    diagnostics: sorted,
  };
}

export function serializeDiagnostics(report: DiagnosticReport): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}

export function hasErrors(report: DiagnosticReport): boolean {
  return report.diagnostics.some((d) => d.level === "error");
}
