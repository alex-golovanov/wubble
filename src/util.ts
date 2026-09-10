/** Safe indexed access under `noUncheckedIndexedAccess` — narrows instead of `!`. */
export function at<T>(arr: readonly T[], index: number, label = "index"): T {
  const value = arr[index];
  if (value === undefined) {
    throw new Error(`Missing element at ${label}=${index}`);
  }
  return value;
}
