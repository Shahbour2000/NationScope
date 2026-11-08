import { defineFormula, weakestStatus, type EvidenceStatus } from './registry';
import { skillValue, type Levels } from './skills';

export type AmmoType = 'none' | 'light' | 'medium' | 'heavy';
export type BoosterPhase = 'none' | 'positive' | 'negative';
/** Documented: wiki 01-basics §3.5. */
export const AMMO: Record<Exclude<AmmoType, 'none'>, { pct: number; lead: number }> = {
  light: { pct: 12, lead: 1 }, medium: { pct: 25, lead: 3 }, heavy: { pct: 45, lead: 12 },
};

export interface WeaponStats { attack: number; critChance: number; usesAmmo: boolean }
/** A slot is absent (undefined => MISSING input, reported), explicitly empty, or an item with known stats. */
export type Slot<T> = { kind: 'empty' } | { kind: 'item'; stats: T };
export interface GearInput {
  weapon?: Slot<WeaponStats>;
  helmet?: Slot<{ critDamage: number }>;
  gloves?: Slot<{ accuracy: number }>;
  chest?: Slot<{ armor: number }>;
  legs?: Slot<{ armor: number }>;
  boots?: Slot<{ dodge: number }>;
}
export interface BattleModifier { id: string; label: string; pct: number; status: EvidenceStatus; source: 'user' | 'battle-screen' | 'derived' }
export interface Bounty { ratePer1000: number; remainingBudget: number; eligible: boolean }
/** War-specific context. Modifiers belong to ONE war + side; never reuse across wars. */
export interface WarContext {
  warId: string;
  side: 'attacker' | 'defender';
  /** Already-eligible modifiers for this player/side (eligibility derivation is a later module). */
  modifiers: BattleModifier[];
  /** If the battle screen total is known, it replaces `modifiers` (prevents double counting). */
  displayedTotalPct?: number;
  bounty?: Bounty;
}
export interface Conventions {
  /** 'onePlus' (Wiki default): a critical hit adds the critical-damage percentage, A*(1+CD/100) (01-basics §2.4 "extra damage", 03-war §1.6 step 4). 'direct' (A*CD/100) is NOT what the Wiki states; kept only as an explicit what-if switch. */
  critMultiplier: 'onePlus' | 'direct';
  /** How the personal boosts (ammo, stimulant/Pill, rank) combine. Wiki 03-war §1.6 step 2 says they are SUMMED ('additive', the default); 'multiplicative' is a what-if switch only. */
  stacking: 'additive' | 'multiplicative';
}
export const DEFAULT_CONVENTIONS: Conventions = { critMultiplier: 'onePlus', stacking: 'additive' };

export interface CombatInput {
  levels: Levels;
  gear: GearInput;
  ammo: AmmoType;
  booster: BoosterPhase;
  /** Military rank attack bonus %, from profile/rank table. undefined => reported missing, 0 used. */
  rankBonusPct?: number;
  war?: WarContext;
  conventions?: Partial<Conventions>;
}

defineFormula({ id: 'combat.overflow', version: 2, status: 'documented',
  summary: 'Accuracy above 100 -> +3 Attack per point; crit chance above 100 -> +3 crit damage per point (Wiki). Computed on the skill+gear totals and applied once.',
  source: 'wiki 01-basics §2.4 "Skill caps and diminishing returns"', inputs: ['accuracyTotal', 'critChanceTotal'], outputs: ['bonusAttack', 'bonusCritDamage'], dependsOn: ['skills.value.endpoints'], tests: ['overflow'] });
defineFormula({ id: 'combat.overflow.order', version: 1, status: 'unverified',
  summary: 'The Wiki says the excess accuracy "becomes Attack" but does not say where it enters the damage pipeline. It is treated as part of the Attack stat (step 1, before the personal boosts of step 2). UNRESOLVED: not stated by the Wiki.',
  source: 'wiki 01-basics §2.4 (rate) / 03-war §1.6 (order not stated)', inputs: ['accuracyTotal'], outputs: ['attackBase'], dependsOn: ['combat.overflow'], tests: ['overflow'] });
defineFormula({ id: 'combat.weaponAmmo', version: 1, status: 'documented',
  summary: 'Firearms without ammo contribute nothing (attack and crit chance) and do not wear; the knife needs no ammo.', source: 'wiki 01-basics §3.5', inputs: ['weapon', 'ammo'], outputs: ['weaponActive'], dependsOn: [], tests: ['weapon needs ammo'] });
defineFormula({ id: 'combat.personalBoost', version: 3, status: 'documented',
  summary: 'Step 1: Attack = Attack skill + weapon attack (+ accuracy overflow). Step 2: the ammo, stimulant (Pill) and rank bonuses are SUMMED and applied to that attack: A = (skill + weapon) * (1 + (ammo% + stimulant% + rank%)/100).',
  source: 'wiki 03-war §1.6 steps 1-2', inputs: ['ammo', 'stimulant', 'rank'], outputs: ['personalMultiplier'], dependsOn: [], tests: ['personal boosts additive', 'wiki: personal boosts are summed'] });
defineFormula({ id: 'combat.booster', version: 4, status: 'documented',
  summary: 'Stimulant (Pill): +50% attack during the first 6 h, then -50% attack for 12 h, none afterwards (01-basics §3.6). Per 03-war §1.6 step 2 the stimulant is one of the personal boosts that are summed with ammo and rank. NOTE: an earlier project-owner description (2026-11-01) modelled it as an Attack-skill-only modifier outside that sum; the Wiki takes priority, so the sum is used. The old reading is not available as a switch.',
  source: 'wiki 01-basics §3.6; wiki 03-war §1.6 step 2', inputs: ['phase'], outputs: ['pillPct'], dependsOn: [], tests: ['booster phases', 'wiki: personal boosts are summed'] });
defineFormula({ id: 'combat.hitOutcomes', version: 2, status: 'documented',
  summary: 'Accuracy% = clean-hit chance (capped at 100); a miss is a graze: 50% damage and no crit. Crit only on clean hits, with probability = crit chance (capped at 100), and adds the critical-damage percentage.',
  source: 'wiki 03-war §1.6 steps 3-4', inputs: ['accuracy', 'critChance'], outputs: ['outcomes'], dependsOn: ['combat.overflow', 'combat.personalBoost'], tests: ['hit outcomes', 'wiki: hit pipeline'] });
defineFormula({ id: 'combat.critMultiplier', version: 2, status: 'documented',
  summary: 'A critical hit multiplies damage by 1 + critDamage/100 (critical damage is "extra damage dealt by a critical hit": 100 at skill level 0, so a base crit deals double).',
  source: 'wiki 01-basics §2.4 (skill table), 03-war §1.6 step 4', inputs: ['critDamageTotal'], outputs: ['multiplier'], dependsOn: [], tests: ['crit convention', 'wiki: hit pipeline'] });
defineFormula({ id: 'combat.rounding', version: 1, status: 'documented',
  summary: 'After all bonuses the result is rounded DOWN, with a minimum damage of 1. The per-hit figure used for scoring is the probability-weighted sum of these floored outcomes.',
  source: 'wiki 03-war §1.6 step 7', inputs: ['outcome damage'], outputs: ['floored damage'], dependsOn: [], tests: ['wiki: rounding and minimum damage'] });
defineFormula({ id: 'combat.luck', version: 2, status: 'documented',
  summary: 'Luck varies damage by up to 10% up or down (the documented RANGE). minPerHit/maxPerHit report the floored 0.9x / 1.1x extremes.',
  source: 'wiki 03-war §1.6 step 5', inputs: [], outputs: ['range'], dependsOn: [], tests: ['wiki: luck range only'] });
defineFormula({ id: 'combat.luck.distribution', version: 1, status: 'unverified',
  summary: 'The Wiki gives the luck range but NOT its probability distribution, so no distribution is assumed. The central per-hit figure is computed with luck fixed at 1.0 (no luck effect); it is NOT an expected value over luck. UNRESOLVED: distribution not stated by the Wiki.',
  source: 'wiki 03-war §1.6 step 5 (silent)', inputs: [], outputs: [], dependsOn: ['combat.luck'], tests: ['wiki: luck range only'] });
defineFormula({ id: 'combat.battleBonus', version: 2, status: 'documented',
  summary: 'Battle bonuses are summed and capped at +100%; penalties are summed and capped at -50%; the two capped totals are combined (literal reading of "maximum total of bonuses +100%, of penalties -50%"). Eligibility of each bonus is supplied by the caller.',
  source: 'wiki 03-war §1.7', inputs: ['modifiers'], outputs: ['netPct'], dependsOn: [], tests: ['battle bonus caps', 'wiki: battle bonus caps'] });
defineFormula({ id: 'combat.sustain', version: 2, status: 'estimated',
  summary: 'Health loss per hit = 10 reduced by armor, minimum 1 (Wiki); armor above 45 and dodge above 36 count at 50% (Wiki). NOT stated by the Wiki and therefore assumed: that an armor point equals one percentage point of reduction, that dodge points are a percentage chance, and that the health cost is not rounded.',
  source: 'wiki 01-basics §2.2/§2.4, 03-war §1.5', inputs: ['armor', 'dodge', 'health'], outputs: ['healthLossPerHit', 'hitsPerFullHealth'], dependsOn: ['skills.value.linear'], tests: ['sustain', 'wiki: health cost per hit'] });
defineFormula({ id: 'combat.conventions.whatif', version: 1, status: 'unverified',
  summary: 'The critMultiplier "direct" and stacking "multiplicative" switches are NOT what the Wiki states. A result computed with either is a what-if and is labelled Unverified.',
  source: 'wiki 01-basics §2.4, 03-war §1.6 (the defaults follow the Wiki)', inputs: ['conventions'], outputs: [], dependsOn: ['combat.critMultiplier', 'combat.personalBoost'], tests: ['crit convention', 'wiki: personal boosts are summed'] });
defineFormula({ id: 'combat.bounty', version: 1, status: 'documented',
  summary: 'Bounty pays ratePer1000 gold per 1,000 damage on the eligible side, capped by remaining budget; ineligible players earn nothing.', source: 'wiki 03-war §3.1', inputs: ['damage', 'bounty'], outputs: ['gold'], dependsOn: [], tests: ['bounty'] });

export interface HitModel {
  attackBase: number; attackSkillEffective: number; pillPct: number; personalMultiplier: number; battleMultiplier: number;
  accuracyTotal: number; critChanceTotal: number; critDamageTotal: number;
  cleanChance: number; critChance: number;
  outcomes: { kind: 'graze' | 'clean' | 'crit'; probability: number; damage: number }[];
  /** Central per-hit damage per the Wiki: probability-weighted sum of floored (min 1) outcomes with luck fixed at 1.0. NOT an expectation over luck (the Wiki gives no luck distribution). */
  expected: number;
  /** Same weighting WITHOUT rounding; diagnostic only, never used for scoring. */
  expectedUnrounded: number;
  /** Floored (min 1) extremes of the documented +-10% luck range. */
  minPerHit: number; maxPerHit: number;
  healthLossPerHit: number; hitsPerFullHealth: number; dodgeProbability: number;
  missing: string[]; assumptions: string[]; usedFormulas: string[]; evidence: EvidenceStatus;
}

const slotVal = <T, K extends keyof T>(slot: Slot<T> | undefined, key: K, name: string, missing: string[]): number => {
  if (slot === undefined) { missing.push(`gear.${name}`); return 0; }
  return slot.kind === 'item' ? (slot.stats[key] as unknown as number) : 0;
};
/** value beyond `threshold` counts at 50% (documented for armor>45, dodge>36). */
const diminish = (v: number, threshold: number) => (v <= threshold ? v : threshold + (v - threshold) / 2);

export function battleModifierPct(mods: BattleModifier[]): number {
  let pos = 0, neg = 0;

  for (const m of mods) {
    if (m.pct >= 0) {
      pos += m.pct;
    } else {
      neg += m.pct;
    }
  }

  return Math.min(pos, 100) + Math.max(neg, -50);
}

export function computeHit(input: CombatInput): HitModel {
  const conv = { ...DEFAULT_CONVENTIONS, ...input.conventions };
  const missing: string[] = [], assumptions: string[] = [];
  const used = ['skills.value.linear', 'combat.overflow', 'combat.weaponAmmo', 'combat.personalBoost', 'combat.hitOutcomes', 'combat.critMultiplier', 'combat.rounding', 'combat.luck', 'combat.sustain'];
  const v = (id: keyof Levels) => skillValue(id, input.levels[id]);

  const w = input.gear.weapon;
  if (w === undefined) missing.push('gear.weapon');
  const weapon = w && w.kind === 'item' ? w.stats : null;
  const weaponActive = !!weapon && (!weapon.usesAmmo || input.ammo !== 'none');
  if (weapon && !weaponActive) assumptions.push('Firearm equipped without ammo: weapon contributes nothing (documented).');

  const accuracyTotal = v('accuracy') + slotVal(input.gear.gloves, 'accuracy', 'gloves', missing);
  const critChanceTotal = v('critChance') + (weaponActive ? weapon!.critChance : 0);
  const critDamageBase = v('critDamage') + slotVal(input.gear.helmet, 'critDamage', 'helmet', missing);
  const accExcess = Math.max(0, accuracyTotal - 100), critExcess = Math.max(0, critChanceTotal - 100);
  const critDamageTotal = critDamageBase + 3 * critExcess;
  const pillPct = input.booster === 'positive' ? 50 : input.booster === 'negative' ? -50 : 0;
  // Wiki 03-war §1.6 step 1: Attack = Attack skill + weapon attack (accuracy overflow counts as Attack).
  const attackSkillEffective = v('attack');
  const attackBase = attackSkillEffective + (weaponActive ? weapon!.attack : 0) + 3 * accExcess;

  const ammoPct = input.ammo === 'none' ? 0 : AMMO[input.ammo].pct;
  if (input.rankBonusPct === undefined) { missing.push('rankBonusPct'); assumptions.push('Rank bonus unknown: 0% used (flagged missing).'); }
  const rankPct = input.rankBonusPct ?? 0;
  // Wiki 03-war §1.6 step 2: ammo, stimulant (Pill) and rank bonuses are summed and applied.
  const personalMultiplier = Math.max(0, conv.stacking === 'additive' ? 1 + (ammoPct + pillPct + rankPct) / 100 : (1 + ammoPct / 100) * (1 + pillPct / 100) * (1 + rankPct / 100));
  if (input.booster !== 'none') used.push('combat.booster');
  if (conv.critMultiplier !== 'onePlus' || conv.stacking !== 'additive') { used.push('combat.conventions.whatif'); assumptions.push('A non-Wiki convention switch is active (crit multiplier or stacking): this result is a what-if.'); }
  if (accExcess > 0) used.push('combat.overflow.order'); // the Wiki does not state where excess accuracy enters the pipeline
  assumptions.push('Luck: the Wiki gives only a +-10% range, no distribution. The per-hit figure is computed with luck fixed at 1.0 (no luck effect) and is not an expectation over luck; min/max show the documented range.');

  let battlePct = 0;
  if (input.war) {
    used.push('combat.battleBonus');
    battlePct = input.war.displayedTotalPct ?? battleModifierPct(input.war.modifiers);
  } else assumptions.push('No war context: battle bonuses = 0%.');
  const battleMultiplier = Math.max(0, 1 + battlePct / 100);

  const A = attackBase * personalMultiplier;
  const p = Math.min(accuracyTotal, 100) / 100, c = Math.min(critChanceTotal, 100) / 100;
  const critMult = conv.critMultiplier === 'onePlus' ? 1 + critDamageTotal / 100 : critDamageTotal / 100;
  const raw = { graze: 0.5 * A * battleMultiplier, clean: A * battleMultiplier, crit: A * critMult * battleMultiplier };
  const outcomes = [
    { kind: 'graze' as const, probability: 1 - p, damage: raw.graze },
    { kind: 'clean' as const, probability: p * (1 - c), damage: raw.clean },
    { kind: 'crit' as const, probability: p * c, damage: raw.crit },
  ];
  const fl = (x: number) => Math.max(1, Math.floor(x));
  // Wiki 03-war §1.6 step 7: round down, minimum damage 1. Scoring uses the rounded outcomes (luck-neutral).
  const expectedUnrounded = outcomes.reduce((s, o) => s + o.probability * o.damage, 0);
  const expected = outcomes.reduce((s, o) => s + o.probability * fl(o.damage), 0);
  const active = outcomes.filter((o) => o.probability > 0);
  const minPerHit = Math.min(...active.map((o) => fl(o.damage * 0.9)));
  const maxPerHit = Math.max(...active.map((o) => fl(o.damage * 1.1)));

  const armorEff = diminish(v('armor') + slotVal(input.gear.chest, 'armor', 'chest', missing) + slotVal(input.gear.legs, 'armor', 'legs', missing), 45);
  const dodgeEff = diminish(v('dodge') + slotVal(input.gear.boots, 'dodge', 'boots', missing), 36);
  const healthLossPerHit = (1 - Math.min(dodgeEff, 100) / 100) * Math.max(1, 10 * (1 - Math.min(armorEff, 100) / 100));
  const hitsPerFullHealth = v('health') / healthLossPerHit;

  return { attackBase, attackSkillEffective, pillPct, personalMultiplier, battleMultiplier, accuracyTotal, critChanceTotal, critDamageTotal,
    cleanChance: p, critChance: c, outcomes, expected, expectedUnrounded, minPerHit, maxPerHit,
    healthLossPerHit, hitsPerFullHealth, dodgeProbability: Math.min(dodgeEff, 100) / 100, missing: [...new Set(missing)], assumptions, usedFormulas: used, evidence: weakestStatus(used) };
}

export interface Prices { leadPerUnit?: number }
export interface Horizon {
  hits: number; expectedDamage: number; rounds: number;
  ammoCost: number | null; bountyIncome: number | null; net: number | null; notes: string[];
}
/** Totals over N hits. Unknown prices stay null (never silently 0). */
export function horizon(model: HitModel, ammo: AmmoType, hits: number, prices: Prices, war?: WarContext): Horizon {
  const notes: string[] = [];
  const expectedDamage = hits * model.expected;
  const rounds = ammo === 'none' ? 0 : hits;
  const ammoCost = ammo === 'none' ? 0 : prices.leadPerUnit === undefined ? null : rounds * AMMO[ammo].lead * prices.leadPerUnit;
  if (ammoCost === null) notes.push('Lead price unknown: ammo cost not computed.');
  let bountyIncome: number | null = 0;
  if (war?.bounty) {
    bountyIncome = war.bounty.eligible ? Math.min((expectedDamage / 1000) * war.bounty.ratePer1000, war.bounty.remainingBudget) : 0;
    if (!war.bounty.eligible) notes.push('Player ineligible for this bounty: income 0.');
  } else notes.push('No bounty supplied: income 0.');
  const net = ammoCost === null ? null : bountyIncome - ammoCost;
  return { hits, expectedDamage, rounds, ammoCost, bountyIncome, net, notes };
}
