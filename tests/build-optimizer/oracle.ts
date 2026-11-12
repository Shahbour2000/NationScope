/**
 * Independent verification oracle for the Skill Build Engine (tests only).
 *
 * Independence rules: nothing is imported from `@/features/build-optimizer/engine`. Every number below is typed in from the Wiki
 * (01-basics §2.2-2.6, §3.3-3.5; 03-war §1.5-1.7) or from the registry's written specification of the engine's own modelling choices
 * (meal formula, cost components, objective semantics), and every search is a plain full enumeration: no folding of constraints into
 * bounds, no Pareto pruning, no dominance rules. A mismatch therefore means either an engine bug or an oracle misreading; both get investigated.
 */

// ---------- seeded PRNG (deterministic) ----------
export function rng(seed: number) {
  let a = seed >>> 0;
  const next = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return {
    next,
    int: (lo: number, hi: number) => lo + Math.floor(next() * (hi - lo + 1)),
    pick: <T,>(xs: readonly T[]): T => xs[Math.floor(next() * xs.length)]!,
    chance: (p: number) => next() < p,
    shuffle: <T,>(xs: T[]): T[] => { const o = [...xs]; for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [o[i], o[j]] = [o[j]!, o[i]!]; } return o; },
  };
}
export type Rng = ReturnType<typeof rng>;

// ---------- Wiki constants, typed in independently ----------
export type Sk = 'energy' | 'health' | 'hunger' | 'attack' | 'companySlots' | 'business' | 'production' | 'critChance' | 'critDamage' | 'armor' | 'accuracy' | 'dodge' | 'lootChance' | 'leadership';
export const SKILL_ORDER: Sk[] = ['energy', 'health', 'hunger', 'attack', 'companySlots', 'business', 'production', 'critChance', 'critDamage', 'armor', 'accuracy', 'dodge', 'lootChance', 'leadership'];
export const WAR_SK: Sk[] = ['health', 'hunger', 'attack', 'critChance', 'critDamage', 'armor', 'accuracy', 'dodge', 'lootChance'];
// Wiki 01-basics §2.4 skill table: [level 0, level 10, unlock player level]
export const W_SKILL: Record<Sk, [number, number, number]> = {
  energy: [30, 150, 1], health: [100, 220, 4], hunger: [5, 15, 8], attack: [100, 400, 1], companySlots: [2, 12, 4], business: [30, 130, 1], production: [10, 50, 1],
  critChance: [10, 50, 4], critDamage: [100, 350, 8], armor: [0, 50, 6], accuracy: [50, 110, 1], dodge: [0, 30, 12], lootChance: [5, 35, 1], leadership: [4, 34, 9],
};
// Wiki "Skill point costs": 1,1,2,3,4,5,6,8,9,10 -> cumulative
export const CUM = [0, 1, 2, 4, 7, 11, 16, 22, 30, 39, 49];
export const statAt = (s: Sk, l: number) => W_SKILL[s][0] + ((W_SKILL[s][1] - W_SKILL[s][0]) * l) / 10; // linear interpolation = the engine's documented ESTIMATE
export const AMMO_PCT = { none: 0, light: 12, medium: 25, heavy: 45 } as const; // 01-basics §3.5
export const AMMO_LEAD = { none: 0, light: 1, medium: 3, heavy: 12 } as const;
export const FOOD_PCT = { bread: 12, steak: 18, cookedFish: 25 } as const; // 01-basics §2.3
export type Ammo = keyof typeof AMMO_PCT; export type Food = keyof typeof FOOD_PCT;

// ---------- constraints: independent predicate per spec type ----------
export type CSpec =
  | { type: 'minLevel' | 'maxLevel' | 'exactLevel'; skill: Sk; level: number }
  | { type: 'minPoints' | 'maxPoints' | 'exactPoints'; skill: Sk; points: number }
  | { type: 'minStat'; skill: Sk; value: number }
  | { type: 'totalBudget'; points: number };
export const levelOk = (spec: CSpec, l: number): boolean => {
  switch (spec.type) {
    case 'minLevel': return l >= spec.level; case 'maxLevel': return l <= spec.level; case 'exactLevel': return l === spec.level;
    case 'minPoints': return CUM[l]! >= spec.points; case 'maxPoints': return CUM[l]! <= spec.points; case 'exactPoints': return CUM[l] === spec.points;
    case 'minStat': return statAt(spec.skill, l) >= spec.value; case 'totalBudget': return true;
  }
};
/** All levels a skill may take: unlock rule + every unary mandatory constraint, by testing each of the 11 levels. */
export function allowedLevels(skill: Sk, specs: CSpec[], playerLevel: number): number[] {
  const out: number[] = [];
  for (let l = 0; l <= 10; l++) {
    if (l > 0 && playerLevel < W_SKILL[skill][2]) continue;
    if (specs.every((s) => s.type === 'totalBudget' || s.skill !== skill || levelOk(s, l))) out.push(l);
  }
  return out;
}
export const effectiveBudget = (specs: CSpec[], total: number): number => specs.reduce((b, s) => (s.type === 'totalBudget' ? Math.min(b, s.points) : b), total);
/** Feasibility of a constraint set for the whole skill space: null = a skill has no allowed level (conflict); else per-skill sets. */
export function skillSpace(specs: CSpec[], playerLevel: number): { sets: Record<Sk, number[]>; emptySkills: Sk[] } {
  const sets = {} as Record<Sk, number[]>; const emptySkills: Sk[] = [];
  for (const s of SKILL_ORDER) { sets[s] = allowedLevels(s, specs, playerLevel); if (!sets[s].length) emptySkills.push(s); }
  return { sets, emptySkills };
}
export const pointsOf = (lv: Record<Sk, number>) => SKILL_ORDER.reduce((n, s) => n + CUM[lv[s]]!, 0);

// ---------- generic exhaustive search with the documented ranking ----------
/** Top-K by: higher score, then more satisfied preferences, then fewer points, then lexicographically smaller levels (SKILL_ORDER). */
export function exhaustiveTop(sets: Record<Sk, number[]>, decision: Sk[], budget: number, score: (lv: Record<Sk, number>) => number, topK: number,
  prefs: ((lv: Record<Sk, number>) => boolean)[] = []): { levels: Record<Sk, number>; score: number; points: number; prefs: number }[] {
  const lv = {} as Record<Sk, number>; for (const s of SKILL_ORDER) lv[s] = Math.min(...sets[s]);
  const all: { levels: Record<Sk, number>; score: number; points: number; prefs: number }[] = [];
  const free = decision.filter((s) => sets[s].length > 0);
  const rec = (i: number): void => {
    if (i === free.length) { const p = pointsOf(lv); if (p <= budget) all.push({ levels: { ...lv }, score: score(lv), points: p, prefs: prefs.filter((f) => f(lv)).length }); return; }
    for (const l of sets[free[i]!]) { lv[free[i]!] = l; rec(i + 1); }
    lv[free[i]!] = Math.min(...sets[free[i]!]);
  };
  rec(0);
  all.sort((a, b) => b.score - a.score || b.prefs - a.prefs || a.points - b.points || (() => { for (const s of SKILL_ORDER) if (a.levels[s] !== b.levels[s]) return a.levels[s] - b.levels[s]; return 0; })());
  return all.slice(0, topK);
}

// ---------- War Build oracle: Wiki damage pipeline + registry cost/objective specification, by full enumeration ----------
export interface OWeapon { id: string; attack: number; crit: number; usesAmmo: boolean; durability: number; price?: number; repl?: number }
export interface OItem { id: string; value: number; durability: number; price?: number; repl?: number }
export interface OCase {
  playerLevel: number; totalPoints: number; specs: CSpec[]; hits: number; rankPct: number; battlePct: number; startFrac: number;
  weapons: OWeapon[]; helmets: OItem[]; gloves: OItem[]; chests: OItem[]; legs: OItem[]; boots: OItem[]; allowEmpty: boolean; fixed: boolean;
  ammo: Ammo[]; leadPrice: number; leadStock: number; foods: { type: Food; price: number }[];
  objective: { type: 'maxDamage'; budget?: number } | { type: 'bestValue'; share: number; budget?: number } | { type: 'maxNet'; goldPerDamage?: number; crateValue?: number; budget?: number };
}
export interface OBuild { levels: Record<Sk, number>; ids: string[]; ammo: Ammo; food: Food | null; meals: number; dmg: number; cost: number; crates: number; net: number; lossPerHit: number; pts: number }

const dim = (v: number, t: number) => (v <= t ? v : t + (v - t) / 2); // 01-basics §2.4: beyond 45 (armor) / 36 (dodge) counts 50%
const fl = (x: number) => Math.max(1, Math.floor(x));            // 03-war §1.6 step 7

/** Wiki 03-war §1.6 per-hit figure (luck neutral): probability-weighted sum of floored outcomes. */
export function oHitDetail(lv: Record<Sk, number>, w: OWeapon | null, hm: OItem | null, gl: OItem | null, ammo: Ammo, rankPct: number, battlePct: number, pillPct = 0): { per: number; min: number; max: number } {
  const active = !!w && (!w.usesAmmo || ammo !== 'none');
  const acc = statAt('accuracy', lv.accuracy) + (gl?.value ?? 0), cc = statAt('critChance', lv.critChance) + (active ? w!.crit : 0);
  const accEx = Math.max(0, acc - 100), ccEx = Math.max(0, cc - 100);
  const atk = statAt('attack', lv.attack) + (active ? w!.attack : 0) + 3 * accEx;
  const cd = statAt('critDamage', lv.critDamage) + (hm?.value ?? 0) + 3 * ccEx;
  const A = atk * (1 + (AMMO_PCT[ammo] + rankPct + pillPct) / 100); // ammo + stimulant + rank summed (03-war §1.6 step 2)
  const p = Math.min(acc, 100) / 100, c = Math.min(cc, 100) / 100, bm = Math.max(0, 1 + battlePct / 100);
  const out = [{ pr: 1 - p, d: 0.5 * A * bm }, { pr: p * (1 - c), d: A * bm }, { pr: p * c, d: A * (1 + cd / 100) * bm }];
  const act = out.filter((o) => o.pr > 0);
  return { per: out.reduce((n, o) => n + o.pr * fl(o.d), 0), min: Math.min(...act.map((o) => fl(o.d * 0.9))), max: Math.max(...act.map((o) => fl(o.d * 1.1))) }; // luck +-10% range only (03-war §1.6 step 5)
}
export const oHit = (lv: Record<Sk, number>, w: OWeapon | null, hm: OItem | null, gl: OItem | null, ammo: Ammo, rankPct: number, battlePct: number): number => oHitDetail(lv, w, hm, gl, ammo, rankPct, battlePct).per;
export function oLoss(lv: Record<Sk, number>, armorGear: number, dodgeGear: number): { loss: number; dodgeP: number } {
  const a = Math.min(dim(statAt('armor', lv.armor) + armorGear, 45), 100), d = Math.min(dim(statAt('dodge', lv.dodge) + dodgeGear, 36), 100) / 100;
  return { loss: (1 - d) * Math.max(1, 10 * (1 - a / 100)), dodgeP: d };
}
const ceilTol = (x: number) => Math.ceil(x - 1e-9);

/** Every feasible build (full enumeration) with exact costs, plus the status explaining an empty result. */
export function oracleWar(c: OCase): { status: 'ok' | 'conflict' | 'infeasible'; builds: OBuild[] } {
  const { sets, emptySkills } = skillSpace(c.specs, c.playerLevel);
  if (emptySkills.length) return { status: 'conflict', builds: [] };
  const budget = effectiveBudget(c.specs, c.totalPoints);
  const baseLv = {} as Record<Sk, number>; for (const s of SKILL_ORDER) baseLv[s] = Math.min(...sets[s]);
  if (pointsOf(baseLv) > budget) return { status: 'conflict', builds: [] };
  const slotList = <T,>(xs: T[]): (T | null)[] => (c.allowEmpty || xs.length === 0 ? [...xs, null] : [...xs]);
  const W = slotList(c.weapons), H = slotList(c.helmets), G = slotList(c.gloves), C = slotList(c.chests), L = slotList(c.legs), B = slotList(c.boots);
  const builds: OBuild[] = [];
  const lv = { ...baseLv };
  const free = WAR_SK;
  const goldPer = c.objective.type === 'maxNet' ? c.objective.goldPerDamage : undefined, crateVal = c.objective.type === 'maxNet' ? c.objective.crateValue ?? 0 : 0;
  const walk = (i: number): void => {
    if (i < free.length) { const s = free[i]!; for (const l of sets[s]) { lv[s] = l; walk(i + 1); } lv[s] = baseLv[s]; return; }
    const pts = pointsOf(lv); if (pts > budget) return;
    for (const w of W) for (const hm of H) for (const gl of G) for (const ch of C) for (const lg of L) for (const bt of B) for (const ammo of c.ammo) {
      const per = oHit(lv, w, hm, gl, ammo, c.rankPct, c.battlePct); const dmg = c.hits * per;
      const { loss, dodgeP } = oLoss(lv, (ch?.value ?? 0) + (lg?.value ?? 0), bt?.value ?? 0);
      const H0 = statAt('health', lv.health), hungerMax = statAt('hunger', lv.hunger);
      const need = c.hits * loss + 10 - c.startFrac * H0; // registry loadout.food / war.session: meals = ceil((loss + reserve 10 - startHealth) / (food% * maxHealth))
      let food: Food | null = null, meals = 0, foodCost = 0;
      if (need > 0) {
        let best: { f: Food; m: number; cost: number } | null = null;
        for (const f of c.foods) { const m = ceilTol(need / ((FOOD_PCT[f.type] / 100) * H0)); if (m > hungerMax) continue; const cost = m * f.price; if (!best || cost < best.cost - 1e-12 || (Math.abs(cost - best.cost) < 1e-12 && m < best.m)) best = { f: f.type, m, cost }; }
        if (!best) continue; food = best.f; meals = best.m; foodCost = best.cost;
      }
      const active = !!w && (!w.usesAmmo || ammo !== 'none');
      const acq = [w, hm, gl, ch, lg, bt].reduce((n, x) => n + (x?.price ?? 0), 0);
      const paid = ammo === 'none' ? 0 : Math.max(0, c.hits * AMMO_LEAD[ammo] - c.leadStock) * c.leadPrice;
      let repl = 0;
      if (!c.fixed) { // wear: weapon 1/hit when active; every other item 1-dodge per hit (01-basics §3.4); replacements = ceil(total wear / durability) - 1
        const wc = (x: { durability: number; price?: number; repl?: number } | null, wear: number) => { if (!x || wear <= 0) return 0; const extra = Math.max(0, ceilTol((c.hits * wear) / x.durability) - 1); return extra * (x.repl ?? x.price ?? 0); };
        repl = wc(w, active ? 1 : 0) + wc(hm, 1 - dodgeP) + wc(gl, 1 - dodgeP) + wc(ch, 1 - dodgeP) + wc(lg, 1 - dodgeP) + wc(bt, 1 - dodgeP);
      }
      const cost = acq + paid + foodCost + repl;
      const budgetCap = c.objective.budget;
      if (budgetCap !== undefined && cost > budgetCap + 1e-9) continue;
      const crates = (c.hits * statAt('lootChance', lv.lootChance)) / 100;
      const rev = c.objective.type === 'maxNet' ? (goldPer !== undefined ? goldPer * dmg : 0) + crateVal * crates : 0;
      builds.push({ levels: { ...lv }, ids: [w?.id ?? '-', hm?.id ?? '-', gl?.id ?? '-', ch?.id ?? '-', lg?.id ?? '-', bt?.id ?? '-'], ammo, food, meals, dmg, cost, crates, net: rev - cost, lossPerHit: loss, pts });
    }
  };
  walk(0);
  return { status: builds.length ? 'ok' : 'infeasible', builds };
}
const EPS = 1e-9;
/** The objective semantics written in the registry (war.objectives): returns the winning build. */
export function oracleChoose(builds: OBuild[], o: OCase['objective'], altShare = 0.8): { primary: OBuild; maxDamage: OBuild; cheapest: OBuild; bestValueAlt: OBuild } {
  const byDmg = (a: OBuild, b: OBuild) => a.dmg > b.dmg + EPS || (Math.abs(a.dmg - b.dmg) <= EPS && (a.cost < b.cost - EPS || (Math.abs(a.cost - b.cost) <= EPS && a.crates > b.crates + EPS)));
  const byCost = (a: OBuild, b: OBuild) => a.cost < b.cost - EPS || (Math.abs(a.cost - b.cost) <= EPS && a.dmg > b.dmg + EPS);
  const byNet = (a: OBuild, b: OBuild) => a.net > b.net + EPS || (Math.abs(a.net - b.net) <= EPS && a.dmg > b.dmg + EPS);
  const best = (pool: OBuild[], better: (a: OBuild, b: OBuild) => boolean) => pool.reduce((m, x) => (better(x, m) ? x : m), pool[0]!);
  const maxDamage = best(builds, byDmg), cheapest = best(builds, byCost);
  const valueOf = (share: number) => best(builds.filter((b) => b.dmg >= share * maxDamage.dmg - EPS), byCost);
  const primary = o.type === 'maxDamage' ? maxDamage : o.type === 'bestValue' ? valueOf(o.share) : best(builds, byNet);
  return { primary, maxDamage, cheapest, bestValueAlt: valueOf(o.type === 'bestValue' ? o.share : altShare) };
}
