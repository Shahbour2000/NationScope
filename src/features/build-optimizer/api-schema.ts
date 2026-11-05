import { SKILL_IDS, type SkillId } from './engine/skills';
import type { AmmoType } from './engine/combat';
import type { FoodType } from './engine/loadout';

/** Request contract of POST /api/build-optimizer/optimize (hand-validated: every number is range-checked, unknown values are rejected, nothing is defaulted silently). */
export type SlotKey = 'weapon' | 'helmet' | 'gloves' | 'chest' | 'legs' | 'boots';
export const SLOT_KEYS: readonly SlotKey[] = ['weapon', 'helmet', 'gloves', 'chest', 'legs', 'boots'];
export interface ApiSlot { equipped: boolean; /** weapon attack | helmet crit damage | gloves accuracy | chest/legs armor | boots dodge */ stat1?: number; /** weapon crit chance */ stat2?: number; usesAmmo?: boolean; durability?: number }
export interface ApiConstraint { skill: SkillId; kind: 'min' | 'max' | 'exact'; level: number }
export interface ApiFood { type: FoodType; price?: number; stock?: number }
export interface ApiBattle { startMinutes: number; durationMinutes: number; hits: number }
export type ApiPill = { enabled: false } | { enabled: true; state: { kind: 'unknown' | 'none' | 'buff' | 'debuff'; minutes?: number }; cost: { mode: 'buy' | 'craft' | 'owned'; price?: number }; battles: ApiBattle[]; goldPerDamage?: number };
export interface OptimizeInput {
  playerId: string;
  mode: 'war' | 'economic' | 'hybrid';
  user: { prestigeCount?: number; totalSkillPoints?: number; availableSkillPoints?: number; firstResetFree?: boolean };
  keepCurrentSkills: boolean;
  constraints: ApiConstraint[];
  war: {
    kind: 'fixedHits' | 'sustainable'; hits: number; gearMode: 'fixed' | 'optimize';
    fixedGear: Partial<Record<SlotKey, ApiSlot>>; ownedGear: Partial<Record<SlotKey, ApiSlot>>;
    useMarketOffers: boolean; allowEmpty: boolean; estimate: 'low' | 'mid' | 'high';
    ammo: AmmoType[]; leadStock?: number; buyAmmo: boolean; food: ApiFood[]; start: { healthPct?: number; hunger?: number };
    objective: { kind: 'maxDamage' | 'bestValue' | 'maxNet'; minDamageSharePct?: number; goldPerDamage?: number; crateValue?: number; budget?: number };
  };
  economic: { marketTaxPct?: number; incomeTaxPct?: number; productionTaxPct?: number; jobWage?: number; sellBasis: 'bid' | 'last' | 'ask'; workerPointsPerDay?: number; workerWage?: number };
  hybrid: { kind: 'constrained' | 'weighted'; minDailyNet?: number; weightCombat?: number; weightEconomy?: number };
  pill: ApiPill;
}
export type Parsed<T> = { ok: true; value: T } | { ok: false; errors: string[] };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const oneOf = <T extends string>(v: unknown, list: readonly T[]): T | null => (typeof v === 'string' && (list as readonly string[]).includes(v) ? (v as T) : null);

export const LIMITS = { hits: 5000, battles: 8, constraints: 14, minutes: 100_000, gold: 1e9, maxDuration: 100_000 } as const;

export function parseOptimizeInput(body: unknown): Parsed<OptimizeInput> {
  const errors: string[] = [];
  if (!isObj(body)) return { ok: false, errors: ['body must be an object'] };
  const num = (path: string, v: unknown, min: number, max: number, req = false): number | undefined => {
    if (v === undefined || v === null || v === '') { if (req) errors.push(`${path} is required`); return undefined; }
    if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) { errors.push(`${path} must be a number between ${min} and ${max}`); return undefined; }
    return v;
  };
  const bool = (path: string, v: unknown, def: boolean): boolean => { if (v === undefined) return def; if (typeof v !== 'boolean') { errors.push(`${path} must be true or false`); return def; } return v; };
  const playerId = typeof body.playerId === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(body.playerId) ? body.playerId : (errors.push('playerId is invalid'), '');
  const mode = oneOf(body.mode, ['war', 'economic', 'hybrid'] as const) ?? (errors.push('mode must be war, economic or hybrid'), 'war' as const);
  const u = isObj(body.user) ? body.user : {};
  const user: OptimizeInput['user'] = {
    prestigeCount: num('user.prestigeCount', u.prestigeCount, 0, 100), totalSkillPoints: num('user.totalSkillPoints', u.totalSkillPoints, 0, 5000), availableSkillPoints: num('user.availableSkillPoints', u.availableSkillPoints, 0, 5000),
    firstResetFree: u.firstResetFree === undefined ? undefined : bool('user.firstResetFree', u.firstResetFree, false),
  };
  for (const k of ['prestigeCount', 'totalSkillPoints', 'availableSkillPoints'] as const) if (user[k] !== undefined && !Number.isInteger(user[k])) errors.push(`user.${k} must be a whole number`);
  const constraints: ApiConstraint[] = [];
  if (body.constraints !== undefined) {
    if (!Array.isArray(body.constraints) || body.constraints.length > LIMITS.constraints) errors.push(`constraints must be a list of at most ${LIMITS.constraints}`);
    else body.constraints.forEach((c, i) => {
      if (!isObj(c)) { errors.push(`constraints[${i}] is invalid`); return; }
      const skill = oneOf(c.skill, SKILL_IDS), kind = oneOf(c.kind, ['min', 'max', 'exact'] as const), level = num(`constraints[${i}].level`, c.level, 0, 10, true);
      if (!skill || !kind) errors.push(`constraints[${i}] needs a skill and a kind`); else if (level !== undefined) constraints.push({ skill, kind, level: Math.round(level) });
    });
  }
  const w = isObj(body.war) ? body.war : {};
  const slot = (path: string, v: unknown, key: SlotKey): ApiSlot | undefined => {
    if (v === undefined) return undefined;
    if (!isObj(v)) { errors.push(`${path} is invalid`); return undefined; }
    const equipped = bool(`${path}.equipped`, v.equipped, false);
    if (!equipped) return { equipped: false };
    const stat1 = num(`${path}.stat1`, v.stat1, 0, 1000, true), stat2 = key === 'weapon' ? num(`${path}.stat2`, v.stat2, 0, 100, true) : undefined;
    const durability = num(`${path}.durability`, v.durability, 1, 100);
    return { equipped: true, stat1, stat2, usesAmmo: key === 'weapon' ? bool(`${path}.usesAmmo`, v.usesAmmo, true) : undefined, durability };
  };
  const slots = (path: string, v: unknown): Partial<Record<SlotKey, ApiSlot>> => {
    const out: Partial<Record<SlotKey, ApiSlot>> = {};
    if (v === undefined) return out;
    if (!isObj(v)) { errors.push(`${path} is invalid`); return out; }
    for (const k of SLOT_KEYS) { const s = slot(`${path}.${k}`, v[k], k); if (s) out[k] = s; }
    return out;
  };
  const kind = oneOf(w.kind, ['fixedHits', 'sustainable'] as const) ?? 'fixedHits';
  const gearMode = oneOf(w.gearMode, ['fixed', 'optimize'] as const) ?? 'optimize';
  const fixedGear = slots('war.fixedGear', w.fixedGear), ownedGear = slots('war.ownedGear', w.ownedGear);
  for (const k of SLOT_KEYS) { const o = ownedGear[k]; if (o?.equipped && o.durability === undefined) errors.push(`war.ownedGear.${k}.durability is required for an owned item`); }
  const ammoRaw = Array.isArray(w.ammo) ? w.ammo : ['none'];
  const ammo = ammoRaw.map((a) => oneOf(a, ['none', 'light', 'medium', 'heavy'] as const)).filter((a): a is AmmoType => a !== null);
  if (ammo.length === 0) errors.push('war.ammo needs at least one option');
  const foodRaw = Array.isArray(w.food) ? w.food : [];
  const food: ApiFood[] = [];
  foodRaw.forEach((f, i) => { if (!isObj(f)) return; const t = oneOf(f.type, ['bread', 'steak', 'cookedFish'] as const); if (!t) { errors.push(`war.food[${i}].type is invalid`); return; } food.push({ type: t, price: num(`war.food[${i}].price`, f.price, 0, LIMITS.gold), stock: num(`war.food[${i}].stock`, f.stock, 0, 100000) }); });
  const st = isObj(w.start) ? w.start : {};
  const o = isObj(w.objective) ? w.objective : {};
  const objKind = oneOf(o.kind, ['maxDamage', 'bestValue', 'maxNet'] as const) ?? 'maxDamage';
  const war: OptimizeInput['war'] = {
    kind, hits: num('war.hits', w.hits, 1, LIMITS.hits, mode !== 'economic' && kind === 'fixedHits') ?? 20, gearMode, fixedGear, ownedGear,
    useMarketOffers: bool('war.useMarketOffers', w.useMarketOffers, true), allowEmpty: bool('war.allowEmpty', w.allowEmpty, true), estimate: oneOf(w.estimate, ['low', 'mid', 'high'] as const) ?? 'low',
    ammo, leadStock: num('war.leadStock', w.leadStock, 0, 1e9), buyAmmo: bool('war.buyAmmo', w.buyAmmo, true), food,
    start: { healthPct: num('war.start.healthPct', st.healthPct, 1, 100), hunger: num('war.start.hunger', st.hunger, 0, 100) },
    objective: { kind: objKind, minDamageSharePct: num('war.objective.minDamageSharePct', o.minDamageSharePct, 1, 100), goldPerDamage: num('war.objective.goldPerDamage', o.goldPerDamage, 0, 1e6), crateValue: num('war.objective.crateValue', o.crateValue, 0, 1e9), budget: num('war.objective.budget', o.budget, 0, LIMITS.gold) },
  };
  if (mode !== 'economic' && gearMode === 'fixed') for (const k of SLOT_KEYS) if (!fixedGear[k]) errors.push(`war.fixedGear.${k} is required for Fixed Gear (mark it empty if the slot is empty)`);
  const e = isObj(body.economic) ? body.economic : {};
  const economic: OptimizeInput['economic'] = {
    marketTaxPct: num('economic.marketTaxPct', e.marketTaxPct, 0, 45), incomeTaxPct: num('economic.incomeTaxPct', e.incomeTaxPct, 0, 45), productionTaxPct: num('economic.productionTaxPct', e.productionTaxPct, 0, 45),
    jobWage: num('economic.jobWage', e.jobWage, 0, 1e6), sellBasis: oneOf(e.sellBasis, ['bid', 'last', 'ask'] as const) ?? 'bid',
    workerPointsPerDay: num('economic.workerPointsPerDay', e.workerPointsPerDay, 0, 1e6), workerWage: num('economic.workerWage', e.workerWage, 0, 1e6),
  };
  const h = isObj(body.hybrid) ? body.hybrid : {};
  const hybrid: OptimizeInput['hybrid'] = { kind: oneOf(h.kind, ['constrained', 'weighted'] as const) ?? 'constrained', minDailyNet: num('hybrid.minDailyNet', h.minDailyNet, -1e9, 1e9), weightCombat: num('hybrid.weightCombat', h.weightCombat, 0, 1000), weightEconomy: num('hybrid.weightEconomy', h.weightEconomy, 0, 1000) };
  if (mode === 'hybrid') { if (hybrid.kind === 'constrained' && hybrid.minDailyNet === undefined) errors.push('hybrid.minDailyNet is required for the constrained hybrid'); if (hybrid.kind === 'weighted' && (hybrid.weightCombat === undefined || hybrid.weightEconomy === undefined)) errors.push('hybrid weights are required for the weighted hybrid'); }
  let pill: ApiPill = { enabled: false };
  if (isObj(body.pill) && body.pill.enabled === true) {
    const p = body.pill, ps = isObj(p.state) ? p.state : {}, pc = isObj(p.cost) ? p.cost : {};
    const sk = oneOf(ps.kind, ['unknown', 'none', 'buff', 'debuff'] as const) ?? 'unknown';
    const minutes = num('pill.state.minutes', ps.minutes, 0, LIMITS.minutes, sk === 'buff' || sk === 'debuff');
    const battles: ApiBattle[] = [];
    if (!Array.isArray(p.battles) || p.battles.length < 1 || p.battles.length > LIMITS.battles) errors.push(`pill.battles needs 1 to ${LIMITS.battles} battles`);
    else p.battles.forEach((b, i) => { if (!isObj(b)) { errors.push(`pill.battles[${i}] is invalid`); return; } const sm = num(`pill.battles[${i}].startMinutes`, b.startMinutes, 0, LIMITS.minutes, true), dm = num(`pill.battles[${i}].durationMinutes`, b.durationMinutes, 1, LIMITS.maxDuration, true), ht = num(`pill.battles[${i}].hits`, b.hits, 1, LIMITS.hits, true); if (sm !== undefined && dm !== undefined && ht !== undefined) battles.push({ startMinutes: sm, durationMinutes: dm, hits: ht }); });
    pill = { enabled: true, state: { kind: sk, minutes }, cost: { mode: oneOf(pc.mode, ['buy', 'craft', 'owned'] as const) ?? 'buy', price: num('pill.cost.price', pc.price, 0, LIMITS.gold) }, battles, goldPerDamage: num('pill.goldPerDamage', p.goldPerDamage, 0, 1e6) };
  }
  if (errors.length) return { ok: false, errors };
  return { ok: true, value: { playerId, mode, user, keepCurrentSkills: bool('keepCurrentSkills', body.keepCurrentSkills, false), constraints, war, economic, hybrid, pill } };
}
