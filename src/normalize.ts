/** Fixed numeric formatting for deterministic SVG / JSON */

import { PROFILE } from "./profile";

export function roundN(n: number, precision = PROFILE.numberPrecision): number {
  const f = 10 ** precision;
  return Math.round(n * f) / f;
}

export function fmt(n: number, precision = PROFILE.numberPrecision): string {
  const r = roundN(n, precision);
  // Always include trailing zeros to fixed precision for byte stability
  return r.toFixed(precision);
}

export function lf(s: string): string {
  return s.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}
