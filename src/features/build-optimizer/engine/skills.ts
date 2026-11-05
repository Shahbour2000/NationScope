import { defineFormula } from './registry';

export const SKILL_IDS = [
  'energy', 'health', 'hunger', 'attack', 'companySlots', 'business', 'production',
  'critChance', 'critDamage', 'armor', 'accuracy', 'dodge', 'lootChance', 'leadership',
] as const;
export type SkillId = (typeof SKILL_IDS)[number];
export type Levels = Record<SkillId, number>;

interface SkillDef { level0: number; level10: number; unlockLevel: number }
/** Endpoints and unlock levels: wiki "Character > Skills" (documented). */
export const SKILLS: Record<SkillId, SkillDef> = {
  energy: { level0: 30, level10: 150, unlockLevel: 1 },
  health: { level0: 100, level10: 220, unlockLevel: 4 },
  hunger: { level0: 5, level10: 15, unlockLevel: 8 },
  attack: { level0: 100, level10: 400, unlockLevel: 1 },
  companySlots: { level0: 2, level10: 12, unlockLevel: 4 },
  business: { level0: 30, level10: 130, unlockLevel: 1 },
  production: { level0: 10, level10: 50, unlockLevel: 1 },
  critChance: { level0: 10, level10: 50, unlockLevel: 4 },
  critDamage: { level0: 100, level10: 350, unlockLevel: 8 },
  armor: { level0: 0, level10: 50, unlockLevel: 6 },
  accuracy: { level0: 50, level10: 110, unlockLevel: 1 },
  dodge: { level0: 0, level10: 30, unlockLevel: 12 },
  lootChance: { level0: 5, level10: 35, unlockLevel: 1 },
  leadership: { level0: 4, level10: 34, unlockLevel: 9 },
};

export const MAX_LEVEL = 10;
/** Points to buy level i+1 (wiki: 1,1,2,3,4,5,6,8,9,10). */
export const COST_BY_LEVEL = [1, 1, 2, 3, 4, 5, 6, 8, 9, 10] as const;

defineFormula({
  id: 'skills.cost', version: 1, status: 'documented',
  summary: 'Cumulative skill points to reach level L = sum of COST_BY_LEVEL[0..L-1]; level 10 = 49.',
  source: 'wiki 01-basics §2.4 "Skill point costs"', inputs: ['level'], outputs: ['points'], dependsOn: [],
  tests: ['cumulative cost table'],
});
defineFormula({
  id: 'skills.value.endpoints', version: 1, status: 'documented',
  summary: 'Skill value at level 0 and level 10.', source: 'wiki 01-basics §2.4',
  inputs: ['skill'], outputs: ['value@0', 'value@10'], dependsOn: [], tests: ['skill endpoints'],
});
defineFormula({
  id: 'skills.value.linear', version: 1, status: 'estimated',
  summary: 'Intermediate levels interpolated linearly. Every documented range divides evenly by 10, which supports but does not prove linearity.',
  source: 'modelling assumption', inputs: ['skill', 'level'], outputs: ['value'], dependsOn: ['skills.value.endpoints'],
  tests: ['linear interpolation'],
});
defineFormula({
  id: 'skills.unlock', version: 1, status: 'documented',
  summary: 'A skill can only be raised when player level >= its unlock level.', source: 'wiki 01-basics §2.4',
  inputs: ['playerLevel', 'skill'], outputs: ['unlocked'], dependsOn: [], tests: ['unlock levels'],
});
defineFormula({
  id: 'skills.pointsEarned', version: 2, status: 'documented',
  summary: 'Earned points = 4*(level-1) (a level-22 player has 84; confirmed by the project owner) + 4 per Prestige (wiki). Earned, invested and available points are kept apart; the prestige count is NOT exposed by the API.',
  source: 'wiki 01-basics §2.1, §2.8; project owner 2026-10-31', inputs: ['playerLevel', 'prestigeCount'], outputs: ['earned'],
  dependsOn: [], tests: ['points earned', 'skill point ledger'],
});
defineFormula({
  id: 'skills.pointsEarned.prestigeInteraction', version: 1, status: 'unverified',
  summary: 'How the level that drops after a Prestige combines with the +4 points per Prestige (earned = 4*(currentLevel-1) + 4*prestige) is not confirmed in game; supply the real total when a player has prestiged.',
  source: 'wiki 01-basics §2.8', inputs: ['playerLevel', 'prestigeCount'], outputs: ['earned'], dependsOn: ['skills.pointsEarned'], tests: ['skill point ledger'],
});
defineFormula({
  id: 'skills.resetCost', version: 1, status: 'documented',
  summary: '0.5 gold per spent point; the first reset is free.', source: 'wiki 01-basics §2.5',
  inputs: ['spentPoints', 'firstResetFree'], outputs: ['gold'], dependsOn: [], tests: ['reset cost'],
});

export function emptyLevels(fill = 0): Levels {
  return Object.fromEntries(SKILL_IDS.map((s) => [s, fill])) as Levels;
}
export function cumulativeCost(level: number): number {
  if (!Number.isInteger(level) || level < 0 || level > MAX_LEVEL) throw new RangeError(`Invalid skill level: ${level}`);
  let t = 0;
  for (let i = 0; i < level; i++) t += COST_BY_LEVEL[i]!;
  return t;
}
export function totalCost(levels: Partial<Levels>): number {
  return SKILL_IDS.reduce((s, id) => s + cumulativeCost(levels[id] ?? 0), 0);
}
/** Smallest level whose cumulative cost is >= points ("at least P points allocated"). null if > 49. */
export function minLevelForPoints(points: number): number | null {
  for (let l = 0; l <= MAX_LEVEL; l++) if (cumulativeCost(l) >= points) return l;
  return null;
}
/** Largest level whose cumulative cost is <= points ("at most P points allocated"). */
export function maxLevelForPoints(points: number): number {
  let best = 0;
  for (let l = 0; l <= MAX_LEVEL; l++) if (cumulativeCost(l) <= points) best = l;
  return best;
}
/** Level costing exactly `points`, or null when no level has that cumulative cost. */
export function exactLevelForPoints(points: number): number | null {
  for (let l = 0; l <= MAX_LEVEL; l++) if (cumulativeCost(l) === points) return l;
  return null;
}
export function skillValue(id: SkillId, level: number): number {
  if (!Number.isInteger(level) || level < 0 || level > MAX_LEVEL) throw new RangeError(`Invalid skill level: ${level}`);
  const d = SKILLS[id];
  return d.level0 + ((d.level10 - d.level0) * level) / MAX_LEVEL;
}
/** True when the value at this level is an interpolation (estimated) rather than a documented endpoint. */
export function isInterpolated(level: number): boolean { return level > 0 && level < MAX_LEVEL; }
/** Smallest level whose value >= target, or null when even level 10 is not enough. */
export function minLevelForStat(id: SkillId, target: number): number | null {
  for (let l = 0; l <= MAX_LEVEL; l++) if (skillValue(id, l) >= target) return l;
  return null;
}
export function isUnlocked(id: SkillId, playerLevel: number): boolean { return playerLevel >= SKILLS[id].unlockLevel; }
export function pointsEarned(playerLevel: number, prestigeCount = 0): number {
  if (playerLevel < 1) throw new RangeError('playerLevel must be >= 1');
  return 4 * (playerLevel - 1) + 4 * prestigeCount;
}
export type LedgerBasis = 'user-total' | 'user-available' | 'prestige-known' | 'lower-bound';
export interface PointLedger {
  /** 4*(level-1) */ earnedFromLevels: number;
  /** 4*prestige when the count is known (or derived from a reliable total), else null = UNKNOWN (never silently 0) */ prestigePoints: number | null;
  prestigeKnown: boolean;
  /** smallest prestige count that makes the data legal when prestige is unknown (0 when invested <= earnedFromLevels) */ impliedMinPrestige: number;
  /** earned points used as the optimization budget. For basis 'lower-bound' this is the smallest legal total, NOT a confirmed total. */ earnedTotal: number;
  basis: LedgerBasis; /** false for 'lower-bound': the player may have more points than assumed */ exact: boolean;
  invested: number | null; available: number | null;
  /** false only when SUPPLIED information contradicts the invested points (e.g. prestigeCount=0 but invested > 4*(level-1)) */ consistent: boolean | null;
  note: string;
}
/**
 * Total earned, invested and available skill points. Never interchangeable, and an unknown Prestige count is never treated as a confirmed zero.
 * Reliable inputs, strongest first: totalOverride (the earned total), availablePoints (unspent points shown on the Skills page: earned = invested + available),
 * prestigeCount. Without any of them the earned total is only a LOWER BOUND: 4*(level-1) plus the minimum Prestige needed to cover the invested points.
 */
export function skillPointLedger(a: { level: number; prestigeCount?: number | null; invested?: number | null; totalOverride?: number | null; availablePoints?: number | null }): PointLedger {
  const earnedFromLevels = pointsEarned(a.level, 0);
  const invested = a.invested ?? null;
  const done = (p: Omit<PointLedger, 'earnedFromLevels' | 'invested' | 'available' | 'consistent'> & { consistentOverride?: boolean }): PointLedger => {
    const consistent = invested === null ? null : p.consistentOverride ?? invested <= p.earnedTotal;
    const { consistentOverride: _c, ...rest } = p; void _c;
    return { earnedFromLevels, invested, available: invested !== null && consistent ? p.earnedTotal - invested : null, consistent, ...rest };
  };
  if (a.totalOverride != null) {
    const extra = a.totalOverride - earnedFromLevels;
    return done({ prestigePoints: extra >= 0 && extra % 4 === 0 ? extra : null, prestigeKnown: extra >= 0 && extra % 4 === 0, impliedMinPrestige: 0, earnedTotal: a.totalOverride, basis: 'user-total', exact: true, note: 'earned total supplied by the user' });
  }
  if (a.availablePoints != null && invested !== null) {
    const total = invested + a.availablePoints, extra = total - earnedFromLevels;
    return done({ prestigePoints: extra >= 0 && extra % 4 === 0 ? extra : null, prestigeKnown: extra >= 0 && extra % 4 === 0, impliedMinPrestige: 0, earnedTotal: total, basis: 'user-available', exact: true,
      note: `earned = invested (${invested}) + available (${a.availablePoints}) from the Skills page`, consistentOverride: extra >= 0 });
  }
  if (a.prestigeCount != null) {
    const pp = 4 * a.prestigeCount;
    return done({ prestigePoints: pp, prestigeKnown: true, impliedMinPrestige: a.prestigeCount, earnedTotal: earnedFromLevels + pp, basis: 'prestige-known', exact: true, note: `4*(level-1) + 4*${a.prestigeCount} prestige` });
  }
  const minP = invested !== null && invested > earnedFromLevels ? Math.ceil((invested - earnedFromLevels) / 4) : 0;
  return done({ prestigePoints: null, prestigeKnown: false, impliedMinPrestige: minP, earnedTotal: earnedFromLevels + 4 * minP, basis: 'lower-bound', exact: false,
    note: minP > 0 ? `prestige count unknown: ${invested} invested points imply at least ${minP} Prestige(s); earned is at least ${earnedFromLevels + 4 * minP}` : 'prestige count unknown: earned is at least 4*(level-1); the player may have more' });
}
export function resetCost(spentPoints: number, firstResetFree: boolean): number {
  return firstResetFree ? 0 : spentPoints * 0.5;
}

/** Combat-oriented (War Build) skills: all nine are optimization variables. Wiki ranges: health 100-220, hunger 5-15, attack 100-400, critChance 10-50, critDamage 100-350, armor 0-50, accuracy 50-110, dodge 0-30, lootChance 5-35. */
export const WAR_SKILLS: readonly SkillId[] = ['health', 'hunger', 'attack', 'critChance', 'critDamage', 'armor', 'accuracy', 'dodge', 'lootChance'];
/** Economic Build skills (kept separate from the War Build). */
export const ECON_SKILLS: readonly SkillId[] = ['energy', 'companySlots', 'business', 'production', 'leadership'];
