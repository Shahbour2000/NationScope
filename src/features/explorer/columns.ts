import { isScalar, type Row } from "./shape";

const RANK: Record<string, number> = { name: 0, title: 1, username: 1 };

/** Fields that are plumbing for a player: shown only in the collapsed technical view. */
const HIDDEN = new Set(["id", "scheme", "key", "revision", "avatarUrl", "logoUrl", "link", "proposalId", "offerId", "itemId", "extra"]);
export const RESOLVABLE_KEYS = new Set([
  "countryId", "otherCountryId", "counterpartCountryId", "attackerCountryId", "defenderCountryId", "coreCountryId", "leaderCountryId", "onCountryId", "byCountryId",
  "countryA", "countryB", "declaredBy", "winner", "regionId", "sourceRegionId", "capitalRegionId", "homeRegionId",
]);
export const isTechnicalKey = (k: string): boolean => HIDDEN.has(k) || (/Ids?$/.test(k) && !RESOLVABLE_KEYS.has(k));

/** Picks readable table columns from what rows actually contain (scalar fields only), name/title/id first. */
export function pickColumns(rows: readonly Row[], max = 8): string[] {
  const order: string[] = [];
  const seen = new Set<string>();
  for (const r of rows.slice(0, 100)) {
    for (const [k, v] of Object.entries(r)) {
      if (isScalar(v) && !seen.has(k)) { seen.add(k); order.push(k); }
    }
  }
  const visible = order.filter((k) => !isTechnicalKey(k));
  return (visible.length > 0 ? visible : order)
    .map((k, i) => ({ k, i }))
    .sort((a, b) => (RANK[a.k] ?? 3) - (RANK[b.k] ?? 3) || a.i - b.i)
    .slice(0, max)
    .map((x) => x.k);
}
