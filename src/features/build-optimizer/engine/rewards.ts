import { defineFormula } from './registry';

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';
/** Field Crate rarity odds, documented (wiki 01-basics §4.4). Equipment: 25% weapon, 75% armor piece. */
export const FIELD_CRATE_ODDS: Record<Rarity, number> = { common: 0.55, uncommon: 0.28, rare: 0.12, epic: 0.04, legendary: 0.009, mythic: 0.001 };
export const FIELD_CRATE_WEAPON_SHARE = 0.25;

defineFormula({ id: 'rewards.loot', version: 1, status: 'documented',
  summary: 'Each hit finds a Field Crate with probability = loot chance %. Field crate always holds equipment; rarity odds and 25/75 weapon/armor split are documented. Gold value needs market floors (never invented).',
  source: 'wiki 01-basics §4.2, §4.4; 03-war §1.10', inputs: ['hits', 'lootChancePct', 'floors'], outputs: ['expectedCrates', 'expectedValue'], dependsOn: [], tests: ['loot'] });
defineFormula({ id: 'rewards.contract', version: 1, status: 'estimated',
  summary: 'Full contract value if target met; otherwise value of damage done minus a 10% penalty on the unfinished part of the value. Exact arithmetic is not spelled out in the wiki.',
  source: 'wiki 03-war §3.3', inputs: ['contractValue', 'target', 'done'], outputs: ['payout'], dependsOn: [], tests: ['contract'] });

export interface Floors { weapon: Partial<Record<Rarity, number>>; armor: Partial<Record<Rarity, number>> }
export function expectedCrateValue(f: Floors): number | null {
  let v = 0;
  for (const r of Object.keys(FIELD_CRATE_ODDS) as Rarity[]) {
    const w = f.weapon[r], a = f.armor[r];
    if (w === undefined || a === undefined) return null; // never treat an unknown floor price as 0
    v += FIELD_CRATE_ODDS[r] * (FIELD_CRATE_WEAPON_SHARE * w + (1 - FIELD_CRATE_WEAPON_SHARE) * a);
  }
  return v;
}
export function lootExpectation(hits: number, lootChancePct: number, floors?: Floors): { expectedCrates: number; expectedValue: number | null } {
  const expectedCrates = (hits * lootChancePct) / 100;
  const cv = floors ? expectedCrateValue(floors) : null;
  return { expectedCrates, expectedValue: cv === null ? null : expectedCrates * cv };
}
export function contractPayout(contractValue: number, targetDamage: number, damageDone: number): number {
  if (damageDone >= targetDamage) return contractValue;
  const done = contractValue * (damageDone / targetDamage);
  return done - 0.1 * (contractValue - done);
}
