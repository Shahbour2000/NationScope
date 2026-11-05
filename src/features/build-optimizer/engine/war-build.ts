import { defineFormula, weakestStatus, type EvidenceStatus } from './registry';
import { AMMO, computeHit, DEFAULT_CONVENTIONS, type AmmoType, type Conventions, type GearInput, type HitModel, type WarContext, type WeaponStats } from './combat';
import { resolveConstraints, noReduceConstraints, satisfies, type Conflict, type Constraint } from './constraints';
import { cumulativeCost, emptyLevels, resetCost, skillValue, SKILL_IDS, totalCost, type Levels, type SkillId } from './skills';
import { battleModifierPct } from './combat';
import { normaliseRarity, rarityStats, type GearSlot, type StatEstimate } from './rarity';
import { FOOD_PCT, type FoodType } from './loadout';
import { analysePill, type PillAnalysisResult, type PillPlanInput } from './pill';

defineFormula({ id: 'war.session', version: 1, status: 'estimated',
  summary: 'Fixed horizon of N hits. Damage = N * expected damage per hit. Survival: health lost = N * lossPerHit; meals = ceil((loss + 10 - startHealth) / (food% * maxHealth)), must not exceed max hunger (full hunger and health assumed at the start). Costs: acquisition + ammo + food + replacement of items that break during N hits (weapon wears 1/hit, others 1-dodge%/hit; helmet/gloves searched conservatively at 1/hit, reported exactly).',
  source: 'wiki 01-basics §2.2-2.4, §3.4-3.5, 03-war §1.5; engine design', inputs: ['skills', 'gear', 'ammo', 'food', 'prices', 'hits'], outputs: ['damage', 'cost', 'survival'],
  dependsOn: ['combat.hitOutcomes', 'combat.sustain', 'loadout.durability', 'loadout.food', 'rewards.loot'], tests: ['war build'] });
defineFormula({ id: 'war.search', kind: 'algorithm', version: 1, status: 'documented',
  summary: 'Exact joint search: offense (attack, accuracy, crit chance, crit damage + weapon/helmet/gloves/ammo), sustain (health, hunger, armor, dodge + chest/legs/boots/food) and loot chance are three independent groups at a fixed horizon; each is reduced to its Pareto front over (points, cost, value) and the fronts are combined. Exact for objectives monotone in damage, loot and cost.',
  source: 'engine design', inputs: ['bounds', 'candidates', 'objective'], outputs: ['ranked builds'], dependsOn: ['war.session', 'solver.twoGroup'], tests: ['war build matches brute force'] });
defineFormula({ id: 'war.fixedGear', kind: 'algorithm', version: 1, status: 'documented',
  summary: 'Fixed Gear: the six equipment slots are mandatory as given; skills are optimized around their real stats; no acquisition or replacement cost is added and no alternative equipment is considered. Ammo and food remain consumable choices.',
  source: 'project owner 2026-10-31', inputs: ['gear'], outputs: ['build'], dependsOn: ['war.search'], tests: ['fixed gear'] });

defineFormula({ id: 'war.objectives', kind: 'algorithm', version: 1, status: 'documented',
  summary: 'maxDamage: maximise D=N*E subject to cost<=budget (tie: lower cost, then more crates). bestValue: let D* be the best D under the same constraints; among builds with D>=s*D* minimise cost (tie: higher D); s=minDamageShare in (0,1], default 0.8. maxNet: net = revenue - cost where revenue = goldPerDamage*D (or the war bounty, capped by its remaining budget) + crateValue*expectedCrates; refused when no revenue term is supplied. Costs with unknown prices are lower bounds, so such a net is an upper bound.',
  source: 'engine design; project owner 2026-10-31', inputs: ['objective', 'prices'], outputs: ['ranking'], dependsOn: ['war.session'], tests: ['objective semantics'] });
/** Default for bestValue.minDamageShare: a modelling default, not a game rule. Pass minDamageShare to change it. */
export const DEFAULT_MIN_DAMAGE_SHARE = 0.8;
export type { GearSlot };
export interface GearOptionSpec<T> { id: string; stats: T; durability: number; /** purchase price; undefined = already owned (no acquisition cost) */ price?: number; /** cost to replace it when it breaks; defaults to `price`; unknown for owned items unless given */ replacementPrice?: number }
/** Item whose real stats are unknown: only its rarity is known. Evaluated at low/mid/high of the wiki range and always reported as an estimate. */
export interface RarityOnlyItem { id: string; slot: GearSlot; rarity: string; durability?: number; price?: number; replacementPrice?: number }
export interface WarCandidates {
  weapons?: GearOptionSpec<WeaponStats>[]; helmets?: GearOptionSpec<{ critDamage: number }>[]; gloves?: GearOptionSpec<{ accuracy: number }>[];
  chests?: GearOptionSpec<{ armor: number }>[]; legs?: GearOptionSpec<{ armor: number }>[]; boots?: GearOptionSpec<{ dodge: number }>[];
  rarityOnly?: RarityOnlyItem[];
}
export type GearPolicy =
  | { mode: 'fixed'; gear: GearInput }
  | { mode: 'optimize'; candidates: WarCandidates; /** allow leaving a slot empty (default true) */ allowEmpty?: boolean; estimate?: StatEstimate; maxConfigs?: number };
export type WarObjective =
  | { type: 'maxDamage'; budget?: number }
  | { type: 'bestValue'; /** keep builds with at least this share of the best damage (0 < s <= 1, default DEFAULT_MIN_DAMAGE_SHARE = 0.8), then minimise cost */ minDamageShare?: number; budget?: number }
  | { type: 'maxNet'; /** gold earned per point of damage (linear). If omitted, the war bounty in `war` is used (capped by its remaining budget). */ goldPerDamage?: number; /** gold value of one Field Crate (from market floors); omitted = loot is NOT valued */ crateValue?: number; budget?: number };
export interface FoodOption { type: FoodType; /** gold per meal; undefined = unknown (cost counted as 0 and flagged) */ price?: number }

export interface WarBuildRequest {
  player: { level: number; totalPoints: number; currentLevels?: Levels; firstResetFree?: boolean };
  constraints?: Constraint[]; allowReset?: boolean;
  hits: number; gear: GearPolicy; ammoOptions?: AmmoType[];
  food?: { options?: FoodOption[]; startHealthFraction?: number };
  prices?: { leadPerUnit?: number; leadStock?: number };
  rankBonusPct?: number; war?: WarContext; conventions?: Partial<Conventions>;
  objective: WarObjective;
  /** 'strict' refuses to run when a needed ammo/food price is unknown; 'lower-bound' counts unknown prices as 0 and marks every result as a lower-bound cost. Default: strict for bestValue, maxNet and budgets; lower-bound for plain maxDamage. */
  costPolicy?: 'strict' | 'lower-bound';
  /** share used for the 'best-value' alternative when the objective is not bestValue (default DEFAULT_MIN_DAMAGE_SHARE) */
  alternativeMinDamageShare?: number;
  /** Pill is OPTIONAL and never changes the search: it is analysed afterwards for the chosen builds. */
  pill?: { include: false } | ({ include: true } & Omit<PillPlanInput, 'combat'>);
}
export interface PickedItem { slot: GearSlot; id: string | null; stats: Record<string, number | boolean> | null; durability: number | null; estimated: boolean; owned: boolean }
export interface CostBreakdown { acquisition: number; ammo: number; food: number; replacement: number; total: number; /** false when a needed price was unknown (counted as 0) */ complete: boolean; missingPrices: string[] }
export interface WarBuild {
  role: 'primary' | 'max-damage' | 'best-value' | 'lowest-cost';
  levels: Levels; pointsSpent: number; pointsRemaining: number;
  gear: PickedItem[]; ammo: AmmoType; food: { type: FoodType; meals: number } | null;
  hit: HitModel; hits: number; expectedDamage: number; damageRange: { low: number; high: number } | null; estimatedSlots: string[];
  survival: { lossPerHit: number; totalLoss: number; meals: number; hungerAvailable: number; feasible: boolean };
  loot: { chancePct: number; expectedCrates: number; expectedValue: number | null };
  cost: CostBreakdown; /** true when a needed price was unknown: totals are LOWER bounds */ costIsLowerBound: boolean; costPer1000Damage: number | null; net: number | null; /** true when net was computed from a lower-bound cost, so the real net can only be lower */ netIsUpperBound: boolean;
  resetRequired: boolean; resetCostGold: number | null; mandatoryPreserved: string[];
  evidence: EvidenceStatus; usedFormulas: string[];
}
export type WarBuildResult =
  | { ok: true; builds: WarBuild[]; assumptions: string[]; configurations: number; pairsEvaluated: number; /** per build, only when pill.include=true; never affects the search */ pill: PillAnalysisResult[] | null }
  | { ok: false; reason: 'conflict'; conflicts: Conflict[] }
  | { ok: false; reason: 'missing-input' | 'infeasible' | 'too-large'; message: string };

export type OptStats = Record<string, number | boolean>;
export interface Opt { id: string | null; slot: GearSlot; stats: OptStats | null; durability: number; acq: number; repl: number | null; estimated: boolean; owned: boolean; rarity?: string }
/** numeric stat of a picked item (0 for an empty slot or an absent stat) */
export const statNum = (o: Opt, k: string): number => { const v = o.stats?.[k]; return typeof v === 'number' ? v : 0; };
const EMPTY = (slot: GearSlot): Opt => ({ id: null, slot, stats: null, durability: Infinity, acq: 0, repl: 0, estimated: false, owned: true });
export const diminish = (v: number, t: number) => (v <= t ? v : t + (v - t) / 2);
export const FOODS: FoodType[] = ['bread', 'steak', 'cookedFish'];
export const RESERVE = 10; // health kept in reserve (one hit), mirrors loadout.foodPlan

export function normaliseOptions(c: WarCandidates, est: StatEstimate, allowEmpty: boolean): Record<GearSlot, Opt[]> {
  const mk = <T>(slot: GearSlot, xs: GearOptionSpec<T>[] | undefined): Opt[] => (xs ?? []).map((x) => ({ id: x.id, slot, stats: x.stats as unknown as OptStats, durability: x.durability, acq: x.price ?? 0, repl: x.replacementPrice ?? x.price ?? null, estimated: false, owned: x.price === undefined }));
  const out: Record<GearSlot, Opt[]> = { weapon: mk('weapon', c.weapons), helmet: mk('helmet', c.helmets), gloves: mk('gloves', c.gloves), chest: mk('chest', c.chests), legs: mk('legs', c.legs), boots: mk('boots', c.boots) };
  const realIds = new Set(Object.values(out).flat().map((o) => o.id));
  for (const r of c.rarityOnly ?? []) {
    if (realIds.has(r.id)) continue; // actual item stats always win over a rarity estimate of the same item
    const rar = normaliseRarity(r.rarity); if (!rar) continue;
    const st = rarityStats(r.slot, rar, est);
    out[r.slot].push({ id: r.id, slot: r.slot, stats: r.slot === 'weapon' ? { ...st, usesAmmo: true } : st, durability: r.durability ?? 100, acq: r.price ?? 0, repl: r.replacementPrice ?? r.price ?? null, estimated: true, owned: r.price === undefined, rarity: rar });
  }
  if (allowEmpty) for (const s of Object.keys(out) as GearSlot[]) out[s].push(EMPTY(s));
  else for (const s of Object.keys(out) as GearSlot[]) if (!out[s].length) out[s].push(EMPTY(s));
  for (const s of Object.keys(out) as GearSlot[]) out[s].sort((a, b) => (a.id ?? '￿').localeCompare(b.id ?? '￿'));
  return out;
}
export function fixedOptions(g: GearInput, durabilities: Partial<Record<GearSlot, number>> = {}): Record<GearSlot, Opt[]> | string {
  const slots: [GearSlot, keyof GearInput][] = [['weapon', 'weapon'], ['helmet', 'helmet'], ['gloves', 'gloves'], ['chest', 'chest'], ['legs', 'legs'], ['boots', 'boots']];
  const out = {} as Record<GearSlot, Opt[]>;
  for (const [s, k] of slots) {
    const v = g[k] as { kind: string; stats?: unknown } | undefined;
    if (v === undefined) return `Fixed gear needs every slot: "${s}" is missing (use {kind:'empty'} for an empty slot).`;
    out[s] = [v.kind === 'item' ? { id: `fixed:${s}`, slot: s, stats: v.stats as OptStats, durability: durabilities[s] ?? Infinity, acq: 0, repl: 0, estimated: false, owned: true } : EMPTY(s)];
  }
  return out;
}
export const asGear = (picks: Record<GearSlot, Opt>): GearInput => {
  const sl = (o: Opt) => (o.id === null ? { kind: 'empty' } : { kind: 'item', stats: o.stats });
  return { weapon: sl(picks.weapon), helmet: sl(picks.helmet), gloves: sl(picks.gloves), chest: sl(picks.chest), legs: sl(picks.legs), boots: sl(picks.boots) } as unknown as GearInput;
};

export function optimizeWarBuild(req: WarBuildRequest): WarBuildResult {
  const assumptions: string[] = ['Combat starts with full health and full hunger (current values are not exposed by the API).'];
  const N = req.hits;
  if (!(N > 0) || !Number.isFinite(N)) return { ok: false, reason: 'missing-input', message: 'hits must be a positive number.' };
  const conv: Conventions = { ...DEFAULT_CONVENTIONS, ...req.conventions };
  const o0 = req.objective;
  if (o0.type === 'bestValue' && o0.minDamageShare !== undefined && !(o0.minDamageShare > 0 && o0.minDamageShare <= 1)) return { ok: false, reason: 'missing-input', message: 'minDamageShare must be in (0, 1].' };
  const altShare = req.alternativeMinDamageShare ?? DEFAULT_MIN_DAMAGE_SHARE;
  if (!(altShare > 0 && altShare <= 1)) return { ok: false, reason: 'missing-input', message: 'alternativeMinDamageShare must be in (0, 1].' };
  const policy = req.costPolicy ?? (o0.type === 'maxDamage' && o0.budget === undefined ? 'lower-bound' : 'strict');
  const ammoOptions: AmmoType[] = req.ammoOptions?.length ? [...req.ammoOptions] : ['none'];
  const fixed = req.gear.mode === 'fixed';
  let slots: Record<GearSlot, Opt[]>;
  if (req.gear.mode === 'fixed') {
    const r = fixedOptions(req.gear.gear); if (typeof r === 'string') return { ok: false, reason: 'missing-input', message: r }; slots = r;
    assumptions.push('Fixed Gear: equipment is mandatory; no acquisition or replacement costs are added and durability is not modelled.');
  } else slots = normaliseOptions(req.gear.candidates, req.gear.estimate ?? 'low', req.gear.allowEmpty ?? true);
  const nCfg = (slots.weapon.length * slots.helmet.length * slots.gloves.length * ammoOptions.length) + (slots.chest.length * slots.legs.length * slots.boots.length);
  const maxCfg = req.gear.mode === 'optimize' ? req.gear.maxConfigs ?? 4000 : Infinity;
  if (nCfg > maxCfg) return { ok: false, reason: 'too-large', message: `Equipment search space (${nCfg} configurations) exceeds maxConfigs=${maxCfg}; shorten the candidate lists.` };
  if (req.gear.mode === 'optimize' && Object.values(req.gear.candidates.rarityOnly ?? []).length) assumptions.push(`Rarity-only items are evaluated at the ${req.gear.estimate ?? 'low'} point of the wiki stat range (conservative default) and reported as estimates with a damage range.`);

  const cons: Constraint[] = [...(req.constraints ?? [])];
  const cur = req.player.currentLevels;
  if (req.allowReset === false) { if (!cur) return { ok: false, reason: 'missing-input', message: 'allowReset=false needs player.currentLevels.' }; cons.push(...noReduceConstraints(cur)); }
  const res = resolveConstraints(cons, { playerLevel: req.player.level, totalPoints: req.player.totalPoints });
  if (!res.ok) return { ok: false, reason: 'conflict', conflicts: res.conflicts };
  const B = res.bounds;
  let base = 0; for (const s of SKILL_IDS) base += cumulativeCost(B[s].lo);
  const avail = res.budget - base;
  const sv = (s: SkillId) => Array.from({ length: 11 }, (_, l) => skillValue(s, l));
  const V = Object.fromEntries(SKILL_IDS.map((s) => [s, sv(s)])) as Record<SkillId, number[]>;
  const cum = (s: SkillId, l: number) => cumulativeCost(l) - cumulativeCost(B[s].lo);

  const missingPrices = new Set<string>();
  if (policy === 'strict') {
    const needsAmmo = (req.ammoOptions?.length ? req.ammoOptions : ['none']).some((a) => a !== 'none');
    const lack: string[] = [];
    if (needsAmmo && req.prices?.leadPerUnit === undefined) lack.push('prices.leadPerUnit');
    for (const f of req.food?.options?.length ? req.food.options : FOODS.map((t) => ({ type: t } as FoodOption))) if (f.price === undefined) lack.push(`food price (${f.type})`);
    if (lack.length) return { ok: false, reason: 'missing-input', message: `Cost-aware objectives need every consumable price (use 0 for items you already own). Missing: ${lack.join(', ')}. Or set costPolicy: 'lower-bound' to accept lower-bound costs.` };
  }
  const leadPrice = req.prices?.leadPerUnit, leadStock = req.prices?.leadStock ?? 0;
  const rankPct = req.rankBonusPct ?? 0; if (req.rankBonusPct === undefined) assumptions.push('Rank bonus unknown: 0% used.');
  const battleMult = Math.max(0, 1 + (req.war ? req.war.displayedTotalPct ?? battleModifierPct(req.war.modifiers) : 0) / 100);
  const foods = (req.food?.options?.length ? req.food.options : FOODS.map((t) => ({ type: t } as FoodOption)));
  const startFrac = req.food?.startHealthFraction ?? 1;

  // ---------- offense ----------
  const ammoCost = (ammo: AmmoType): number => {
    if (ammo === 'none') return 0;
    const paid = Math.max(0, N * AMMO[ammo].lead - leadStock);
    if (paid > 0 && leadPrice === undefined) { missingPrices.add('lead price'); return 0; }
    return paid * (leadPrice ?? 0);
  };
  const wearCost = (o: Opt, wearPerHit: number): number => {
    if (fixed || o.id === null || wearPerHit <= 0) return 0;
    const extra = Math.max(0, Math.ceil((N * wearPerHit) / o.durability - 1e-9) - 1);
    if (extra === 0) return 0;
    if (o.repl === null) { missingPrices.add(`replacement price of ${o.id}`); return 0; }
    return extra * o.repl;
  };
  interface OEntry { pts: number; cost: number; val: number; lv: [number, number, number, number]; w: Opt; h: Opt; g: Opt; ammo: AmmoType }
  const oAll: OEntry[] = [];
  const ptsMax = Math.max(0, Math.floor(avail));
  for (const w of slots.weapon) for (const h of slots.helmet) for (const g of slots.gloves) for (const ammo of ammoOptions) {
    const ws = w.id ? (w.stats as unknown as WeaponStats) : null;
    const active = !!ws && (!ws.usesAmmo || ammo !== 'none');
    const ammoPct = ammo === 'none' ? 0 : AMMO[ammo].pct;
    const pm = conv.stacking === 'additive' ? 1 + (ammoPct + rankPct) / 100 : (1 + ammoPct / 100) * (1 + rankPct / 100);
    const gAcc = statNum(g, 'accuracy'), hCd = statNum(h, 'critDamage');
    const cost = w.acq + h.acq + g.acq + ammoCost(ammo) + wearCost(w, active ? 1 : 0) + wearCost(h, 1) + wearCost(g, 1);
    const bestE = new Map<number, OEntry>();
    for (let a = B.attack.lo; a <= B.attack.hi; a++) { const pa = cum('attack', a); if (pa > ptsMax) break;
      for (let ac = B.accuracy.lo; ac <= B.accuracy.hi; ac++) { const pb = pa + cum('accuracy', ac); if (pb > ptsMax) break;
        const accTot = V.accuracy[ac]! + gAcc, accEx = Math.max(0, accTot - 100), p = Math.min(accTot, 100) / 100;
        for (let cc = B.critChance.lo; cc <= B.critChance.hi; cc++) { const pc = pb + cum('critChance', cc); if (pc > ptsMax) break;
          const ccTot = V.critChance[cc]! + (active ? ws!.critChance : 0), ccEx = Math.max(0, ccTot - 100), c = Math.min(ccTot, 100) / 100;
          for (let cd = B.critDamage.lo; cd <= B.critDamage.hi; cd++) { const pts = pc + cum('critDamage', cd); if (pts > ptsMax) break;
            const A = (V.attack[a]! + (active ? ws!.attack : 0) + 3 * accEx) * pm;
            const cdTot = V.critDamage[cd]! + hCd + 3 * ccEx;
            const cm = conv.critMultiplier === 'onePlus' ? 1 + cdTot / 100 : cdTot / 100;
            const E = battleMult * A * ((1 - p) * 0.5 + p * ((1 - c) + c * cm));
            const prev = bestE.get(pts);
            if (!prev || E > prev.val) bestE.set(pts, { pts, cost, val: E, lv: [a, ac, cc, cd], w, h, g, ammo });
          } } } }
    for (const e of [...bestE.values()].sort((x, y) => x.pts - y.pts)) oAll.push(e);
  }
  // Pareto: fewer points, lower cost, higher damage
  oAll.sort((x, y) => y.val - x.val || x.cost - y.cost || x.pts - y.pts);
  const oFront: OEntry[] = [];
  for (const e of oAll) if (!oFront.some((k) => k.pts <= e.pts && k.cost <= e.cost && k.val >= e.val)) oFront.push(e);

  // ---------- sustain core (health, hunger, armor, dodge) ----------
  interface CEntry { pts: number; cost: number; lv: [number, number, number, number]; ch: Opt; lg: Opt; bt: Opt; food: FoodType | null; meals: number }
  const cAll: CEntry[] = [];
  for (const ch of slots.chest) for (const lg of slots.legs) for (const bt of slots.boots) {
    const aG = statNum(ch, 'armor') + statNum(lg, 'armor'), dG = statNum(bt, 'dodge');
    const acq = ch.acq + lg.acq + bt.acq;
    const best = new Map<number, CEntry>();
    for (let hl = B.health.lo; hl <= B.health.hi; hl++) { const p1 = cum('health', hl); if (p1 > ptsMax) break;
      for (let hu = B.hunger.lo; hu <= B.hunger.hi; hu++) { const p2 = p1 + cum('hunger', hu); if (p2 > ptsMax) break;
        for (let ar = B.armor.lo; ar <= B.armor.hi; ar++) { const p3 = p2 + cum('armor', ar); if (p3 > ptsMax) break;
          const armorEff = Math.min(diminish(V.armor[ar]! + aG, 45), 100);
          for (let dg = B.dodge.lo; dg <= B.dodge.hi; dg++) { const pts = p3 + cum('dodge', dg); if (pts > ptsMax) break;
            const dodgeP = Math.min(diminish(V.dodge[dg]! + dG, 36), 100) / 100;
            const loss = (1 - dodgeP) * Math.max(1, 10 * (1 - armorEff / 100));
            const H = V.health[hl]!, need = N * loss + RESERVE - startFrac * H;
            let fBest: { t: FoodType | null; meals: number; cost: number } | null = null;
            if (need <= 0) fBest = { t: null, meals: 0, cost: 0 };
            else for (const f of foods) {
              const meals = Math.ceil(need / ((FOOD_PCT[f.type] / 100) * H) - 1e-9);
              if (meals > V.hunger[hu]!) continue;
              const cst = meals * (f.price ?? 0);
              if (!fBest || cst < fBest.cost - 1e-12 || (Math.abs(cst - fBest.cost) < 1e-12 && meals < fBest.meals)) fBest = { t: f.type, meals, cost: cst };
            }
            if (!fBest) continue; // cannot survive N hits with this allocation
            const cost = acq + fBest.cost + wearCost(ch, 1 - dodgeP) + wearCost(lg, 1 - dodgeP) + wearCost(bt, 1 - dodgeP);
            const prev = best.get(pts);
            if (!prev || cost < prev.cost) best.set(pts, { pts, cost, lv: [hl, hu, ar, dg], ch, lg, bt, food: fBest.t, meals: fBest.meals });
          } } } }
    for (const e of best.values()) cAll.push(e);
  }
  if (foods.some((f) => f.price === undefined)) missingPrices.add('food price');
  cAll.sort((x, y) => x.pts - y.pts || x.cost - y.cost);
  const cFront: CEntry[] = []; let bestC = Infinity;
  for (const e of cAll) if (e.cost < bestC - 1e-12) { cFront.push(e); bestC = e.cost; }
  if (!cFront.length) return { ok: false, reason: 'infeasible', message: 'No allocation can survive the requested number of hits (health, hunger, armor, dodge and food are insufficient). Reduce hits or add points.' };

  // ---------- loot ----------
  interface SEntry { pts: number; cost: number; L: number; c: CEntry; loot: number }
  const sAll: SEntry[] = [];
  for (const c of cFront) for (let l = B.lootChance.lo; l <= B.lootChance.hi; l++) { const pts = c.pts + cum('lootChance', l); if (pts > ptsMax) break; sAll.push({ pts, cost: c.cost, L: V.lootChance[l]!, c, loot: l }); }
  sAll.sort((x, y) => y.L - x.L || x.cost - y.cost || x.pts - y.pts);
  const sFront: SEntry[] = [];
  for (const e of sAll) if (!sFront.some((k) => k.pts <= e.pts && k.cost <= e.cost && k.L >= e.L)) sFront.push(e);

  // ---------- combine ----------
  const obj = req.objective;
  const budget = obj.budget;
  const cv = obj.type === 'maxNet' ? obj.crateValue ?? 0 : 0;
  const bounty = obj.type === 'maxNet' && obj.goldPerDamage === undefined ? req.war?.bounty : undefined;
  if (obj.type === 'maxNet' && obj.goldPerDamage === undefined && obj.crateValue === undefined && !(bounty && bounty.eligible)) return { ok: false, reason: 'missing-input', message: 'maxNet needs a revenue term: goldPerDamage, an eligible war bounty, and/or crateValue. Without any income there is nothing to net against (use bestValue or maxDamage).' };
  if (obj.type === 'maxNet' && obj.crateValue === undefined) assumptions.push('crateValue not supplied: loot is NOT valued, so Loot Chance earns no points for its value.');
  const revenue = (dmg: number, crates: number): number => {
    if (obj.type !== 'maxNet') return 0;
    const d = obj.goldPerDamage !== undefined ? obj.goldPerDamage * dmg : bounty && bounty.eligible ? Math.min((dmg / 1000) * bounty.ratePer1000, bounty.remainingBudget) : 0;
    return d + cv * crates;
  };
  interface Pair { o: OEntry; s: SEntry; dmg: number; cost: number; crates: number; net: number }
  const better = (a: Pair, b: Pair | null, key: 'dmg' | 'cost' | 'net'): boolean => {
    if (!b) return true;
    if (key === 'dmg') return a.dmg > b.dmg + 1e-9 || (Math.abs(a.dmg - b.dmg) <= 1e-9 && (a.cost < b.cost - 1e-9 || (Math.abs(a.cost - b.cost) <= 1e-9 && a.crates > b.crates + 1e-9)));
    if (key === 'cost') return a.cost < b.cost - 1e-9 || (Math.abs(a.cost - b.cost) <= 1e-9 && a.dmg > b.dmg + 1e-9);
    return a.net > b.net + 1e-9 || (Math.abs(a.net - b.net) <= 1e-9 && a.dmg > b.dmg + 1e-9);
  };
  let pairs = 0; let bestDmg: Pair | null = null, cheapest: Pair | null = null, bestNet: Pair | null = null;
  const feasible: Pair[] = [];
  for (const o of oFront) for (const s of sFront) {
    if (o.pts + s.pts > ptsMax) continue;
    const cost = o.cost + s.cost; if (budget !== undefined && cost > budget + 1e-9) continue;
    pairs++;
    const dmg = N * o.val, crates = (N * s.L) / 100, net = revenue(dmg, crates) - cost;
    const p: Pair = { o, s, dmg, cost, crates, net };
    if (better(p, bestDmg, 'dmg')) bestDmg = p;
    if (better(p, cheapest, 'cost')) cheapest = p;
    if (obj.type === 'maxNet' && better(p, bestNet, 'net')) bestNet = p;
    if (obj.type === 'bestValue') feasible.push(p);
  }
  if (!bestDmg || !cheapest) return { ok: false, reason: 'infeasible', message: budget !== undefined ? `No equipment and skill combination fits the budget of ${budget} gold.` : 'No feasible build.' };
  let bestValue: Pair | null = null;
  const share = obj.type === 'bestValue' ? obj.minDamageShare ?? DEFAULT_MIN_DAMAGE_SHARE : altShare;
  {
    const pool = obj.type === 'bestValue' ? feasible : null;
    if (pool) for (const p of pool) if (p.dmg >= share * bestDmg.dmg - 1e-9 && better(p, bestValue, 'cost')) bestValue = p;
    else if (!pool) { /* computed below for non-bestValue objectives */ }
  }
  if (!bestValue) { // objective is not bestValue: still report the efficient alternative (second pass over fronts)
    for (const o of oFront) for (const s of sFront) { if (o.pts + s.pts > ptsMax) continue; const cost = o.cost + s.cost; if (budget !== undefined && cost > budget + 1e-9) continue;
      const dmg = N * o.val; if (dmg < share * bestDmg.dmg - 1e-9) continue; const p: Pair = { o, s, dmg, cost, crates: (N * s.L) / 100, net: 0 }; if (better(p, bestValue, 'cost')) bestValue = p; }
  }
  const primary = obj.type === 'maxDamage' ? bestDmg : obj.type === 'bestValue' ? bestValue! : bestNet!;
  const ordered: { role: WarBuild['role']; p: Pair }[] = [{ role: 'primary', p: primary }];
  const sig = (p: Pair) => `${p.o.lv}|${p.o.w.id}|${p.o.h.id}|${p.o.g.id}|${p.o.ammo}|${p.s.c.lv}|${p.s.c.ch.id}|${p.s.c.lg.id}|${p.s.c.bt.id}|${p.s.loot}`;
  for (const [role, p] of [['max-damage', bestDmg], ['best-value', bestValue], ['lowest-cost', cheapest]] as const) if (p && !ordered.some((x) => sig(x.p) === sig(p))) ordered.push({ role, p });

  const builds = ordered.map(({ role, p }) => buildResult(role, p));
  function buildResult(role: WarBuild['role'], p: Pair): WarBuild {
    const levels = emptyLevels(); for (const s of SKILL_IDS) levels[s] = B[s].lo;
    const [a, ac, cc, cd] = p.o.lv, [hl, hu, ar, dg] = p.s.c.lv;
    Object.assign(levels, { attack: a, accuracy: ac, critChance: cc, critDamage: cd, health: hl, hunger: hu, armor: ar, dodge: dg, lootChance: p.s.loot });
    const picks: Record<GearSlot, Opt> = { weapon: p.o.w, helmet: p.o.h, gloves: p.o.g, chest: p.s.c.ch, legs: p.s.c.lg, boots: p.s.c.bt };
    const combat = (g: GearInput) => computeHit({ levels, gear: g, ammo: p.o.ammo, booster: 'none', rankBonusPct: req.rankBonusPct, war: req.war, conventions: conv });
    const hit = combat(asGear(picks));
    const dodgeP = hit.dodgeProbability;
    // exact costs (helmet/gloves wear scaled by dodge, unlike the conservative search value)
    const miss = new Set<string>();
    const wc = (o: Opt, w: number) => { if (fixed || o.id === null || w <= 0) return 0; const extra = Math.max(0, Math.ceil((N * w) / o.durability - 1e-9) - 1); if (!extra) return 0; if (o.repl === null) { miss.add(`replacement price of ${o.id}`); return 0; } return extra * o.repl; };
    const ws = picks.weapon.id ? (picks.weapon.stats as unknown as WeaponStats) : null; const active = !!ws && (!ws.usesAmmo || p.o.ammo !== 'none');
    const replacement = wc(picks.weapon, active ? 1 : 0) + wc(picks.helmet, 1 - dodgeP) + wc(picks.gloves, 1 - dodgeP) + wc(picks.chest, 1 - dodgeP) + wc(picks.legs, 1 - dodgeP) + wc(picks.boots, 1 - dodgeP);
    const acquisition = (Object.values(picks) as Opt[]).reduce((n, o) => n + o.acq, 0);
    const ammo = ammoCost(p.o.ammo);
    const foodCost = p.s.c.food ? p.s.c.meals * (foods.find((f) => f.type === p.s.c.food)?.price ?? 0) : 0;
    const mp = new Set<string>(missingPrices); miss.forEach((m) => mp.add(m));
    const needFood = p.s.c.meals > 0 && foods.find((f) => f.type === p.s.c.food)?.price === undefined;
    const cost: CostBreakdown = { acquisition, ammo, food: foodCost, replacement, total: acquisition + ammo + foodCost + replacement, complete: !([...mp].some((m) => m !== 'food price') || needFood), missingPrices: [...mp].filter((m) => m !== 'food price' || needFood) };
    const estimatedSlots = (Object.values(picks) as Opt[]).filter((o) => o.estimated).map((o) => o.slot);
    let damageRange: WarBuild['damageRange'] = null;
    if (estimatedSlots.length) {
      const at = (w: StatEstimate) => { const g = { ...picks }; for (const o of Object.values(picks) as Opt[]) if (o.estimated && o.rarity) g[o.slot] = { ...o, stats: o.slot === 'weapon' ? { ...rarityStats('weapon', o.rarity as never, w), usesAmmo: true } : rarityStats(o.slot, o.rarity as never, w) }; return N * combat(asGear(g)).expected; };
      damageRange = { low: at('low'), high: at('high') };
    }
    const totalLoss = N * hit.healthLossPerHit;
    const used = [...new Set([...hit.usedFormulas, 'war.session', 'war.search', 'rewards.loot', 'loadout.durability', 'loadout.food', ...(fixed ? ['war.fixedGear'] : [])])];
    const gearPicks: PickedItem[] = (['weapon', 'helmet', 'gloves', 'chest', 'legs', 'boots'] as GearSlot[]).map((s) => ({ slot: s, id: picks[s].id, stats: picks[s].id ? { ...picks[s].stats } : null, durability: Number.isFinite(picks[s].durability) ? picks[s].durability : null, estimated: picks[s].estimated, owned: picks[s].owned }));
    const pointsSpent = base + p.o.pts + p.s.pts; const dmgN = N * hit.expected;
    const resetRequired = !!cur && SKILL_IDS.some((s) => levels[s] < cur[s]);
    for (const m of cons.filter((c) => c.strength === 'mandatory')) if (!satisfies(m.spec, levels, pointsSpent)) throw new Error(`Internal error: mandatory constraint ${m.id} violated`);
    return {
      role, levels, pointsSpent, pointsRemaining: req.player.totalPoints - pointsSpent, gear: gearPicks, ammo: p.o.ammo, food: p.s.c.food ? { type: p.s.c.food, meals: p.s.c.meals } : null,
      hit, hits: N, expectedDamage: dmgN, damageRange, estimatedSlots,
      survival: { lossPerHit: hit.healthLossPerHit, totalLoss, meals: p.s.c.meals, hungerAvailable: V.hunger[hu]!, feasible: true },
      loot: { chancePct: V.lootChance[p.s.loot]!, expectedCrates: (N * V.lootChance[p.s.loot]!) / 100, expectedValue: obj.type === 'maxNet' && obj.crateValue !== undefined ? (N * V.lootChance[p.s.loot]! / 100) * obj.crateValue : null },
      cost, costPer1000Damage: dmgN > 0 ? (cost.total / dmgN) * 1000 : null,
      costIsLowerBound: !cost.complete, netIsUpperBound: obj.type === 'maxNet' && !cost.complete,
      net: obj.type === 'maxNet' ? revenue(dmgN, (N * V.lootChance[p.s.loot]!) / 100) - cost.total : null,
      resetRequired, resetCostGold: resetRequired ? resetCost(totalCost(cur!), req.player.firstResetFree ?? false) : cur ? 0 : null,
      mandatoryPreserved: cons.filter((c) => c.strength === 'mandatory').map((c) => c.id), evidence: weakestStatus(used), usedFormulas: used,
    };
  }
  if (missingPrices.size) assumptions.push(`Unknown prices counted as 0 gold (costs are lower bounds): ${[...missingPrices].join(', ')}.`);
  if (!fixed) for (const sl of ['weapon', 'helmet', 'gloves', 'chest', 'legs', 'boots'] as GearSlot[]) if (slots[sl].every((o) => o.id === null)) assumptions.push(`No candidate was supplied for the ${sl} slot: it stays empty in every recommendation.`);
  assumptions.push(`Cost policy: ${policy}.`);
  if (!fixed) assumptions.push('Search treats helmet/gloves wear conservatively (1 durability per hit); reported costs use the exact dodge-adjusted wear.');
  if (req.food?.startHealthFraction === undefined) assumptions.push('Meals are assumed to be eaten without over-heal waste.');
  const pillOpt = req.pill && req.pill.include ? req.pill : null;
  const pill = pillOpt ? builds.map((b) => analysePill({ ...pillOpt, combat: { levels: b.levels, gear: asGearFrom(b), ammo: b.ammo, rankBonusPct: req.rankBonusPct, war: req.war, conventions: conv } })) : null;
  return { ok: true, builds, assumptions, configurations: nCfg, pairsEvaluated: pairs, pill };
}
function asGearFrom(b: WarBuild): GearInput {
  const sl = (p: PickedItem) => (p.id === null ? { kind: 'empty' } : { kind: 'item', stats: p.stats });
  const m = Object.fromEntries(b.gear.map((g) => [g.slot, sl(g)]));
  return { weapon: m.weapon, helmet: m.helmet, gloves: m.gloves, chest: m.chest, legs: m.legs, boots: m.boots } as GearInput;
}
