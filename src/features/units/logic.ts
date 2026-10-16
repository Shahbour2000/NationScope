import type { UnitRow } from "@/lib/domain/units";

export type SortKey = "name" | "country" | "owner" | "members" | "hq" | "damage" | "policy";
export type SortDir = "asc" | "desc";
export interface Filters { query: string; policy: string; country: string }

export function filterUnits(rows: readonly UnitRow[], f: Filters): UnitRow[] {
  const q = f.query.trim().toLowerCase();
  return rows.filter(
    (r) =>
      (f.policy === "all" || r.joinPolicy === f.policy) &&
      (f.country === "all" || r.countryId === f.country) &&
      (q === "" || r.name.toLowerCase().includes(q) || (r.ownerName ?? "").toLowerCase().includes(q)),
  );
}

type Cmp = number | bigint | string | null;
function keyOf(r: UnitRow, k: SortKey): Cmp {
  switch (k) {
    case "name": return r.name.toLowerCase();
    case "country": return r.countryId;
    case "owner": return r.ownerName?.toLowerCase() ?? null;
    case "members": return r.members;
    case "hq": return r.hqLevel;
    case "damage": return r.damage === null ? null : BigInt(r.damage);
    case "policy": return r.joinPolicy;
  }
}

/** Nulls always sort last, in both directions. Stable for equal keys. */
export function sortUnits(rows: readonly UnitRow[], key: SortKey, dir: SortDir): UnitRow[] {
  const sign = dir === "asc" ? 1 : -1;
  return rows
    .map((r, i) => ({ r, i, k: keyOf(r, key) }))
    .sort((a, b) => {
      if (a.k === null && b.k === null) return a.i - b.i;
      if (a.k === null) return 1;
      if (b.k === null) return -1;
      if (a.k < b.k) return -sign;
      if (a.k > b.k) return sign;
      return a.i - b.i;
    })
    .map((x) => x.r);
}

export function summarize(rows: readonly UnitRow[]): { count: number; members: number; damage: bigint } {
  return {
    count: rows.length,
    members: rows.reduce((n, r) => n + (r.members ?? 0), 0),
    damage: rows.reduce((n, r) => n + (r.damage === null ? 0n : BigInt(r.damage)), 0n),
  };
}
