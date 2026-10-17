const INT = /^-?\d+$/;

/** Null/undefined always sort last (both directions handled by the caller). Digit strings compare as BigInt. */
export function compareValues(a: unknown, b: unknown): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "string" && typeof b === "string") {
    if (INT.test(a) && INT.test(b)) {
      const x = BigInt(a), y = BigInt(b);
      return x < y ? -1 : x > y ? 1 : 0;
    }
    return a.localeCompare(b);
  }
  return String(a).localeCompare(String(b));
}

export function sortRows<T extends Record<string, unknown>>(rows: readonly T[], key: string, dir: "asc" | "desc"): T[] {
  const sign = dir === "asc" ? 1 : -1;
  return rows
    .map((r, i) => ({ r, i, v: r[key] }))
    .sort((a, b) => {
      const an = a.v === null || a.v === undefined, bn = b.v === null || b.v === undefined;
      if (an && bn) return a.i - b.i;
      if (an) return 1;
      if (bn) return -1;
      return sign * compareValues(a.v, b.v) || a.i - b.i;
    })
    .map((x) => x.r);
}
