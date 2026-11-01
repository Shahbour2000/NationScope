/** Pure views over the GET /regions world payload (shape verified against tests/fixtures/real/regions.json). */
export interface RegionRow { id: string; countryId?: string | null; coreCountryId?: string | null; deposit?: { type?: string | null; bonusPercent?: number | null; endsAt?: string | null } | null }
export interface RegionBattle { id: string; regionId?: string | null; type?: string | null; attackerCountryId?: string | null; defenderCountryId?: string | null }

export function summarize(regions: readonly RegionRow[], battles: readonly RegionBattle[], nowMs: number) {
  const occupied = regions.filter((r) => r.countryId && r.coreCountryId && r.countryId !== r.coreCountryId);
  const deposits = regions
    .filter((r) => r.deposit?.type && (!r.deposit.endsAt || Date.parse(r.deposit.endsAt) > nowMs))
    .sort((a, b) => (b.deposit?.bonusPercent ?? 0) - (a.deposit?.bonusPercent ?? 0));
  const control = new Map<string, number>();
  for (const r of regions) if (r.countryId) control.set(r.countryId, (control.get(r.countryId) ?? 0) + 1);
  const byCountry = [...control.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const attacked = new Set(battles.map((b) => b.regionId).filter((x): x is string => !!x));
  return { occupied, deposits, byCountry, underAttack: attacked.size };
}
