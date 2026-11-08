import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  optimizeWarBuild, optimizeSustainableWarBuild, sustainableCombat, mealPlan, SKILLS, COST_BY_LEVEL, emptyLevels, cumulativeCost, listFormulas, DEFAULT_MIN_DAMAGE_SHARE,
  type GearInput, type Levels, type SkillId, type WarBuildRequest, type WarObjective, type WarCandidates, type WarContext, type Constraint,
} from '@/features/build-optimizer/engine';
import { offersToCandidates, type OfferLike } from '@/features/build-optimizer';

const approx = (a: number, b: number, e = 1e-6) => assert.ok(Math.abs(a - b) < e, `${a} !~ ${b}`);
const lv = (o: Partial<Levels>): Levels => ({ ...emptyLevels(), ...o });
const EMPTY: GearInput = { weapon: { kind: 'empty' }, helmet: { kind: 'empty' }, gloves: { kind: 'empty' }, chest: { kind: 'empty' }, legs: { kind: 'empty' }, boots: { kind: 'empty' } };
const FOOD = [{ type: 'bread' as const, price: 1 }, { type: 'steak' as const, price: 2 }, { type: 'cookedFish' as const, price: 3 }];
const cap = (id: string, skill: SkillId, level: number): Constraint => ({ id, strength: 'mandatory', spec: { type: 'maxLevel', skill, level } });
const exact = (levels: Partial<Levels>): Constraint[] => (['health', 'hunger', 'attack', 'critChance', 'critDamage', 'armor', 'accuracy', 'dodge', 'lootChance'] as const).map((s) => ({ id: 'x' + s, strength: 'mandatory' as const, spec: { type: 'exactLevel' as const, skill: s, level: levels[s] ?? 0 } }));
const war = (o: Partial<WarBuildRequest> = {}): WarBuildRequest => ({ player: { level: 40, totalPoints: 120 }, hits: 20, rankBonusPct: 0, objective: { type: 'maxDamage' }, gear: { mode: 'optimize', candidates: {} }, food: { options: FOOD }, ...o });
const weapons: WarCandidates['weapons'] = [
  { id: 'knife', stats: { attack: 30, critChance: 4, usesAmmo: false }, durability: 1000 },
  { id: 'pistol', stats: { attack: 55, critChance: 7, usesAmmo: true }, durability: 1000, price: 40 },
  { id: 'rifle', stats: { attack: 90, critChance: 12, usesAmmo: true }, durability: 1000, price: 300 },
];
const cands: WarCandidates = { weapons, chests: [{ id: 'ch', stats: { armor: 12 }, durability: 1000, price: 50 }], boots: [{ id: 'bt', stats: { dodge: 10 }, durability: 1000, price: 30 }] };

describe('wiki cross-check (typed from 01-basics §2.4)', () => {
  it('skill endpoints, unlock levels and costs match the wiki table', () => {
    const wiki: Record<string, [number, number, number]> = { energy: [30, 150, 1], health: [100, 220, 4], hunger: [5, 15, 8], attack: [100, 400, 1], companySlots: [2, 12, 4], business: [30, 130, 1], production: [10, 50, 1], critChance: [10, 50, 4], critDamage: [100, 350, 8], armor: [0, 50, 6], accuracy: [50, 110, 1], dodge: [0, 30, 12], lootChance: [5, 35, 1], leadership: [4, 34, 9] };
    for (const [k, [a, b, u]] of Object.entries(wiki)) { const d = (SKILLS as Record<string, { level0: number; level10: number; unlockLevel: number }>)[k]!; assert.deepEqual([d.level0, d.level10, d.unlockLevel], [a, b, u], k); }
    assert.deepEqual([...COST_BY_LEVEL], [1, 1, 2, 3, 4, 5, 6, 8, 9, 10]); assert.equal(cumulativeCost(10), 49);
  });
  it('the audit document mentions every registered formula', () => {
    const doc = readFileSync('docs/build-optimizer-audit.md', 'utf8');
    for (const f of listFormulas()) assert.ok(doc.includes('`' + f.id + '`'), `audit table is missing ${f.id}`);
    assert.ok(!/\|\s*Verified\s*\|/.test(doc.replace(/\*\*Verified\*\*/g, '')), 'nothing may be labelled Verified without observations');
    for (const f of listFormulas()) assert.notEqual(f.status, 'verified', f.id);
  });
});

describe('objective semantics', () => {
  const run = (objective: WarObjective, extra: Partial<WarBuildRequest> = {}) => optimizeWarBuild(war({ gear: { mode: 'optimize', candidates: cands }, ammoOptions: ['none', 'light', 'heavy'], prices: { leadPerUnit: 1 }, objective, ...extra }));
  it('objective semantics: bestValue share is configurable, validated, and honoured', () => {
    assert.equal(DEFAULT_MIN_DAMAGE_SHARE, 0.8);
    const max = run({ type: 'maxDamage', budget: 1e9 }); assert.ok(max.ok); if (!max.ok) return; const D = max.builds[0]!.expectedDamage;
    const lo = run({ type: 'bestValue', minDamageShare: 0.3 }), hi = run({ type: 'bestValue', minDamageShare: 0.95 }), one = run({ type: 'bestValue', minDamageShare: 1 }); assert.ok(lo.ok && hi.ok && one.ok); if (!lo.ok || !hi.ok || !one.ok) return;
    assert.ok(hi.builds[0]!.expectedDamage >= 0.95 * D - 1e-6); assert.ok(lo.builds[0]!.expectedDamage >= 0.3 * D - 1e-6);
    assert.ok(lo.builds[0]!.cost.total <= hi.builds[0]!.cost.total + 1e-9); assert.ok(hi.builds[0]!.cost.total <= one.builds[0]!.cost.total + 1e-9);
    approx(one.builds[0]!.expectedDamage, D); // share 1 = maximum damage, then cheapest
    for (const bad of [0, -0.1, 1.5]) { const r = run({ type: 'bestValue', minDamageShare: bad }); assert.ok(!r.ok && r.reason === 'missing-input'); }
    const alt = run({ type: 'maxDamage', budget: 1e9 }, { alternativeMinDamageShare: 0.5 }); assert.ok(alt.ok);
    assert.ok(!run({ type: 'maxDamage' }, { alternativeMinDamageShare: 2 }).ok);
  });
  it('maxNet: revenue = goldPerDamage * damage (or the capped bounty) + crateValue * crates; no revenue -> refused', () => {
    assert.ok(!run({ type: 'maxNet' }).ok);
    const w = (b: WarContext['bounty']): WarContext => ({ warId: 'w', side: 'attacker', modifiers: [], bounty: b });
    assert.ok(!run({ type: 'maxNet' }, { war: w({ ratePer1000: 2, remainingBudget: 1e9, eligible: false }) }).ok); // ineligible bounty is no income
    const lin = run({ type: 'maxNet', goldPerDamage: 0.01 }); assert.ok(lin.ok); if (!lin.ok) return;
    const b = lin.builds[0]!; approx(b.net!, 0.01 * b.expectedDamage - b.cost.total);
    const capped = run({ type: 'maxNet' }, { war: w({ ratePer1000: 2, remainingBudget: 5, eligible: true }) }); assert.ok(capped.ok); if (!capped.ok) return;
    const c = capped.builds[0]!; approx(c.net!, Math.min((c.expectedDamage / 1000) * 2, 5) - c.cost.total);
    assert.ok(capped.assumptions.some((a) => a.includes('loot is NOT valued')));
    const crates = run({ type: 'maxNet', goldPerDamage: 0.0001, crateValue: 1000 }); assert.ok(crates.ok); if (crates.ok) { assert.ok(crates.builds[0]!.levels.lootChance > 0); approx(crates.builds[0]!.net!, 0.0001 * crates.builds[0]!.expectedDamage + 1000 * crates.builds[0]!.loot.expectedCrates - crates.builds[0]!.cost.total); }
  });
  it('unknown prices never become silent zero-cost recommendations', () => {
    const strict = optimizeWarBuild(war({ gear: { mode: 'optimize', candidates: cands }, ammoOptions: ['light'], objective: { type: 'bestValue' }, food: undefined }));
    assert.ok(!strict.ok && strict.reason === 'missing-input' && strict.message.includes('prices.leadPerUnit') && strict.message.includes('food price'));
    const budgeted = optimizeWarBuild(war({ ammoOptions: ['light'], objective: { type: 'maxDamage', budget: 100 }, food: undefined })); assert.ok(!budgeted.ok && budgeted.reason === 'missing-input');
    const lb = optimizeWarBuild(war({ gear: { mode: 'optimize', candidates: cands }, ammoOptions: ['light'], objective: { type: 'maxDamage' }, food: undefined })); // plain maxDamage defaults to lower-bound
    assert.ok(lb.ok); if (!lb.ok) return; assert.equal(lb.builds[0]!.costIsLowerBound, true); assert.equal(lb.builds[0]!.cost.complete, false); assert.ok(lb.assumptions.some((a) => a.includes('lower bounds')));
    const net = optimizeWarBuild(war({ gear: { mode: 'optimize', candidates: cands }, ammoOptions: ['light'], objective: { type: 'maxNet', goldPerDamage: 0.01 }, food: undefined, costPolicy: 'lower-bound' }));
    assert.ok(net.ok); if (net.ok) { assert.equal(net.builds[0]!.netIsUpperBound, true); assert.equal(net.builds[0]!.costIsLowerBound, true); }
    const ok = run({ type: 'bestValue' }); assert.ok(ok.ok); if (ok.ok) { assert.equal(ok.builds[0]!.costIsLowerBound, false); assert.equal(ok.builds[0]!.netIsUpperBound, false); }
  });
  it('incomplete market data is reported, not papered over', () => {
    const r = optimizeWarBuild(war({ gear: { mode: 'optimize', candidates: { weapons } }, ammoOptions: ['none'] })); assert.ok(r.ok); if (!r.ok) return;
    for (const s of ['helmet', 'gloves', 'chest', 'legs', 'boots']) assert.ok(r.assumptions.some((a) => a.includes(`No candidate was supplied for the ${s} slot`)), s);
    const offers = JSON.parse(readFileSync('tests/fixtures/real/equipment-offers.json', 'utf8')).offers as OfferLike[];
    const broken = offersToCandidates([...offers.slice(0, 3), { ...offers[3]!, offerId: 'nodur', durability: null }, { ...offers[4]!, offerId: 'nostats', stats: {} }]);
    assert.ok(broken.skipped.some((x) => x.offerId === 'nodur') && broken.skipped.some((x) => x.offerId === 'nostats'));
  });
});

describe('Pill on/off', () => {
  it('toggling the Pill changes neither allocation, equipment nor build costs', () => {
    const args: Partial<WarBuildRequest> = { gear: { mode: 'optimize', candidates: cands }, ammoOptions: ['none', 'light'], prices: { leadPerUnit: 1 } };
    const off = optimizeWarBuild(war({ ...args, pill: { include: false } })), on = optimizeWarBuild(war({ ...args, pill: { include: true, state: { kind: 'none' }, schedule: [{ startMinutes: 0, durationMinutes: 20, hits: 20 }], cost: { mode: 'buy', marketPrice: 50 } } }));
    assert.ok(off.ok && on.ok); if (!off.ok || !on.ok) return;
    assert.deepEqual(on.builds.map((b) => [b.levels, b.gear, b.ammo, b.cost, b.expectedDamage]), off.builds.map((b) => [b.levels, b.gear, b.ammo, b.cost, b.expectedDamage]));
    assert.equal(off.pill, null); assert.ok(on.pill!.every((p) => p.ok && p.evidence === 'estimated')); // weakest link: interpolated skill values and the sustain mapping
  });
});

describe('sustainable combat', () => {
  const lvls = lv({ health: 5, hunger: 3 }); // 160 health, 8 hunger
  const base = { levels: lvls, gear: EMPTY, ammo: 'none' as const, rankBonusPct: 0 };
  it('sustainable session: health and hunger limit', () => {
    const r = sustainableCombat(base);
    assert.equal(r.lossPerHit, 10); assert.equal(r.sustainableHits, 47); assert.equal(r.limitingFactor, 'health-and-hunger'); // (160 + 8*40 - 10) / 10
    assert.equal(r.mealsTotal, 8); assert.equal(r.hungerLeft, 0); assert.equal(r.meals[0]!.type, 'cookedFish'); assert.equal(r.evidence, 'estimated'); // weakest link: interpolated skill values / sustain mapping
    assert.ok(r.assumptions.some((a) => a.includes('Starting health assumed full')) && r.assumptions.some((a) => a.includes('Food stock unknown')));
    approx(r.expectedDamage, 47 * r.hit.expected);
    const half = sustainableCombat({ ...base, start: { healthFraction: 0.5, hunger: 4 } }); assert.equal(half.sustainableHits, Math.floor((80 + 4 * 40 - 10) / 10));
  });
  it('limits: food stock, ammo stock, durability, purchasable replacements', () => {
    const stock = sustainableCombat({ ...base, food: [{ type: 'cookedFish', stock: 2, price: 3 }, { type: 'steak', stock: 0 }, { type: 'bread', stock: 0 }] });
    assert.equal(stock.sustainableHits, Math.floor((160 + 80 - 10) / 10)); assert.equal(stock.limitingFactor, 'food-stock'); assert.equal(stock.mealsTotal, 2); approx(stock.cost.food, 6);
    const none = sustainableCombat({ ...base, food: [{ type: 'bread', stock: 0 }] }); assert.equal(none.sustainableHits, 15); assert.equal(none.limitingFactor, 'food-stock');
    const pistol: GearInput = { ...EMPTY, weapon: { kind: 'item', stats: { attack: 55, critChance: 7, usesAmmo: true } } };
    const ammo = sustainableCombat({ ...base, gear: pistol, ammo: 'medium', ammoStock: 30 }); assert.equal(ammo.sustainableHits, 10); assert.equal(ammo.limitingFactor, 'ammo-stock'); // 3 lead per round
    const buy = sustainableCombat({ ...base, gear: pistol, ammo: 'medium', ammoStock: 30, buyAmmo: true, leadPerUnit: 2 }); assert.equal(buy.sustainableHits, 47); approx(buy.cost.ammo, (47 * 3 - 30) * 2);
    const dur = sustainableCombat({ ...base, gear: pistol, ammo: 'light', durabilities: { weapon: 30 } }); assert.equal(dur.sustainableHits, 30); assert.equal(dur.limitingFactor, 'durability:weapon');
    const repl = sustainableCombat({ ...base, gear: pistol, ammo: 'light', durabilities: { weapon: 30 }, buyReplacements: true, replacementPrices: { weapon: 40 } }); assert.equal(repl.sustainableHits, 47); approx(repl.cost.replacement, 40); // ceil(47/30)-1 = 1
    const unk = sustainableCombat({ ...base, gear: pistol, ammo: 'light', durabilities: { weapon: 30 }, buyReplacements: true }); assert.equal(unk.costIsLowerBound, true); assert.ok(unk.cost.missing.some((m) => m.includes('replacement')));
    const dodge = sustainableCombat({ ...base, levels: lv({ health: 5, hunger: 3, dodge: 10 }), gear: { ...EMPTY, chest: { kind: 'item', stats: { armor: 5 } } }, durabilities: { chest: 20 } }); // armor wears (1-dodge) per hit
    assert.equal(dodge.limits.durability.chest, Math.floor(20 / (1 - dodge.hit.dodgeProbability) + 1e-9));
    const miss = sustainableCombat({ ...base, food: [{ type: 'bread' }] }); assert.equal(miss.costIsLowerBound, true); assert.ok(miss.cost.missing.includes('food price (bread)'));
  });
  it('is consistent with the fixed-hit survival rule (same capacity boundary)', () => {
    const s = sustainableCombat(base); const pin = exact({ health: 5, hunger: 3 });
    const at = optimizeWarBuild(war({ hits: s.sustainableHits, constraints: pin, gear: { mode: 'fixed', gear: EMPTY } })); assert.ok(at.ok); if (at.ok) assert.ok(at.builds[0]!.survival.meals <= 8);
    const over = optimizeWarBuild(war({ hits: s.sustainableHits + 1, constraints: pin, gear: { mode: 'fixed', gear: EMPTY } })); assert.ok(!over.ok && over.reason === 'infeasible');
  });
  it('meal plan is strongest-first and respects hunger and stock', () => {
    const p = mealPlan(100, 100, 5, [{ type: 'bread' }, { type: 'cookedFish', stock: 2 }, { type: 'steak' }]);
    assert.deepEqual(p.plan, [{ type: 'cookedFish', meals: 2 }, { type: 'steak', meals: 3 }]); assert.equal(p.covered, true);
    assert.equal(mealPlan(1000, 100, 2, [{ type: 'bread' }]).covered, false);
  });
  it('sustainable search matches brute force and keeps mandatory constraints', () => {
    const caps = (['health', 'hunger', 'attack', 'critChance', 'critDamage', 'armor', 'accuracy', 'dodge', 'lootChance'] as const).map((s) => cap('c' + s, s, 2));
    const gear: GearInput = { ...EMPTY, weapon: { kind: 'item', stats: { attack: 55, critChance: 7, usesAmmo: true } } };
    const points = 20, food = FOOD.map((f) => ({ ...f }));
    const r = optimizeSustainableWarBuild({ player: { level: 40, totalPoints: points }, constraints: caps, gear: { mode: 'fixed', gear }, ammoOptions: ['none', 'light'], food, objective: { type: 'maxSessionDamage' } });
    assert.ok(r.ok); if (!r.ok) return;
    let best = -1;
    for (let a = 0; a <= 2; a++) for (let b = 0; b <= 2; b++) for (let c = 0; c <= 2; c++) for (let d = 0; d <= 2; d++) for (let e = 0; e <= 2; e++) for (let f = 0; f <= 2; f++) for (let g = 0; g <= 2; g++) for (let h = 0; h <= 2; h++) for (let i = 0; i <= 2; i++) {
      if ([a, b, c, d, e, f, g, h, i].reduce((n, l) => n + cumulativeCost(l), 0) > points) continue;
      for (const ammo of ['none', 'light'] as const) best = Math.max(best, sustainableCombat({ levels: lv({ health: a, hunger: b, attack: c, critChance: d, critDamage: e, armor: f, accuracy: g, dodge: h, lootChance: i }), gear, ammo, food }).expectedDamage);
    }
    approx(r.builds[0]!.session.expectedDamage, best, 1e-6); assert.ok(r.builds[0]!.session.sustainableHits > 0);
    // with real constraints
    const keep: Constraint[] = [{ id: 'slots', strength: 'mandatory', spec: { type: 'minStat', skill: 'companySlots', value: 4 } }, ...caps];
    const k = optimizeSustainableWarBuild({ player: { level: 40, totalPoints: points }, constraints: keep, gear: { mode: 'fixed', gear }, food, objective: { type: 'maxSessionDamage' } });
    assert.ok(k.ok); if (k.ok) { assert.ok(k.builds[0]!.levels.companySlots >= 2); assert.ok(k.builds[0]!.mandatoryPreserved.includes('slots')); }
  });
  it('sustainable search over supplied equipment: budget, no invented items, size cap, fixed-gear requirements', () => {
    const free = optimizeSustainableWarBuild({ player: { level: 40, totalPoints: 120 }, gear: { mode: 'optimize', candidates: cands }, ammoOptions: ['none', 'light'], leadPerUnit: 1, buyAmmo: true, food: FOOD, objective: { type: 'maxSessionDamage' } });
    assert.ok(free.ok); if (!free.ok) return;
    const ids = new Set(['knife', 'pistol', 'rifle', 'ch', 'bt', null]); for (const b of free.builds) for (const v of Object.values(b.gearIds)) assert.ok(ids.has(v as never));
    const poor = optimizeSustainableWarBuild({ player: { level: 40, totalPoints: 120 }, gear: { mode: 'optimize', candidates: cands }, ammoOptions: ['none', 'light'], leadPerUnit: 1, buyAmmo: true, food: FOOD, objective: { type: 'maxSessionDamage', budget: 60 } });
    assert.ok(poor.ok); if (poor.ok) { assert.ok(poor.builds[0]!.totalCost <= 60); assert.ok(poor.builds[0]!.session.expectedDamage <= free.builds[0]!.session.expectedDamage + 1e-9); }
    const many = Array.from({ length: 8 }, (_, i) => ({ id: 'w' + i, stats: { attack: 40 + i, critChance: 5, usesAmmo: false }, durability: 100, price: 10 }));
    const big = optimizeSustainableWarBuild({ player: { level: 40, totalPoints: 60 }, gear: { mode: 'optimize', candidates: { weapons: many, helmets: many.map((_, i) => ({ id: 'h' + i, stats: { critDamage: i }, durability: 100, price: 5 })), gloves: many.map((_, i) => ({ id: 'g' + i, stats: { accuracy: i }, durability: 100, price: 5 })) } }, objective: { type: 'maxSessionDamage' } });
    assert.ok(!big.ok && big.reason === 'too-large');
    const missing = optimizeSustainableWarBuild({ player: { level: 40, totalPoints: 60 }, gear: { mode: 'fixed', gear: { weapon: { kind: 'empty' } } }, objective: { type: 'maxSessionDamage' } }); assert.ok(!missing.ok && missing.reason === 'missing-input');
    const lowLevel = optimizeSustainableWarBuild({ player: { level: 5, totalPoints: 16 }, gear: { mode: 'fixed', gear: EMPTY }, objective: { type: 'maxSessionDamage' } }); assert.ok(lowLevel.ok);
    if (lowLevel.ok) for (const k of ['armor', 'hunger', 'dodge', 'critDamage'] as const) assert.equal(lowLevel.builds[0]!.levels[k], 0, k);
  });
});

describe('edge cases and performance', () => {
  it('extremely long fights are infeasible, not fabricated', () => {
    const r = optimizeWarBuild(war({ hits: 1_000_000, gear: { mode: 'fixed', gear: EMPTY } })); assert.ok(!r.ok && r.reason === 'infeasible');
    assert.ok(!optimizeWarBuild(war({ hits: 0 })).ok); assert.ok(!optimizeWarBuild(war({ hits: Number.NaN })).ok);
    const s = sustainableCombat({ levels: lv({ health: 10, hunger: 10, armor: 10, dodge: 10 }), gear: EMPTY, ammo: 'none', rankBonusPct: 0 }); assert.ok(Number.isFinite(s.sustainableHits) && s.sustainableHits > 100);
  });
  it('conflicting or locked constraints are explained', () => {
    const r = optimizeWarBuild(war({ player: { level: 5, totalPoints: 40 }, constraints: [{ id: 'dodge', strength: 'mandatory', spec: { type: 'minLevel', skill: 'dodge', level: 2 } }] }));
    assert.ok(!r.ok && r.reason === 'conflict' && r.conflicts[0]!.code === 'SKILL_LOCKED');
  });
  it('performance: real offers (hundreds of equipment configurations) stay interactive', () => {
    const offers = JSON.parse(readFileSync('tests/fixtures/real/equipment-offers.json', 'utf8')).offers as OfferLike[];
    const { candidates } = offersToCandidates(offers, { maxPerSlot: 4 });
    const t = Date.now();
    const r = optimizeWarBuild({ player: { level: 40, totalPoints: 156 }, hits: 40, rankBonusPct: 5, gear: { mode: 'optimize', candidates: candidates as WarCandidates }, ammoOptions: ['none', 'light', 'medium'], prices: { leadPerUnit: 0.54 }, food: { options: FOOD }, objective: { type: 'bestValue' } });
    assert.ok(r.ok); assert.ok(Date.now() - t < 15000, `took ${Date.now() - t} ms`);
    const t2 = Date.now();
    const s = optimizeSustainableWarBuild({ player: { level: 40, totalPoints: 156 }, gear: { mode: 'optimize', candidates: { weapons: candidates.weapons, chests: candidates.chests!.slice(0, 2) }, maxConfigs: 100 }, ammoOptions: ['none', 'light'], leadPerUnit: 0.54, buyAmmo: true, food: FOOD, objective: { type: 'maxSessionDamage' } });
    assert.ok(s.ok, JSON.stringify(s)); assert.ok(Date.now() - t2 < 30000, `took ${Date.now() - t2} ms`);
  });
});
