import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import {
  RECIPES, SKILL_IDS, cumulativeCost, emptyLevels, worksPerDay, dailyEconomy, unitValuePerPoint, optimizeBuild, resolveConstraints,
  enumerateGroup, combineGroups, computeHit, expectedCrateValue, lootExpectation, contractPayout, evaluateLoadouts, foodPlan,
  type EconomyInput, type GearInput, type Levels, type Floors, type Candidates, type Objective,
} from '@/features/build-optimizer/engine';

const lv = (o: Partial<Levels>): Levels => ({ ...emptyLevels(), ...o });
const approx = (a: number, b: number, e = 1e-6) => assert.ok(Math.abs(a - b) < e, `${a} !~ ${b}`);
const emptyGear: GearInput = { weapon: { kind: 'empty' }, helmet: { kind: 'empty' }, gloves: { kind: 'empty' }, chest: { kind: 'empty' }, legs: { kind: 'empty' }, boots: { kind: 'empty' } };
const knifeGear: GearInput = { ...emptyGear, weapon: { kind: 'item', stats: { attack: 30, critChance: 4, usesAmmo: false } } };
const econ = (o: Partial<EconomyInput> = {}): EconomyInput => ({
  companies: { count: 2, product: RECIPES.steel! }, prices: { steel: { sell: 10 }, iron: { buy: 1 } },
  marketTaxPct: 10, productionTaxPct: 0, incomeTaxPct: 10, job: { wagePerPoint: 0.5 }, ...o,
});

describe('economy', () => {
  it('works per day', () => { approx(worksPerDay(30), 7.2); approx(worksPerDay(130), 31.2); approx(worksPerDay(30, true), 10.2); });
  it('unit value', () => {
    const miss: string[] = [];
    approx(unitValuePerPoint(RECIPES.steel!, econ(), miss)!, (10 * 0.9 - 8) / 8); assert.equal(miss.length, 0);
    assert.equal(unitValuePerPoint(RECIPES.steel!, econ({ prices: { steel: { sell: 10 } } }), miss), null); assert.ok(miss.includes('price.buy.iron'));
    approx(unitValuePerPoint(RECIPES.steel!, econ({ productionTaxPct: 10 }), []) !, (10 * 0.9 * 0.9 - 8) / 8);
  });
  it('daily net', () => {
    const l = lv({ production: 5, business: 10, energy: 10, companySlots: 0 });
    const r = dailyEconomy(l, econ());
    approx(r.ownWorksPerDay, 31.2); approx(r.ownPointsPerDay, 31.2 * 30);
    approx(r.ownProfit!, 31.2 * 30 * 0.125);
    approx(r.jobIncome, 0.24 * 150 * 30 * 0.5 * 0.9);
    approx(r.net!, r.ownProfit! + r.jobIncome);
  });
  it('leadership caps workers', () => {
    const w = { count: 10, pointsPerWorkerPerDay: 100, wagePerPoint: 0.05 };
    assert.equal(dailyEconomy(lv({}), econ({ workers: w })).effectiveWorkers, 4);
    assert.equal(dailyEconomy(lv({ leadership: 10 }), econ({ workers: w })).effectiveWorkers, 10);
    approx(dailyEconomy(lv({ leadership: 10 }), econ({ workers: w })).workerMargin!, 10 * 100 * (0.125 - 0.05));
  });
  it('missing prices give null, never zero; too few slots is infeasible', () => {
    const r = dailyEconomy(lv({}), econ({ prices: { steel: { sell: 10 } } })); assert.equal(r.net, null); assert.ok(r.missing.length > 0);
    assert.equal(dailyEconomy(lv({ companySlots: 0 }), econ({ companies: { count: 5, product: RECIPES.steel! } })).net, null);
  });
  it('economic objective', () => {
    const base = { player: { level: 30, totalPoints: 60 }, objective: { type: 'maxEconomy' as const }, combat: { gear: emptyGear, ammo: 'none' as const, booster: 'none' as const, rankBonusPct: 0 }, economy: econ() };
    const r = optimizeBuild(base); assert.ok(r.ok); if (!r.ok) return;
    assert.ok(r.assumptions.some((a) => a.includes('protected'))); // companies auto-protected
    const b = r.builds[0]!;
    let best = -Infinity;
    const E = ['production', 'business', 'energy', 'leadership'] as const; // leadership irrelevant w/o workers, still enumerated
    for (let p = 0; p <= 10; p++) for (let bz = 0; bz <= 10; bz++) for (let e = 0; e <= 10; e++) {
      if (cumulativeCost(p) + cumulativeCost(bz) + cumulativeCost(e) > 60) continue;
      best = Math.max(best, dailyEconomy(lv({ production: p, business: bz, energy: e, companySlots: 0 }), econ()).net!);
    }
    void E; approx(b.score, best); assert.ok(b.levels.leadership === 0);
    const none = optimizeBuild({ ...base, economy: { ...econ(), prices: {} } }); assert.ok(!none.ok);
  });
});

describe('hybrid', () => {
  const baseReq = (objective: Objective, extra: object = {}) => ({
    player: { level: 30, totalPoints: 70 }, objective, combat: { gear: knifeGear, ammo: 'none' as const, booster: 'none' as const, rankBonusPct: 0 }, economy: econ(), ...extra });
  const dmg = optimizeBuild(baseReq({ type: 'maxDamagePerHit' }));
  const eco = optimizeBuild(baseReq({ type: 'maxEconomy' }));
  it('two-group matches brute force', () => {
    const bounds = Object.fromEntries(SKILL_IDS.map((s) => [s, { lo: 0, hi: 3 }])) as Record<(typeof SKILL_IDS)[number], { lo: number; hi: number }>;
    const A = ['attack', 'accuracy', 'critChance', 'critDamage'] as const, B = ['production', 'business', 'energy', 'leadership'] as const;
    const ma = (l: Levels) => computeHit({ levels: l, gear: knifeGear, ammo: 'none', booster: 'none', rankBonusPct: 0 }).expected;
    const mb = (l: Levels) => dailyEconomy(l, econ()).net ?? -1e15;
    const ea = enumerateGroup(bounds, [...A], ma), eb = enumerateGroup(bounds, [...B], mb);
    const comb = (x: number, y: number) => x / 500 + y / 100;
    const budget = 18;
    const got = combineGroups({ entries: ea.entries, skills: [...A] }, { entries: eb.entries, skills: [...B] }, bounds, budget, comb, { topK: 1 })[0]!;
    let best = -Infinity;
    for (const x of ea.entries) for (const y of eb.entries) if (x.extraCost + y.extraCost <= budget) best = Math.max(best, comb(x.metric, y.metric));
    approx(got.score, best);
  });
  it('hybrid constrained', () => {
    assert.ok(dmg.ok && eco.ok); if (!dmg.ok || !eco.ok) return;
    const floor = eco.builds[0]!.score * 0.5;
    const r = optimizeBuild(baseReq({ type: 'hybrid', mode: 'constrained', minDailyNet: floor })); assert.ok(r.ok); if (!r.ok) return;
    for (const b of r.builds) { assert.ok(b.economy!.net! >= floor); assert.ok(b.mandatoryPreserved.includes('cap:companies:auto')); }
    assert.ok(r.builds[0]!.hit.expected <= dmg.builds[0]!.hit.expected + 1e-9);
    const hard = optimizeBuild(baseReq({ type: 'hybrid', mode: 'constrained', minDailyNet: eco.builds[0]!.score * 10 })); assert.ok(!hard.ok && hard.reason === 'infeasible');
  });
  it('hybrid weighted', () => {
    assert.ok(dmg.ok && eco.ok); if (!dmg.ok || !eco.ok) return;
    const c = optimizeBuild(baseReq({ type: 'hybrid', mode: 'weighted', weightCombat: 1, weightEconomy: 0 })); assert.ok(c.ok);
    if (c.ok) approx(c.builds[0]!.hit.expected, dmg.builds[0]!.hit.expected);
    const e = optimizeBuild(baseReq({ type: 'hybrid', mode: 'weighted', weightCombat: 0, weightEconomy: 1 })); assert.ok(e.ok);
    if (e.ok) approx(e.builds[0]!.economy!.net!, eco.builds[0]!.economy!.net!);
    const m = optimizeBuild(baseReq({ type: 'hybrid', mode: 'weighted', weightCombat: 1, weightEconomy: 1 })); assert.ok(m.ok);
    if (m.ok) { assert.ok(m.builds[0]!.pointsSpent <= 70); assert.ok(m.assumptions.some((a) => a.includes('normalises'))); }
  });
  it('transition: military build while keeping 4 companies and a mandatory 5-point skill', () => {
    const r = optimizeBuild(baseReq({ type: 'hybrid', mode: 'constrained', minDailyNet: 0 }, {
      economy: econ({ companies: { count: 4, product: RECIPES.steel! } }),
      constraints: [{ id: 'five', strength: 'mandatory', spec: { type: 'minPoints', skill: 'business', points: 5 } }] }));
    assert.ok(r.ok); if (!r.ok) return;
    for (const b of r.builds) { assert.ok(b.levels.companySlots >= 2); assert.ok(cumulativeCost(b.levels.business) >= 5); }
  });
  it('no mandatory violation under conflict', () => {
    const r = optimizeBuild(baseReq({ type: 'hybrid', mode: 'constrained', minDailyNet: 0 }, { constraints: [{ id: 'x', strength: 'mandatory', spec: { type: 'maxLevel', skill: 'companySlots', level: 0 } }], economy: econ({ companies: { count: 4, product: RECIPES.steel! } }) }));
    assert.ok(!r.ok && r.reason === 'conflict');
  });
});

describe('rewards', () => {
  const flat = (v: number): Floors => ({ weapon: { common: v, uncommon: v, rare: v, epic: v, legendary: v, mythic: v }, armor: { common: v, uncommon: v, rare: v, epic: v, legendary: v, mythic: v } });
  it('loot', () => {
    approx(expectedCrateValue(flat(100))!, 100);
    assert.equal(expectedCrateValue({ weapon: { common: 1 }, armor: { common: 1 } }), null);
    const l = lootExpectation(1000, 5, flat(10)); approx(l.expectedCrates, 50); approx(l.expectedValue!, 500);
    assert.equal(lootExpectation(1000, 5).expectedValue, null);
  });
  it('looter objective', () => {
    const war = { warId: 'w', side: 'attacker' as const, modifiers: [], bounty: { ratePer1000: 0.01, remainingBudget: 1e9, eligible: true } };
    const r = optimizeBuild({ player: { level: 30, totalPoints: 30 }, objective: { type: 'maxNetValue', includeLoot: true }, combat: { gear: knifeGear, ammo: 'none', booster: 'none', rankBonusPct: 0, war }, prices: {}, loot: flat(100), hits: 1000 });
    assert.ok(r.ok); if (!r.ok) return;
    assert.ok(r.builds[0]!.levels.lootChance >= 5); assert.ok(r.builds[0]!.loot!.expectedValue! > 0);
    const noFloors = optimizeBuild({ player: { level: 30, totalPoints: 30 }, objective: { type: 'maxNetValue', includeLoot: true }, combat: { gear: knifeGear, ammo: 'none', booster: 'none', rankBonusPct: 0 } });
    assert.ok(!noFloors.ok && noFloors.reason === 'missing-input');
  });
  it('contract', () => {
    assert.equal(contractPayout(1000, 100, 150), 1000); approx(contractPayout(1000, 100, 40), 400 - 0.1 * 600); assert.equal(contractPayout(1000, 100, 0), -100);
  });
});

describe('loadout', () => {
  const cands: Candidates = {
    weapons: [{ id: 'knife', stats: { attack: 30, critChance: 4, usesAmmo: false }, durability: 100 }, { id: 'pistol', stats: { attack: 55, critChance: 7, usesAmmo: true }, durability: 100, price: 10 }],
    boots: [{ id: 'bootsA', stats: { dodge: 20 }, durability: 100, price: 5 }],
  };
  const ctx = (o: object = {}) => ({ levels: lv({}), booster: 'none' as const, hits: 100, ammoOptions: ['none', 'light', 'heavy'] as ('none' | 'light' | 'heavy')[], leadPrice: 1, objective: 'maxDamage' as const, ...o });
  it('loadout search', () => {
    const r = evaluateLoadouts(cands, ctx()); assert.ok(r.ok); if (!r.ok) return;
    assert.equal(r.results[0]!.ids.weapon, 'pistol'); assert.equal(r.results[0]!.ammo, 'heavy');
    assert.deepEqual(evaluateLoadouts(cands, ctx()), r); // deterministic
    const tight = evaluateLoadouts(cands, ctx({ budget: 50 })); assert.ok(tight.ok); if (tight.ok) for (const x of tight.results) assert.ok(x.totalCost! <= 50);
    const noPrice = evaluateLoadouts(cands, ctx({ leadPrice: undefined, leadStock: 10 })); assert.ok(noPrice.ok);
    if (noPrice.ok) for (const x of noPrice.results) assert.ok(x.ammo === 'none' || x.leadShortfall === 0);
    assert.ok(!evaluateLoadouts(cands, ctx({ maxCombos: 3 })).ok);
  });
  it('cost-efficiency objective ranks by cost per 1000', () => {
    const r = evaluateLoadouts(cands, ctx({ objective: 'minCostPer1000', topK: 5 })); assert.ok(r.ok); if (!r.ok) return;
    for (let i = 1; i < r.results.length; i++) assert.ok(r.results[i - 1]!.costPer1000! <= r.results[i]!.costPer1000! + 1e-9);
  });
  it('durability', () => {
    const r = evaluateLoadouts({ weapons: [cands.weapons[1]!] }, ctx({ hits: 250, ammoOptions: ['light'] })); assert.ok(r.ok); if (!r.ok) return;
    const x = r.results[0]!; assert.deepEqual(x.breaksDuringHorizon, ['weapon']); approx(x.replacementCost!, 20);
    const boots = evaluateLoadouts({ weapons: [cands.weapons[0]!], boots: cands.boots }, ctx({ ammoOptions: ['none'], levels: lv({}) })); assert.ok(boots.ok); if (!boots.ok) return;
    const w = boots.results.find((y) => y.ids.boots === 'bootsA')!; approx(w.wear.find((z) => z.slot === 'boots')!.wearPerHit, 0.8);
    const noAmmo = evaluateLoadouts({ weapons: [cands.weapons[1]!] }, ctx({ ammoOptions: ['none'] })); assert.ok(noAmmo.ok); if (noAmmo.ok) assert.equal(noAmmo.results[0]!.wear[0]!.wearPerHit, 0);
  });
  it('food plan', () => {
    const hm = computeHit({ levels: lv({}), gear: emptyGear, ammo: 'none', booster: 'none', rankBonusPct: 0 });
    const f = foodPlan(hm, 20, 100, 100, 5, 'bread', 2); assert.equal(f.meals, 10); assert.equal(f.feasible, false); assert.equal(f.cost, 20);
    const s = foodPlan(hm, 20, 100, 100, 5, 'cookedFish'); assert.equal(s.meals, 5); assert.equal(s.feasible, true); assert.equal(s.cost, null);
  });
});
void resolveConstraints;
