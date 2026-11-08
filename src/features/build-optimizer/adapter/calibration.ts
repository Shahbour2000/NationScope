import type { CandidateFormula } from '@/features/planner/evidence';
import { computeHit, type AmmoType } from '../engine/combat';
import { emptyLevels } from '../engine/skills';

/**
 * Bridge to NationScope's existing evidence gate (features/planner/evidence.ts): candidate formulas for the one remaining unresolved
 * combination, AMMO + RANK (summed per the wiki, product as the alternative), as `CandidateFormula`s so assessFormula/rankFormulas can decide
 * from real observations. The Pill is deliberately NOT an input here: per the Wiki it is a third summand of the personal boosts (see combat.booster), and these observations are taken without one.
 * Observation inputs (numbers): attackSkill, weaponAttack, ammoPct, rankPct. Observed = a CLEAN, NON-CRITICAL hit's damage with luck removed.
 */
const clean = (stacking: 'additive' | 'multiplicative'): CandidateFormula['predict'] => (i) => {
  const A = (i.attackSkill ?? 0) + (i.weaponAttack ?? 0);
  return A * (stacking === 'additive' ? 1 + ((i.ammoPct ?? 0) + (i.rankPct ?? 0)) / 100 : (1 + (i.ammoPct ?? 0) / 100) * (1 + (i.rankPct ?? 0) / 100));
};
export const stackingCandidates: CandidateFormula[] = [
  { id: 'stack.additive', description: 'attack x (1 + ammo% + rank%)', predict: clean('additive') },
  { id: 'stack.multiplicative', description: 'attack x (1+ammo%) x (1+rank%)', predict: clean('multiplicative') },
];
/** Clean-hit damage from the engine pipeline (knife, zero skills). Used to prove the candidates match the engine. */
export function engineCleanHit(a: { ammo: AmmoType; rankPct: number; stacking: 'additive' | 'multiplicative' }): number {
  const h = computeHit({ levels: emptyLevels(), gear: { weapon: { kind: 'item', stats: { attack: 30, critChance: 0, usesAmmo: false } } }, ammo: a.ammo, booster: 'none', rankBonusPct: a.rankPct, conventions: { stacking: a.stacking } });
  return h.outcomes.find((o) => o.kind === 'clean')!.damage;
}
