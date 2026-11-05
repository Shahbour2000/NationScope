import { defineFormula, weakestStatus, type EvidenceStatus } from './registry';
import { AMMO, battleModifierPct, computeHit, DEFAULT_CONVENTIONS, type AmmoType, type Conventions, type GearInput, type HitModel, type WarContext, type WeaponStats } from './combat';
import { noReduceConstraints, resolveConstraints, satisfies, type Conflict, type Constraint } from './constraints';
import { cumulativeCost, emptyLevels, skillValue, SKILL_IDS, type Levels } from './skills';
import { FOOD_PCT, type FoodType } from './loadout';
import type { GearSlot } from './rarity';
import { asGear, diminish, fixedOptions, normaliseOptions, RESERVE, statNum, type GearPolicy, type Opt } from './war-build';

defineFormula({ id: 'sustain.session', version: 1, status: 'estimated',
  summary: 'Expected-value session: the player fights until the first limit is reached. Health pool = start health + meals*restore - 10 (reserve); meals <= start hunger and <= food stock, strongest food first; hits_health = floor(pool / lossPerHit). Other limits: ammo stock (unless purchasable), durability of each worn item (weapon 1/hit, others (1-dodge)/hit) unless replacements are purchasable. Sustainable hits = the minimum. Consistent with the fixed-N survival rule (meals(N) <= hunger iff N <= hits_health).',
  source: 'wiki 01-basics §2.2-2.4, §3.4-3.5, 03-war §1.5; engine design', inputs: ['skills', 'gear', 'ammo', 'start health/hunger', 'food stock', 'durability'], outputs: ['sustainableHits', 'limitingFactor', 'cost'],
  dependsOn: ['combat.sustain', 'combat.hitOutcomes', 'loadout.durability', 'loadout.food'], tests: ['sustainable session'] });
defineFormula({ id: 'sustain.search', kind: 'algorithm', version: 1, status: 'documented',
  summary: 'Exact per equipment configuration: best damage per point budget for the offense group (prefix maximum) combined with every sustain allocation (health, hunger, armor, dodge, loot chance). Damage = min(sustain capacity, ammo/weapon limit) x expected damage; cost depends only on the sustain side and the configuration. Equipment configurations are enumerated explicitly (capped).',
  source: 'engine design', inputs: ['candidates', 'objective'], outputs: ['ranked builds'], dependsOn: ['sustain.session', 'war.search'], tests: ['sustainable search matches brute force'] });

export interface FoodStock { type: FoodType; /** gold per meal; undefined = unknown (counted as 0 and flagged) */ price?: number; /** meals available; undefined = unknown (treated as unlimited and flagged) */ stock?: number }
export interface SustainStart { /** share of max health at the start (default 1 = full, ASSUMED: current health is not exposed) */ healthFraction?: number; /** hunger available at the start (default = max hunger, ASSUMED) */ hunger?: number }
export interface SustainInput {
  levels: Levels; gear: GearInput; ammo: AmmoType; rankBonusPct?: number; war?: WarContext; conventions?: Partial<Conventions>;
  start?: SustainStart; food?: FoodStock[];
  /** lead units owned; undefined = unknown (unlimited assumed and flagged) */ ammoStock?: number; leadPerUnit?: number; buyAmmo?: boolean;
  /** current durability per worn slot; undefined = unknown (no limit, flagged) */ durabilities?: Partial<Record<GearSlot, number>>;
  /** allow buying replacements when an item breaks (needs replacementPrices) */ replacementPrices?: Partial<Record<GearSlot, number>>; buyReplacements?: boolean;
}
export type LimitingFactor = 'health-and-hunger' | 'food-stock' | 'ammo-stock' | `durability:${GearSlot}` | 'none';
export interface SustainResult {
  sustainableHits: number; limitingFactor: LimitingFactor; limits: { healthHunger: number; ammo: number; durability: Partial<Record<GearSlot, number>> };
  hit: HitModel; expectedDamage: number; lossPerHit: number; meals: { type: FoodType; meals: number }[]; mealsTotal: number; hungerLeft: number;
  cost: { ammo: number; food: number; replacement: number; total: number; complete: boolean; missing: string[] }; costIsLowerBound: boolean;
  assumptions: string[]; usedFormulas: string[]; evidence: EvidenceStatus;
}
const STRONGEST: FoodType[] = ['cookedFish', 'steak', 'bread'];

/** Strongest-restore-first meal plan covering `need` health (or the maximum possible when need = Infinity). */
export function mealPlan(need: number, H: number, hungerCap: number, foods: { type: FoodType; stock?: number }[]): { plan: { type: FoodType; meals: number }[]; restored: number; covered: boolean } {
  const plan: { type: FoodType; meals: number }[] = []; let cap = Math.floor(hungerCap), restored = 0;
  const ordered = [...foods].sort((a, b) => FOOD_PCT[b.type] - FOOD_PCT[a.type]);
  for (const f of ordered) {
    if (cap <= 0 || restored >= need) break;
    const r = (FOOD_PCT[f.type] / 100) * H, want = need === Infinity ? Infinity : Math.ceil((need - restored) / r - 1e-9);
    const m = Math.min(f.stock ?? Infinity, cap, want); if (m <= 0) continue;
    plan.push({ type: f.type, meals: m }); cap -= m; restored += m * r;
  }
  return { plan, restored, covered: restored >= need - 1e-9 };
}

export function sustainableCombat(inp: SustainInput): SustainResult {
  const assumptions: string[] = [];
  const hit = computeHit({ levels: inp.levels, gear: inp.gear, ammo: inp.ammo, booster: 'none', rankBonusPct: inp.rankBonusPct, war: inp.war, conventions: inp.conventions });
  const H = skillValue('health', inp.levels.health), hungerMax = skillValue('hunger', inp.levels.hunger);
  if (inp.start?.healthFraction === undefined) assumptions.push('Starting health assumed full (not exposed by the API).');
  if (inp.start?.hunger === undefined) assumptions.push('Starting hunger assumed full (not exposed by the API).');
  const startH = (inp.start?.healthFraction ?? 1) * H, hunger = Math.min(inp.start?.hunger ?? hungerMax, hungerMax);
  const foods = inp.food ?? STRONGEST.map((t) => ({ type: t } as FoodStock));
  if (foods.some((f) => f.stock === undefined)) assumptions.push('Food stock unknown for some foods: treated as unlimited (limited only by hunger).');
  const loss = hit.healthLossPerHit;
  const maxPlan = mealPlan(Infinity, H, hunger, foods);
  const healthHunger = Math.max(0, Math.floor((startH + maxPlan.restored - RESERVE) / loss));
  const hungerLimited = maxPlan.plan.reduce((n, p) => n + p.meals, 0) >= Math.floor(hunger);
  // ammo
  const lead = inp.ammo === 'none' ? 0 : AMMO[inp.ammo].lead;
  let ammoLimit = Infinity; const missing: string[] = [];
  if (lead > 0) {
    if (inp.ammoStock === undefined) { assumptions.push('Ammo stock unknown: unlimited assumed.'); }
    else if (!(inp.buyAmmo && inp.leadPerUnit !== undefined)) ammoLimit = Math.floor(inp.ammoStock / lead);
  }
  // durability
  const wc = weaponActive(inp.gear, inp.ammo);
  const wear = (slot: GearSlot) => (slot === 'weapon' ? (wc ? 1 : 0) : 1 - hit.dodgeProbability);
  const durLimits: Partial<Record<GearSlot, number>> = {};
  for (const slot of ['weapon', 'helmet', 'gloves', 'chest', 'legs', 'boots'] as GearSlot[]) {
    const g = inp.gear[slot === 'legs' ? 'legs' : slot] as { kind: string } | undefined; const d = inp.durabilities?.[slot];
    if (!g || g.kind !== 'item') continue;
    if (d === undefined) { assumptions.push(`Durability of ${slot} unknown: no limit applied.`); continue; }
    const w = wear(slot); if (w <= 0) continue;
    durLimits[slot] = Math.floor(d / w + 1e-9);
  }
  const buyRepl = inp.buyReplacements === true;
  const durMin = buyRepl ? Infinity : Math.min(Infinity, ...Object.values(durLimits));
  const hits = Math.max(0, Math.min(healthHunger, ammoLimit, durMin));
  let limiting: LimitingFactor = 'none';
  if (hits === healthHunger) limiting = hungerLimited ? 'health-and-hunger' : 'food-stock';
  else if (hits === ammoLimit) limiting = 'ammo-stock';
  else for (const [slot, v] of Object.entries(durLimits)) if (v === hits) { limiting = `durability:${slot as GearSlot}`; break; }
  // meals and costs for exactly `hits` hits
  const need = hits * loss + RESERVE - startH;
  const used = need > 0 ? mealPlan(need, H, hunger, foods) : { plan: [], restored: 0, covered: true };
  let foodCost = 0; for (const p of used.plan) { const pr = foods.find((f) => f.type === p.type)?.price; if (pr === undefined) missing.push(`food price (${p.type})`); else foodCost += pr * p.meals; }
  let ammoCost = 0;
  if (lead > 0 && inp.buyAmmo) { const paid = Math.max(0, hits * lead - (inp.ammoStock ?? 0)); if (paid > 0) { if (inp.leadPerUnit === undefined) missing.push('lead price'); else ammoCost = paid * inp.leadPerUnit; } }
  let repl = 0;
  if (buyRepl) for (const slot of Object.keys(durLimits) as GearSlot[]) { const d = inp.durabilities![slot]!; const w = wear(slot); const extra = Math.max(0, Math.ceil((hits * w) / d - 1e-9) - 1); if (extra) { const pr = inp.replacementPrices?.[slot]; if (pr === undefined) missing.push(`replacement price (${slot})`); else repl += extra * pr; } }
  const usedF = ['sustain.session', ...hit.usedFormulas];
  const mealsTotal = used.plan.reduce((n, p) => n + p.meals, 0);
  return {
    sustainableHits: hits, limitingFactor: limiting, limits: { healthHunger, ammo: ammoLimit, durability: durLimits }, hit, expectedDamage: hits * hit.expected, lossPerHit: loss,
    meals: used.plan, mealsTotal, hungerLeft: Math.floor(hunger) - mealsTotal, cost: { ammo: ammoCost, food: foodCost, replacement: repl, total: ammoCost + foodCost + repl, complete: missing.length === 0, missing: [...new Set(missing)] },
    costIsLowerBound: missing.length > 0, assumptions: [...new Set([...assumptions, 'Expected values only: per-hit variance, regeneration during the session and eating-time rules are not modelled.'])], usedFormulas: usedF, evidence: weakestStatus(usedF),
  };
}
function weaponActive(g: GearInput, ammo: AmmoType): boolean {
  const w = g.weapon; if (!w || w.kind !== 'item') return false; const s = w.stats as WeaponStats; return !s.usesAmmo || ammo !== 'none';
}

// ------------------------------------------------------------------ optimizer
export interface SustainableRequest {
  player: { level: number; totalPoints: number; currentLevels?: Levels; firstResetFree?: boolean };
  constraints?: Constraint[]; allowReset?: boolean;
  gear: GearPolicy & { durabilities?: Partial<Record<GearSlot, number>> };
  ammoOptions?: AmmoType[]; ammoStock?: number; leadPerUnit?: number; buyAmmo?: boolean;
  start?: SustainStart; food?: FoodStock[];
  rankBonusPct?: number; war?: WarContext; conventions?: Partial<Conventions>;
  /** maximise damage over the sustainable session; budget caps acquisition + consumables (lower bound if prices unknown) */
  objective: { type: 'maxSessionDamage'; budget?: number };
  maxConfigs?: number; topK?: number;
}
export interface SustainableBuild { levels: Levels; pointsSpent: number; pointsRemaining: number; gear: GearInput; gearIds: Record<GearSlot, string | null>; ammo: AmmoType; session: SustainResult; acquisition: number; totalCost: number; costIsLowerBound: boolean; resetRequired: boolean; mandatoryPreserved: string[] }
export type SustainableResult =
  | { ok: true; builds: SustainableBuild[]; assumptions: string[]; configurations: number }
  | { ok: false; reason: 'conflict'; conflicts: Conflict[] } | { ok: false; reason: 'missing-input' | 'too-large' | 'infeasible'; message: string };

export function optimizeSustainableWarBuild(req: SustainableRequest): SustainableResult {
  const conv: Conventions = { ...DEFAULT_CONVENTIONS, ...req.conventions };
  const ammoOptions: AmmoType[] = req.ammoOptions?.length ? req.ammoOptions : ['none'];
  let slots; const fixed = req.gear.mode === 'fixed';
  if (req.gear.mode === 'fixed') { const r = fixedOptions(req.gear.gear, req.gear.durabilities); if (typeof r === 'string') return { ok: false, reason: 'missing-input', message: r }; slots = r; }
  else slots = normaliseOptions(req.gear.candidates, req.gear.estimate ?? 'low', req.gear.allowEmpty ?? true);
  const nCfg = (Object.values(slots) as Opt[][]).reduce((n, l) => n * l.length, 1) * ammoOptions.length;
  const maxCfg = req.maxConfigs ?? 150;
  if (nCfg > maxCfg) return { ok: false, reason: 'too-large', message: `Sustainable search enumerates equipment configurations explicitly: ${nCfg} > maxConfigs=${maxCfg}. Shorten the candidate lists or use Fixed Gear.` };
  const cons: Constraint[] = [...(req.constraints ?? [])]; const cur = req.player.currentLevels;
  if (req.allowReset === false) { if (!cur) return { ok: false, reason: 'missing-input', message: 'allowReset=false needs player.currentLevels.' }; cons.push(...noReduceConstraints(cur)); }
  const res = resolveConstraints(cons, { playerLevel: req.player.level, totalPoints: req.player.totalPoints });
  if (!res.ok) return { ok: false, reason: 'conflict', conflicts: res.conflicts };
  const B = res.bounds; let base = 0; for (const s of SKILL_IDS) base += cumulativeCost(B[s].lo);
  const ptsMax = Math.max(0, Math.floor(res.budget - base));
  const V = Object.fromEntries(SKILL_IDS.map((s) => [s, Array.from({ length: 11 }, (_, l) => skillValue(s, l))])) as Record<(typeof SKILL_IDS)[number], number[]>;
  const cum = (s: (typeof SKILL_IDS)[number], l: number) => cumulativeCost(l) - cumulativeCost(B[s].lo);
  const rankPct = req.rankBonusPct ?? 0;
  const battleMult = Math.max(0, 1 + (req.war ? req.war.displayedTotalPct ?? battleModifierPct(req.war.modifiers) : 0) / 100);
  const foods = req.food ?? STRONGEST.map((t) => ({ type: t } as FoodStock));
  const budget = req.objective.budget;
  const startFrac = req.start?.healthFraction ?? 1;
  interface Cand { dmg: number; cost: number; loot: number; levels: Levels; picks: Record<GearSlot, Opt>; ammo: AmmoType; pts: number }
  const all: Cand[] = []; let floor = -1; // candidates below `floor` can never reach the kept top list
  for (const w of slots.weapon) for (const h of slots.helmet) for (const g of slots.gloves) for (const ch of slots.chest) for (const lg of slots.legs) for (const bt of slots.boots) for (const ammo of ammoOptions) {
    const picks = { weapon: w, helmet: h, gloves: g, chest: ch, legs: lg, boots: bt } as Record<GearSlot, Opt>;
    const ws = w.id ? (w.stats as unknown as WeaponStats) : null; const active = !!ws && (!ws.usesAmmo || ammo !== 'none');
    const ammoPct = ammo === 'none' ? 0 : AMMO[ammo].pct; const lead = ammo === 'none' ? 0 : AMMO[ammo].lead;
    const pm = conv.stacking === 'additive' ? 1 + (ammoPct + rankPct) / 100 : (1 + ammoPct / 100) * (1 + rankPct / 100);
    const gAcc = statNum(g, 'accuracy'), hCd = statNum(h, 'critDamage');
    // offense: best E per points (prefix maximum)
    const bestE = new Array<number>(ptsMax + 1).fill(-1); const arg = new Array<[number, number, number, number] | null>(ptsMax + 1).fill(null);
    for (let a = B.attack.lo; a <= B.attack.hi; a++) { const pa = cum('attack', a); if (pa > ptsMax) break;
      for (let ac = B.accuracy.lo; ac <= B.accuracy.hi; ac++) { const pb = pa + cum('accuracy', ac); if (pb > ptsMax) break;
        const accTot = V.accuracy[ac]! + gAcc, accEx = Math.max(0, accTot - 100), p = Math.min(accTot, 100) / 100;
        for (let cc = B.critChance.lo; cc <= B.critChance.hi; cc++) { const pc = pb + cum('critChance', cc); if (pc > ptsMax) break;
          const ccTot = V.critChance[cc]! + (active ? ws!.critChance : 0), ccEx = Math.max(0, ccTot - 100), c = Math.min(ccTot, 100) / 100;
          for (let cd = B.critDamage.lo; cd <= B.critDamage.hi; cd++) { const pts = pc + cum('critDamage', cd); if (pts > ptsMax) break;
            const A = (V.attack[a]! + (active ? ws!.attack : 0) + 3 * accEx) * pm; const cm = (conv.critMultiplier === 'onePlus' ? 1 : 0) + (V.critDamage[cd]! + hCd + 3 * ccEx) / 100;
            const E = battleMult * A * ((1 - p) * 0.5 + p * ((1 - c) + c * cm));
            if (E > bestE[pts]!) { bestE[pts] = E; arg[pts] = [a, ac, cc, cd]; } } } } }
    for (let i = 1; i <= ptsMax; i++) if (bestE[i]! < bestE[i - 1]!) { bestE[i] = bestE[i - 1]!; arg[i] = arg[i - 1]!; }
    // sustain side
    const aG = statNum(ch, 'armor') + statNum(lg, 'armor'), dG = statNum(bt, 'dodge');
    const acq = w.acq + h.acq + g.acq + ch.acq + lg.acq + bt.acq;
    const nAmmo = lead > 0 && req.ammoStock !== undefined && !(req.buyAmmo && req.leadPerUnit !== undefined) ? Math.floor(req.ammoStock / lead) : Infinity;
    const nWeapon = w.id && active && Number.isFinite(w.durability) ? Math.floor(w.durability) : Infinity;
    const nO = Math.min(nAmmo, nWeapon);
    for (let hl = B.health.lo; hl <= B.health.hi; hl++) { const p1 = cum('health', hl); if (p1 > ptsMax) break; const Hh = V.health[hl]!;
      for (let hu = B.hunger.lo; hu <= B.hunger.hi; hu++) { const p2 = p1 + cum('hunger', hu); if (p2 > ptsMax) break; const hungerCap = Math.min(req.start?.hunger ?? V.hunger[hu]!, V.hunger[hu]!);
        const mp = mealPlan(Infinity, Hh, hungerCap, foods);
        for (let ar = B.armor.lo; ar <= B.armor.hi; ar++) { const p3 = p2 + cum('armor', ar); if (p3 > ptsMax) break; const armorEff = Math.min(diminish(V.armor[ar]! + aG, 45), 100);
          for (let dg = B.dodge.lo; dg <= B.dodge.hi; dg++) { const p4 = p3 + cum('dodge', dg); if (p4 > ptsMax) break;
            const dodgeP = Math.min(diminish(V.dodge[dg]! + dG, 36), 100) / 100; const loss = (1 - dodgeP) * Math.max(1, 10 * (1 - armorEff / 100));
            let nS = Math.max(0, Math.floor((startFrac * Hh + mp.restored - RESERVE) / loss));
            for (const it of [h, g, ch, lg, bt]) if (it.id && Number.isFinite(it.durability)) nS = Math.min(nS, Math.floor(it.durability / (1 - dodgeP) + 1e-9));
            const N = Math.min(nS, nO); if (N <= 0) continue;
            const need = N * loss + RESERVE - startFrac * Hh;
            let food = 0; if (need > 0) for (const pl of mealPlan(need, Hh, hungerCap, foods).plan) food += pl.meals * (foods.find((f) => f.type === pl.type)?.price ?? 0);
            const paid = lead > 0 && req.buyAmmo ? Math.max(0, N * lead - (req.ammoStock ?? 0)) : 0;
            const cost = acq + food + paid * (req.leadPerUnit ?? 0);
            if (budget !== undefined && cost > budget + 1e-9) continue;
            for (let l = B.lootChance.lo; l <= B.lootChance.hi; l++) { const pts = p4 + cum('lootChance', l); if (pts > ptsMax) break;
              const rem = ptsMax - pts; const E = bestE[rem]!; if (E < 0 || N * E < floor - 1e-9) continue;
              all.push({ dmg: N * E, cost, loot: V.lootChance[l]!, levels: (() => { const lv = emptyLevels(); for (const s of SKILL_IDS) lv[s] = B[s].lo; const a = arg[rem]!; Object.assign(lv, { attack: a[0], accuracy: a[1], critChance: a[2], critDamage: a[3], health: hl, hunger: hu, armor: ar, dodge: dg, lootChance: l }); return lv; })(), picks, ammo, pts: pts + (() => { const a = arg[rem]!; return cum('attack', a[0]) + cum('accuracy', a[1]) + cum('critChance', a[2]) + cum('critDamage', a[3]); })() });
              if (all.length > 4000) { all.sort(byBest); all.length = 60; floor = all[59]!.dmg; } }
          } } } }
  }
  function byBest(a: Cand, b: Cand) { return b.dmg - a.dmg || a.cost - b.cost || b.loot - a.loot; }
  all.sort(byBest);
  if (!all.length) return { ok: false, reason: 'infeasible', message: budget !== undefined ? `Nothing sustainable fits the budget of ${budget} gold.` : 'No allocation can fight even one hit (check health, food and durability inputs).' };
  const out: SustainableBuild[] = []; const seen = new Set<string>();
  for (const c of all) {
    const key = JSON.stringify([c.levels, Object.values(c.picks).map((o) => o.id), c.ammo]); if (seen.has(key)) continue; seen.add(key);
    const gear = asGear(c.picks);
    const dur: Partial<Record<GearSlot, number>> = {}; for (const s of Object.keys(c.picks) as GearSlot[]) if (c.picks[s].id && Number.isFinite(c.picks[s].durability)) dur[s] = c.picks[s].durability;
    const session = sustainableCombat({ levels: c.levels, gear, ammo: c.ammo, rankBonusPct: req.rankBonusPct, war: req.war, conventions: req.conventions, start: req.start, food: foods, ammoStock: req.ammoStock, leadPerUnit: req.leadPerUnit, buyAmmo: req.buyAmmo, durabilities: dur });
    const acquisition = (Object.values(c.picks) as Opt[]).reduce((n, o) => n + o.acq, 0);
    for (const m of cons.filter((x) => x.strength === 'mandatory')) if (!satisfies(m.spec, c.levels, base + c.pts)) throw new Error(`Internal error: mandatory constraint ${m.id} violated`);
    out.push({ levels: c.levels, pointsSpent: base + c.pts, pointsRemaining: req.player.totalPoints - base - c.pts, gear, gearIds: Object.fromEntries((Object.keys(c.picks) as GearSlot[]).map((s) => [s, c.picks[s].id])) as Record<GearSlot, string | null>, ammo: c.ammo, session, acquisition, totalCost: acquisition + session.cost.total, costIsLowerBound: session.costIsLowerBound || foods.some((f) => f.price === undefined), resetRequired: !!cur && SKILL_IDS.some((s) => c.levels[s] < cur[s]), mandatoryPreserved: cons.filter((x) => x.strength === 'mandatory').map((x) => x.id) });
    if (out.length >= (req.topK ?? 3)) break;
  }
  const assumptions = ['Starting health and hunger are assumed full unless given.', 'Costs of unknown prices count as 0: results marked costIsLowerBound.', 'Offense points use a prefix-maximum, so spare points never reduce damage.'];
  if (!fixed) assumptions.push('Equipment configurations are enumerated explicitly (capped).');
  return { ok: true, builds: out, assumptions, configurations: nCfg };
}
