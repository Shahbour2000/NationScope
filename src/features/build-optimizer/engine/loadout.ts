import { defineFormula } from './registry';
import { AMMO, computeHit, horizon, type AmmoType, type BoosterPhase, type CombatInput, type GearInput, type HitModel, type WarContext, type WeaponStats } from './combat';
import type { Levels } from './skills';
import { skillValue } from './skills';

defineFormula({ id: 'loadout.durability', version: 1, status: 'estimated',
  summary: 'Items start at durability 100 and lose 1 per hit; on a dodged hit only the weapon wears (documented). Dodge probability = effective dodge % (assumption). Weapon without ammo does not wear (documented). Replacement is modelled only when a price is supplied; repair mechanics are not invented.',
  source: 'wiki 01-basics §3.4, §3.5', inputs: ['hits', 'dodge', 'durability'], outputs: ['wear', 'replacements'], dependsOn: ['combat.sustain'], tests: ['durability'] });
defineFormula({ id: 'loadout.food', version: 1, status: 'estimated',
  summary: 'Meals = ceil(max(0, hits*lossPerHit - startHealth + reserve) / (restorePct*maxHealth)); each meal costs 1 hunger. Eating timing/over-heal waste is simplified.',
  source: 'wiki 01-basics §2.3', inputs: ['hits', 'healthLossPerHit', 'maxHealth', 'hunger'], outputs: ['meals', 'cost', 'feasible'], dependsOn: ['combat.sustain'], tests: ['food plan'] });
defineFormula({ id: 'loadout.search', kind: 'algorithm', version: 1, status: 'documented',
  summary: 'Exhaustive Cartesian search over candidate items x ammo (small lists), ranked deterministically by the chosen objective subject to budget and stock.',
  source: 'engine design', inputs: ['candidates', 'ammo', 'budget'], outputs: ['ranked loadouts'], dependsOn: ['combat.hitOutcomes'], tests: ['loadout search'] });

export type AnyItem = Item<WeaponStats | { critDamage: number } | { accuracy: number } | { armor: number } | { dodge: number }>;
export interface Item<T> { id: string; stats: T; durability: number; /** gold to acquire; undefined = already owned */ price?: number }
export interface Candidates {
  weapons: Item<WeaponStats>[]; helmets?: Item<{ critDamage: number }>[]; gloves?: Item<{ accuracy: number }>[];
  chests?: Item<{ armor: number }>[]; legs?: Item<{ armor: number }>[]; boots?: Item<{ dodge: number }>[];
}
export type FoodType = 'bread' | 'steak' | 'cookedFish';
export const FOOD_PCT: Record<FoodType, number> = { bread: 12, steak: 18, cookedFish: 25 };

export interface FoodPlan { food: FoodType; meals: number; cost: number | null; feasible: boolean; wastedHealthEstimate: number }
export function foodPlan(model: HitModel, hits: number, maxHealth: number, startHealth: number, hungerAvailable: number, food: FoodType, price?: number, reserve = 10): FoodPlan {
  const need = Math.max(0, hits * model.healthLossPerHit - startHealth + reserve);
  const restore = (FOOD_PCT[food] / 100) * maxHealth;
  const meals = Math.ceil(need / restore - 1e-9);
  return { food, meals, cost: price === undefined ? null : meals * price, feasible: meals <= hungerAvailable, wastedHealthEstimate: meals * restore - need };
}
export interface Wear { slot: string; wearPerHit: number; hitsUntilBreak: number }

export interface LoadoutContext {
  levels: Levels; rankBonusPct?: number; booster: BoosterPhase; war?: WarContext; hits: number;
  ammoOptions: AmmoType[];
  /** lead price (gold/unit) and stock; stock shortfall is bought if price known, else candidate is infeasible */
  leadPrice?: number; leadStock?: number;
  /** gold available for acquiring items + buying missing ammo + replacements; undefined = unlimited */
  budget?: number;
  /** price paid to replace a broken item of the same kind is item.price if known, else unknown -> flagged */
  objective: 'maxDamage' | 'minCostPer1000' | 'maxNet';
  topK?: number; maxCombos?: number;
}
export interface LoadoutResult {
  ids: Record<string, string | null>; ammo: AmmoType; gear: GearInput; hit: HitModel;
  expectedDamage: number; acquisitionCost: number; ammoCost: number | null; replacementCost: number | null; totalCost: number | null;
  costPer1000: number | null; net: number | null; wear: Wear[]; breaksDuringHorizon: string[]; leadShortfall: number; score: number; notes: string[];
}

export function evaluateLoadouts(c: Candidates, ctx: LoadoutContext): { ok: true; results: LoadoutResult[]; combos: number; excluded: number } | { ok: false; message: string } {
  const slots: { key: keyof Candidates; gearKey: keyof GearInput; list: (AnyItem | null)[] }[] = [
    { key: 'weapons', gearKey: 'weapon', list: c.weapons.length ? c.weapons : [null] },
    { key: 'helmets', gearKey: 'helmet', list: [...(c.helmets ?? []), null] },
    { key: 'gloves', gearKey: 'gloves', list: [...(c.gloves ?? []), null] },
    { key: 'chests', gearKey: 'chest', list: [...(c.chests ?? []), null] },
    { key: 'legs', gearKey: 'legs', list: [...(c.legs ?? []), null] },
    { key: 'boots', gearKey: 'boots', list: [...(c.boots ?? []), null] },
  ];
  const combos = slots.reduce((n, s) => n * s.list.length, 1) * ctx.ammoOptions.length;
  if (combos > (ctx.maxCombos ?? 300_000)) return { ok: false, message: `Search space ${combos} exceeds maxCombos; shorten candidate lists.` };
  if (ctx.objective !== 'maxDamage' && ctx.objective !== 'minCostPer1000' && ctx.objective !== 'maxNet') return { ok: false, message: 'unknown objective' };
  const results: LoadoutResult[] = [];
  let excluded = 0;
  const pick: (AnyItem | null)[] = new Array(slots.length).fill(null);
  const rec = (i: number): void => {
    if (i < slots.length) { for (const it of slots[i]!.list) { pick[i] = it; rec(i + 1); } return; }
    for (const ammo of ctx.ammoOptions) {
      const r = evalOne(pick, slots.map((s) => s.gearKey), ammo, ctx);
      if (r) results.push(r); else excluded++;
    }
  };
  rec(0);
  results.sort((a, b) => b.score - a.score || a.ids.weapon!.localeCompare(b.ids.weapon ?? '') || JSON.stringify(a.ids).localeCompare(JSON.stringify(b.ids)));
  return { ok: true, results: results.slice(0, ctx.topK ?? 3), combos, excluded };
}

function evalOne(pick: (AnyItem | null)[], gearKeys: (keyof GearInput)[], ammo: AmmoType, ctx: LoadoutContext): LoadoutResult | null {
  const gear: GearInput = {};
  const ids: Record<string, string | null> = {};
  gearKeys.forEach((k, i) => {
    const it = pick[i];
    (gear as Record<string, unknown>)[k] = it ? { kind: 'item', stats: it.stats } : { kind: 'empty' };
    ids[k as string] = it ? it.id : null;
  });
  const input: CombatInput = { levels: ctx.levels, gear, ammo, booster: ctx.booster, rankBonusPct: ctx.rankBonusPct, war: ctx.war };
  const hit = computeHit(input);
  const notes: string[] = [];
  const weaponItem = pick[0];
  const weaponActive = !!weaponItem && (!(weaponItem.stats as WeaponStats).usesAmmo || ammo !== 'none');
  const h = horizon(hit, ammo, ctx.hits, { leadPerUnit: ctx.leadPrice }, ctx.war);
  const roundsLead = ammo === 'none' ? 0 : ctx.hits * AMMO[ammo].lead;
  let leadShortfall = 0, ammoCost: number | null = 0;
  if (ammo !== 'none') {
    if (ctx.leadStock !== undefined) {
      leadShortfall = Math.max(0, roundsLead - ctx.leadStock);
      if (leadShortfall > 0 && ctx.leadPrice === undefined) return null; // cannot cover ammo, price unknown
      ammoCost = ctx.leadPrice === undefined ? 0 : leadShortfall * ctx.leadPrice;
      if (leadShortfall === 0) notes.push('Ammo covered by stock (cost counted as 0 gold cash).');
    } else ammoCost = h.ammoCost;
  }
  const acquisitionCost = pick.reduce((s, it) => s + (it?.price ?? 0), 0);
  const dodgeP = Math.min(1, hit.dodgeProbability);
  const wear: Wear[] = [];
  let replacementCost: number | null = 0;
  const breaks: string[] = [];
  gearKeys.forEach((k, i) => {
    const it = pick[i]; if (!it) return;
    const wearPerHit = k === 'weapon' ? (weaponActive ? 1 : 0) : 1 - dodgeP;
    const hitsUntilBreak = wearPerHit === 0 ? Infinity : it.durability / wearPerHit;
    wear.push({ slot: k as string, wearPerHit, hitsUntilBreak });
    if (hitsUntilBreak < ctx.hits) {
      breaks.push(k as string);
      const extra = Math.ceil((ctx.hits * wearPerHit) / it.durability) - 1;
      if (it.price === undefined) { replacementCost = null; notes.push(`${k} breaks during the horizon; replacement price unknown.`); }
      else if (replacementCost !== null) replacementCost += extra * it.price;
    }
  });
  const total = ammoCost === null || replacementCost === null ? null : acquisitionCost + ammoCost + replacementCost;
  if (ctx.budget !== undefined && (total === null || total > ctx.budget)) {
    if (total !== null) return null;
    notes.push('Budget cannot be checked: some prices unknown.');
  }
  const bounty = h.bountyIncome ?? 0;
  const net = total === null ? null : bounty - total;
  const costPer1000 = total === null || h.expectedDamage <= 0 ? null : (total / h.expectedDamage) * 1000;
  let score: number;
  if (ctx.objective === 'maxDamage') score = h.expectedDamage;
  else if (ctx.objective === 'minCostPer1000') { if (costPer1000 === null) return null; score = -costPer1000; }
  else { if (net === null) return null; score = net; }
  return { ids, ammo, gear, hit, expectedDamage: h.expectedDamage, acquisitionCost, ammoCost, replacementCost, totalCost: total, costPer1000, net, wear, breaksDuringHorizon: breaks, leadShortfall, score, notes };
}
export { skillValue };
