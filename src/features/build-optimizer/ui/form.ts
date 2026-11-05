import { SKILL_IDS, type SkillId } from '../engine/skills';
import { SLOT_KEYS, parseOptimizeInput, type OptimizeInput, type SlotKey } from '../api-schema';
import type { ImportVM } from '../view-model';

/** Pure form logic (no React): defaults, which inputs a goal needs, validation (message keys, translated by the UI) and the request body. */
export type Mode = 'war' | 'economic' | 'hybrid';
export type AmmoKey = 'none' | 'light' | 'medium' | 'heavy';
export type FoodKey = 'bread' | 'steak' | 'cookedFish';
export interface SlotForm { equipped: boolean; stat1: string; stat2: string; usesAmmo: boolean; durability: string }
export interface BattleForm { start: string; duration: string; hits: string }
export interface ConstraintForm { skill: SkillId; kind: 'min' | 'max' | 'exact'; level: string }
export interface FormState {
  mode: Mode; warKind: 'fixedHits' | 'sustainable'; gearMode: 'fixed' | 'optimize'; objective: 'maxDamage' | 'bestValue' | 'maxNet';
  pointsMethod: 'unknown' | 'available' | 'total' | 'prestige'; prestige: string; totalPoints: string; availablePoints: string; firstReset: 'unknown' | 'free' | 'used';
  keepCurrent: boolean;
  hits: string; startHealthPct: string; startHunger: string; startKnown: boolean;
  ammo: Record<AmmoKey, boolean>; leadStock: string; buyAmmo: boolean;
  food: Record<FoodKey, { use: boolean; price: string; stock: string }>;
  budget: string; minSharePct: string; goldPerDamage: string; crateValue: string;
  gear: Record<SlotKey, SlotForm>; useMarket: boolean; allowEmpty: boolean; estimate: 'low' | 'mid' | 'high';
  pill: { enabled: boolean; state: 'unknown' | 'none' | 'buff' | 'debuff'; minutes: string; costMode: 'buy' | 'craft' | 'owned'; price: string; battles: BattleForm[] };
  constraints: ConstraintForm[];
  econ: { marketTax: string; incomeTax: string; productionTax: string; jobWage: string; sellBasis: 'bid' | 'last' | 'ask'; workerPoints: string; workerWage: string };
  hybrid: { kind: 'constrained' | 'weighted'; minDailyNet: string; wCombat: string; wEconomy: string };
}
const slot = (): SlotForm => ({ equipped: false, stat1: '', stat2: '', usesAmmo: true, durability: '' });
export const defaultForm = (): FormState => ({
  mode: 'war', warKind: 'fixedHits', gearMode: 'optimize', objective: 'maxDamage',
  pointsMethod: 'unknown', prestige: '', totalPoints: '', availablePoints: '', firstReset: 'unknown', keepCurrent: false,
  hits: '30', startHealthPct: '100', startHunger: '', startKnown: false,
  ammo: { none: true, light: true, medium: false, heavy: false }, leadStock: '', buyAmmo: true,
  food: { bread: { use: true, price: '', stock: '' }, steak: { use: true, price: '', stock: '' }, cookedFish: { use: true, price: '', stock: '' } },
  budget: '', minSharePct: '80', goldPerDamage: '', crateValue: '',
  gear: { weapon: slot(), helmet: slot(), gloves: slot(), chest: slot(), legs: slot(), boots: slot() }, useMarket: true, allowEmpty: true, estimate: 'low',
  pill: { enabled: false, state: 'unknown', minutes: '', costMode: 'buy', price: '', battles: [{ start: '0', duration: '30', hits: '30' }] },
  constraints: [],
  econ: { marketTax: '', incomeTax: '', productionTax: '', jobWage: '', sellBasis: 'bid', workerPoints: '', workerWage: '' },
  hybrid: { kind: 'constrained', minDailyNet: '0', wCombat: '1', wEconomy: '1' },
});

const n = (s: string): number | undefined => { const t = s.trim().replace(',', '.'); if (t === '') return undefined; const v = Number(t); return Number.isFinite(v) ? v : Number.NaN; };

/** Which input groups the chosen goal needs (the UI only shows these, so nothing is asked for that cannot change the result). */
export interface Sections { points: boolean; fight: boolean; gear: boolean; consumables: boolean; objective: boolean; pill: boolean; constraints: boolean; economic: boolean; hybrid: boolean }
export function sectionsFor(f: FormState): Sections {
  const war = f.mode === 'war', hyb = f.mode === 'hybrid', eco = f.mode !== 'war';
  return {
    points: true, fight: war, gear: war || hyb, consumables: war, objective: war, pill: war && f.warKind === 'fixedHits', constraints: true, economic: eco, hybrid: hyb,
  };
}
/** Fixed Gear needs all six slots to be answered (equipped with stats, or explicitly empty). */
export function fixedGearComplete(f: FormState): boolean {
  return SLOT_KEYS.every((k) => { const s = f.gear[k]; if (!s.equipped) return true; return n(s.stat1) !== undefined && !Number.isNaN(n(s.stat1)) && (k !== 'weapon' || (n(s.stat2) !== undefined && !Number.isNaN(n(s.stat2)))); });
}

export type FormIssue = { key: string; field?: string };
/** Client-side checks, as translation keys. The server validates again; these exist so the user sees what is missing before running. */
export function validate(f: FormState, imp: ImportVM | null): FormIssue[] {
  const out: FormIssue[] = [];
  if (!imp) { out.push({ key: 'needPlayer' }); return out; }
  if (imp.skills === null) out.push({ key: 'noSkills' });
  const sec = sectionsFor(f);
  const bad = (s: string) => { const v = n(s); return v !== undefined && Number.isNaN(v); };
  if (f.pointsMethod === 'available' && n(f.availablePoints) === undefined) out.push({ key: 'needAvailable', field: 'availablePoints' });
  if (f.pointsMethod === 'total' && n(f.totalPoints) === undefined) out.push({ key: 'needTotal', field: 'totalPoints' });
  if (f.pointsMethod === 'prestige' && n(f.prestige) === undefined) out.push({ key: 'needPrestige', field: 'prestige' });
  if (sec.fight && f.warKind === 'fixedHits') { const h = n(f.hits); if (h === undefined || Number.isNaN(h) || h < 1) out.push({ key: 'needHits', field: 'hits' }); }
  if (sec.gear && f.mode === 'war') for (const k of SLOT_KEYS) { const g = f.gear[k]; if (!g.equipped) continue; const d = n(g.durability); if (d !== undefined && (Number.isNaN(d) || d < 1 || d > 100)) out.push({ key: 'badDurability', field: `gear.${k}` }); }
  if (sec.fight && !Object.values(f.ammo).some(Boolean)) out.push({ key: 'needAmmo', field: 'ammo' });
  if (sec.gear && f.gearMode === 'fixed' && f.mode === 'war' && !fixedGearComplete(f)) out.push({ key: 'needGearStats', field: 'gear' });
  if (sec.gear && f.gearMode === 'optimize' && f.mode === 'war') {
    for (const k of SLOT_KEYS) { const s = f.gear[k]; if (s.equipped && s.durability.trim() !== '' && (bad(s.durability) || bad(s.stat1))) out.push({ key: 'badNumber', field: `gear.${k}` }); }
    if (!f.useMarket && !SLOT_KEYS.some((k) => f.gear[k].equipped && n(f.gear[k].durability) !== undefined)) out.push({ key: 'needCandidates', field: 'gear' });
  }
  if (sec.objective) {
    const priced = (['bread', 'steak', 'cookedFish'] as FoodKey[]).filter((k) => f.food[k].use);
    if (priced.length === 0 && f.mode === 'war') out.push({ key: 'needFood', field: 'food' });
    if ((f.objective === 'bestValue' || f.objective === 'maxNet' || n(f.budget) !== undefined) && priced.some((k) => n(f.food[k].price) === undefined)) out.push({ key: 'needFoodPrices', field: 'food' });
    if (f.objective === 'maxNet' && n(f.goldPerDamage) === undefined && n(f.crateValue) === undefined) out.push({ key: 'needRevenue', field: 'goldPerDamage' });
    if (f.objective === 'bestValue') { const s = n(f.minSharePct); if (s === undefined || Number.isNaN(s) || s < 1 || s > 100) out.push({ key: 'badShare', field: 'minSharePct' }); }
    if (f.objective !== 'maxDamage' && Object.entries(f.ammo).some(([k, v]) => v && k !== 'none') && imp.market.loaded === false && n(f.leadStock) === undefined) out.push({ key: 'needLeadPrice', field: 'leadStock' });
  }
  if (sec.pill && f.pill.enabled) {
    if (f.pill.state === 'unknown') out.push({ key: 'needPillState', field: 'pill.state' });
    if ((f.pill.state === 'buff' || f.pill.state === 'debuff') && n(f.pill.minutes) === undefined) out.push({ key: 'needPillMinutes', field: 'pill.minutes' });
    if (f.pill.battles.length === 0) out.push({ key: 'needBattle', field: 'pill.battles' });
  }
  if (sec.economic && !imp.market.loaded) out.push({ key: 'needMarket' });
  if (sec.economic && f.econ.marketTax.trim() === '') out.push({ key: 'warnTaxes', field: 'econ.marketTax' }); // advisory: engine assumes 0% and says so
  if (sec.hybrid) {
    if (f.hybrid.kind === 'constrained' && n(f.hybrid.minDailyNet) === undefined) out.push({ key: 'needMinNet', field: 'hybrid.minDailyNet' });
    if (f.hybrid.kind === 'weighted' && (n(f.hybrid.wCombat) === undefined || n(f.hybrid.wEconomy) === undefined)) out.push({ key: 'needWeights', field: 'hybrid.weights' });
  }
  for (const c of f.constraints) { const v = n(c.level); if (v === undefined || Number.isNaN(v) || v < 0 || v > 10) out.push({ key: 'badConstraint', field: `constraint.${c.skill}` }); }
  return out;
}
/** Advisory keys do not block the run. */
export const ADVISORY = new Set(['warnTaxes']);

export function toRequestBody(f: FormState, playerId: string): unknown {
  const gear: Record<string, unknown> = {};
  for (const k of SLOT_KEYS) { const s = f.gear[k]; gear[k] = s.equipped ? { equipped: true, stat1: n(s.stat1), stat2: k === 'weapon' ? n(s.stat2) : undefined, usesAmmo: k === 'weapon' ? s.usesAmmo : undefined, durability: n(s.durability) } : { equipped: false }; }
  const owned: Record<string, unknown> = {};
  for (const k of SLOT_KEYS) if (f.gear[k].equipped && n(f.gear[k].durability) !== undefined) owned[k] = gear[k];
  const ammo = (Object.keys(f.ammo) as AmmoKey[]).filter((a) => f.ammo[a]);
  const food = (Object.keys(f.food) as FoodKey[]).filter((k) => f.food[k].use).map((k) => ({ type: k, price: n(f.food[k].price), stock: n(f.food[k].stock) }));
  const user = {
    prestigeCount: f.pointsMethod === 'prestige' ? n(f.prestige) : undefined, totalSkillPoints: f.pointsMethod === 'total' ? n(f.totalPoints) : undefined,
    availableSkillPoints: f.pointsMethod === 'available' ? n(f.availablePoints) : undefined, firstResetFree: f.firstReset === 'unknown' ? undefined : f.firstReset === 'free',
  };
  const sec = sectionsFor(f);
  return {
    playerId, mode: f.mode, user, keepCurrentSkills: f.keepCurrent,
    constraints: f.constraints.map((c) => ({ skill: c.skill, kind: c.kind, level: n(c.level) })),
    war: {
      kind: f.warKind, hits: n(f.hits) ?? 20, gearMode: f.mode === 'war' ? f.gearMode : 'optimize', fixedGear: sec.gear && f.gearMode === 'fixed' && f.mode === 'war' ? gear : (f.mode === 'war' ? gear : undefined),
      ownedGear: f.gearMode === 'optimize' ? owned : {}, useMarketOffers: f.useMarket, allowEmpty: f.allowEmpty, estimate: f.estimate, ammo: ammo.length ? ammo : ['none'], leadStock: n(f.leadStock), buyAmmo: f.buyAmmo,
      food, start: { healthPct: f.startKnown ? n(f.startHealthPct) : undefined, hunger: f.startKnown ? n(f.startHunger) : undefined },
      objective: { kind: f.objective, minDamageSharePct: n(f.minSharePct), goldPerDamage: n(f.goldPerDamage), crateValue: n(f.crateValue), budget: n(f.budget) },
    },
    economic: { marketTaxPct: n(f.econ.marketTax), incomeTaxPct: n(f.econ.incomeTax), productionTaxPct: n(f.econ.productionTax), jobWage: n(f.econ.jobWage), sellBasis: f.econ.sellBasis, workerPointsPerDay: n(f.econ.workerPoints), workerWage: n(f.econ.workerWage) },
    hybrid: { kind: f.hybrid.kind, minDailyNet: n(f.hybrid.minDailyNet), weightCombat: n(f.hybrid.wCombat), weightEconomy: n(f.hybrid.wEconomy) },
    pill: sec.pill && f.pill.enabled ? { enabled: true, state: { kind: f.pill.state, minutes: n(f.pill.minutes) }, cost: { mode: f.pill.costMode, price: n(f.pill.price) }, battles: f.pill.battles.map((b) => ({ startMinutes: n(b.start), durationMinutes: n(b.duration), hits: n(b.hits) })), goldPerDamage: n(f.goldPerDamage) } : { enabled: false },
  };
}
/** Body -> engine input; used by tests to prove the form and the server contract agree. */
export const parseBody = (f: FormState, playerId: string) => parseOptimizeInput(JSON.parse(JSON.stringify(toRequestBody(f, playerId))));
export const SKILL_OPTIONS: readonly SkillId[] = SKILL_IDS;
export type { OptimizeInput };
