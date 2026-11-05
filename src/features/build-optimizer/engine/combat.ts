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
  /** 'onePlus': crit hit = A*(1+CD/100). 'direct': A*(CD/100). UNVERIFIED -> needs one in-game calibration. */
  critMultiplier: 'onePlus' | 'direct';
  /** How AMMO and RANK combine (the Pill is NOT part of this: it modifies the Attack skill only). Wiki 03-war §1.6 says they are summed ('additive'). */
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

defineFormula({ id: 'combat.overflow', version: 1, status: 'documented',
  summary: 'Accuracy above 100 -> +3 Attack per point; crit chance above 100 -> +3 crit damage per point. Applied once to skill+gear totals. Whether it occurs before personal boosts is unverified (we apply to base attack).',
  source: 'wiki 01-basics §2.4', inputs: ['accuracyTotal', 'critChanceTotal'], outputs: ['bonusAttack', 'bonusCritDamage'], dependsOn: ['skills.value.endpoints'], tests: ['overflow'] });
defineFormula({ id: 'combat.weaponAmmo', version: 1, status: 'documented',
  summary: 'Firearms without ammo contribute nothing (attack and crit chance); knife needs no ammo.', source: 'wiki 01-basics §3.5', inputs: ['weapon', 'ammo'], outputs: ['weaponActive'], dependsOn: [], tests: ['weapon needs ammo'] });
defineFormula({ id: 'combat.personalBoost', version: 2, status: 'documented',
  summary: 'Ammo and rank bonuses are SUMMED and applied to (effective Attack skill + weapon attack + accuracy-overflow attack). The Pill is NOT part of this sum.',
  source: 'wiki 03-war §1.6 step 2', inputs: ['ammo', 'rank'], outputs: ['personalMultiplier'], dependsOn: [], tests: ['personal boosts additive'] });
defineFormula({ id: 'combat.booster', version: 3, status: 'documented',
  summary: 'Pill (stimulant): a direct modifier to the ATTACK SKILL value only: +50% during the first 6 h after use, -50% during the next 12 h, none afterwards. It does not modify weapon attack, ammo, rank, crit chance, crit damage, accuracy, armor, dodge, loot chance or any other skill, and it does not stack additively or multiplicatively with ammo or rank: it changes the skill value before the weapon is added and before ammo/rank are applied.',
  source: 'project owner 2026-11-01 (supersedes the earlier "+-50% attack modifier" reading); wiki 01-basics §3.6', inputs: ['phase', 'attack skill'], outputs: ['effective attack skill'], dependsOn: [], tests: ['booster phases', 'pill is attack-skill only'] });
defineFormula({ id: 'combat.hitOutcomes', version: 1, status: 'documented',
  summary: 'Accuracy% = clean-hit chance; graze = 50% damage and no crit; crit only on clean hits; luck +-10%; floor, min 1.', source: 'wiki 03-war §1.6', inputs: ['accuracy', 'critChance'], outputs: ['outcomes'], dependsOn: ['combat.overflow', 'combat.personalBoost'], tests: ['hit outcomes'] });
defineFormula({ id: 'combat.critMultiplier', version: 1, status: 'unverified',
  summary: 'Crit multiplier = 1 + critDamage/100 (default) or critDamage/100. Wiki: "extra damage dealt by a critical hit".', source: 'wiki 01-basics §2.4', inputs: ['critDamageTotal'], outputs: ['multiplier'], dependsOn: [], tests: ['crit convention'] });
defineFormula({ id: 'combat.luck', version: 1, status: 'unverified',
  summary: 'Luck +-10%; distribution unknown. Expected value assumes symmetric luck (mean 1); range reports the 0.9/1.1 extremes.', source: 'wiki 03-war §1.6 step 5', inputs: [], outputs: ['mean', 'range'], dependsOn: [], tests: ['hit outcomes'] });
defineFormula({ id: 'combat.battleBonus', version: 1, status: 'estimated',
  summary: 'Positives summed and capped at +100%, penalties summed and capped at -50% (documented); net = capped positives + capped penalties (combination unverified).', source: 'wiki 03-war §1.7', inputs: ['modifiers'], outputs: ['netPct'], dependsOn: [], tests: ['battle bonus caps'] });
defineFormula({ id: 'combat.sustain', version: 1, status: 'estimated',
  summary: 'Health loss/hit = (1-dodge%) * max(1, 10*(1-armorEff%)). Armor>45 and dodge>36 count 50% beyond the threshold (documented); dodge as a % chance and threshold on skill+gear totals are assumptions.', source: 'wiki 01-basics §2.2/2.4, 03-war §1.5', inputs: ['armor', 'dodge', 'health'], outputs: ['healthLossPerHit', 'hitsPerFullHealth'], dependsOn: ['skills.value.linear'], tests: ['sustain'] });
defineFormula({ id: 'combat.bounty', version: 1, status: 'documented',
  summary: 'Bounty pays ratePer1000 gold per 1,000 damage on the eligible side, capped by remaining budget; ineligible players earn nothing.', source: 'wiki 03-war §3.1', inputs: ['damage', 'bounty'], outputs: ['gold'], dependsOn: [], tests: ['bounty'] });

export interface HitModel {
  attackBase: number; attackSkillEffective: number; pillPct: number; personalMultiplier: number; battleMultiplier: number;
  accuracyTotal: number; critChanceTotal: number; critDamageTotal: number;
  cleanChance: number; critChance: number;
  outcomes: { kind: 'graze' | 'clean' | 'crit'; probability: number; damage: number }[];
  expected: number; expectedFloored: number; minPerHit: number; maxPerHit: number;
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
  const used = ['skills.value.linear', 'combat.overflow', 'combat.weaponAmmo', 'combat.personalBoost', 'combat.hitOutcomes', 'combat.critMultiplier', 'combat.luck', 'combat.sustain'];
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
  // Pill: modifies the Attack SKILL value only (before the weapon is added and before ammo/rank are applied)
  const attackSkillEffective = v('attack') * (1 + pillPct / 100);
  const attackBase = attackSkillEffective + (weaponActive ? weapon!.attack : 0) + 3 * accExcess;

  const ammoPct = input.ammo === 'none' ? 0 : AMMO[input.ammo].pct;
  if (input.rankBonusPct === undefined) { missing.push('rankBonusPct'); assumptions.push('Rank bonus unknown: 0% used (flagged missing).'); }
  if (input.booster !== 'none') used.push('combat.booster');
  const rankPct = input.rankBonusPct ?? 0;
  const personalMultiplier = conv.stacking === 'additive' ? 1 + (ammoPct + rankPct) / 100 : (1 + ammoPct / 100) * (1 + rankPct / 100);
  if (input.booster !== 'none') used.push('combat.booster');

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
  const expected = outcomes.reduce((s, o) => s + o.probability * o.damage, 0);
  const expectedFloored = outcomes.reduce((s, o) => s + o.probability * fl(o.damage), 0);
  const active = outcomes.filter((o) => o.probability > 0);
  const minPerHit = Math.min(...active.map((o) => fl(o.damage * 0.9)));
  const maxPerHit = Math.max(...active.map((o) => fl(o.damage * 1.1)));

  const armorEff = diminish(v('armor') + slotVal(input.gear.chest, 'armor', 'chest', missing) + slotVal(input.gear.legs, 'armor', 'legs', missing), 45);
  const dodgeEff = diminish(v('dodge') + slotVal(input.gear.boots, 'dodge', 'boots', missing), 36);
  const healthLossPerHit = (1 - Math.min(dodgeEff, 100) / 100) * Math.max(1, 10 * (1 - Math.min(armorEff, 100) / 100));
  const hitsPerFullHealth = v('health') / healthLossPerHit;

  return { attackBase, attackSkillEffective, pillPct, personalMultiplier, battleMultiplier, accuracyTotal, critChanceTotal, critDamageTotal,
    cleanChance: p, critChance: c, outcomes, expected, expectedFloored, minPerHit, maxPerHit,
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
