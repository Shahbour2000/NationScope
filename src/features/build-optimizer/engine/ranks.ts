import { defineFormula } from './registry';

/** Wiki 01-basics §2.6 (documented): lifetime damage thresholds and attack bonus. */
export const RANKS = [
  { code: 'volunteer', damage: 0n, bonusPct: 0 }, { code: 'fighter', damage: 5_000n, bonusPct: 1 },
  { code: 'veteran', damage: 25_000n, bonusPct: 2 }, { code: 'sergeant', damage: 100_000n, bonusPct: 3 },
  { code: 'lieutenant', damage: 400_000n, bonusPct: 4 }, { code: 'captain', damage: 1_500_000n, bonusPct: 5 },
  { code: 'commander', damage: 5_000_000n, bonusPct: 6 }, { code: 'colonel', damage: 15_000_000n, bonusPct: 7 },
  { code: 'general', damage: 50_000_000n, bonusPct: 8 }, { code: 'warlord', damage: 200_000_000n, bonusPct: 12 },
] as const;

defineFormula({ id: 'rank.bonus', version: 1, status: 'documented',
  summary: 'Rank is set by total lifetime damage (never lost); each rank adds a fixed attack %. The API rank.code spelling is not confirmed, so a recognised code is used first and lifetime damage is the fallback.',
  source: 'wiki 01-basics §2.6; GET /players/{id} rank.code, damage.total', inputs: ['rankCode', 'damageTotal'], outputs: ['bonusPct'], dependsOn: [], tests: ['rank bonus'] });

export function rankFromDamage(total: bigint | string | number): (typeof RANKS)[number] {
  const t = BigInt(typeof total === 'number' ? Math.floor(total) : total);
  let r: (typeof RANKS)[number] = RANKS[0];
  for (const x of RANKS) if (t >= x.damage) r = x;
  return r;
}
/** Exact (case-insensitive) match of an API rank code against the wiki rank names; null if unrecognised. */
export function rankFromCode(code: string | null | undefined): (typeof RANKS)[number] | null {
  if (!code) return null;
  const k = code.trim().toLowerCase().replace(/[\s_-]+/g, '');
  return RANKS.find((r) => r.code === k) ?? null;
}
