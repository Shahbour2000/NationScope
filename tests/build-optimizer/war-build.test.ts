import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  optimizeWarBuild, optimizeBuild, computeHit, emptyLevels, cumulativeCost, foodPlan, FOOD_PCT, AMMO, SKILL_IDS, WAR_SKILLS, ECON_SKILLS, RARITY_RANGES, rarityStats,
  validateItemStats, normaliseRarity, RECIPES, type WarBuildRequest, type GearInput, type GearSlot, type Levels, type SkillId, type WarCandidates, type Constraint,
} from '@/features/build-optimizer/engine';
import type { OfferLike } from '@/features/build-optimizer';

const approx = (a: number, b: number, e = 1e-6) => assert.ok(Math.abs(a - b) < e, `${a} !~ ${b}`);
const lv = (o: Partial<Levels>): Levels => ({ ...emptyLevels(), ...o });
const EMPTY: GearInput = { weapon: { kind: 'empty' }, helmet: { kind: 'empty' }, gloves: { kind: 'empty' }, chest: { kind: 'empty' }, legs: { kind: 'empty' }, boots: { kind: 'empty' } };
const base = (o: Partial<WarBuildRequest> = {}): WarBuildRequest => ({
  player: { level: 40, totalPoints: 120 }, hits: 20, rankBonusPct: 0, objective: { type: 'maxDamage' },
  gear: { mode: 'optimize', candidates: {}, allowEmpty: true }, food: { options: [{ type: 'bread', price: 1 }, { type: 'steak', price: 2 }, { type: 'cookedFish', price: 3 }] }, ...o });
const cap = (id: string, skill: SkillId, level: number): Constraint => ({ id, strength: 'mandatory', spec: { type: 'maxLevel', skill, level } });

describe('skill groups', () => {
  it('war (9) and economic (5) skills partition all 14 skills', () => {
    assert.equal(WAR_SKILLS.length, 9); assert.equal(ECON_SKILLS.length, 5);
    assert.deepEqual([...WAR_SKILLS, ...ECON_SKILLS].sort(), [...SKILL_IDS].sort());
    assert.deepEqual([...WAR_SKILLS].sort(), ['accuracy', 'armor', 'attack', 'critChance', 'critDamage', 'dodge', 'health', 'hunger', 'lootChance']);
  });
});

describe('rarity ranges', () => {
  it('rarity ranges', () => {
    assert.deepEqual(RARITY_RANGES.common.weaponAttack, [20, 35]); assert.deepEqual(RARITY_RANGES.mythic.weaponAttack, [230, 320]); assert.deepEqual(RARITY_RANGES.mythic.armor, [50, 67]);
    assert.deepEqual(RARITY_RANGES.epic.helmetCritDamage, [48, 72]); assert.deepEqual(RARITY_RANGES.legendary.weaponCrit, [24, 32]);
    assert.equal(normaliseRarity('Mythical'), 'mythic'); assert.equal(normaliseRarity('nope'), null);
    assert.deepEqual(rarityStats('weapon', 'rare', 'mid'), { attack: 87.5, critChance: 13 }); assert.deepEqual(rarityStats('boots', 'uncommon', 'low'), { dodge: 6 });
    assert.deepEqual(validateItemStats('chest', 'common', { armor: 7 }), ['chest common armor=7 outside 1-6']);
  });
  it('every real API offer lies inside the documented range for its rarity', () => {
    const offers = JSON.parse(readFileSync('tests/fixtures/real/equipment-offers.json', 'utf8')).offers as (OfferLike & { rarity: string })[];
    const slotMap: Record<string, GearSlot> = { weapon: 'weapon', helmet: 'helmet', gloves: 'gloves', chest: 'chest', pants: 'legs', boots: 'boots' };
    const keyMap: Record<string, string> = { attack: 'attack', criticalChance: 'critChance', criticalDamages: 'critDamage', precision: 'accuracy', armor: 'armor', dodge: 'dodge' };
    let n = 0; const bad: string[] = [];
    for (const o of offers) {
      const r = normaliseRarity(o.rarity); if (!r || !slotMap[o.slot!]) continue;
      const st = Object.fromEntries(Object.entries(o.stats ?? {}).map(([k, v]) => [keyMap[k] ?? k, v]));
      bad.push(...validateItemStats(slotMap[o.slot!]!, r, st)); n++;
    }
    assert.ok(n > 5); assert.deepEqual(bad, []);
  });
});

describe('war build', () => {
  const weapons: WarCandidates['weapons'] = [
    { id: 'knife', stats: { attack: 30, critChance: 4, usesAmmo: false }, durability: 1000 },
    { id: 'pistol', stats: { attack: 55, critChance: 7, usesAmmo: true }, durability: 1000, price: 40 },
    { id: 'rifle', stats: { attack: 90, critChance: 12, usesAmmo: true }, durability: 1000, price: 300 },
  ];
  const cands: WarCandidates = {
    weapons, gloves: [{ id: 'gl', stats: { accuracy: 10 }, durability: 1000, price: 25 }], chests: [{ id: 'ch', stats: { armor: 12 }, durability: 1000, price: 50 }],
    boots: [{ id: 'bt', stats: { dodge: 10 }, durability: 1000, price: 30 }], helmets: [{ id: 'hm', stats: { critDamage: 20 }, durability: 1000, price: 60 }],
  };
  it('war build matches brute force', () => {
    // small exhaustive check: every skill capped at level 2, tiny candidate set, 3 meals-capable food, objective maxDamage within a budget
    const c: WarCandidates = { weapons: [weapons![1]!], gloves: cands.gloves, chests: cands.chests, boots: cands.boots };
    const caps = WAR_SKILLS.map((s) => cap('cap' + s, s, 2));
    const N = 15, budget = 400, points = 20;
    const req = base({ player: { level: 40, totalPoints: points }, hits: N, constraints: caps, ammoOptions: ['none', 'light'], prices: { leadPerUnit: 0.5 }, food: { options: [{ type: 'bread', price: 2 }, { type: 'steak', price: 3 }, { type: 'cookedFish', price: 5 }] },
      gear: { mode: 'optimize', candidates: c, allowEmpty: true }, objective: { type: 'maxDamage', budget } });
    const r = optimizeWarBuild(req); assert.ok(r.ok); if (!r.ok) return;
    // brute force through the public single-hit model
    const opts = <T,>(x: T[] | undefined) => [...(x ?? []), null];
    let best = { dmg: -1, cost: Infinity };
    const foodList: [keyof typeof FOOD_PCT, number][] = [['bread', 2], ['steak', 3], ['cookedFish', 5]];
    const W = [weapons![1]!, null], G = opts(c.gloves), C = opts(c.chests), Bt = opts(c.boots);
    for (const w of W) for (const g of G) for (const ch of C) for (const bt of Bt) for (const ammo of ['none', 'light'] as const)
      for (let hl = 0; hl <= 2; hl++) for (let hu = 0; hu <= 2; hu++) for (let at = 0; at <= 2; at++) for (let cc = 0; cc <= 2; cc++) for (let cd = 0; cd <= 2; cd++)
      for (let ar = 0; ar <= 2; ar++) for (let ac = 0; ac <= 2; ac++) for (let dg = 0; dg <= 2; dg++) for (let lt = 0; lt <= 2; lt++) {
        const pts = [hl, hu, at, cc, cd, ar, ac, dg, lt].reduce((n, l) => n + cumulativeCost(l), 0); if (pts > points) continue;
        const levels = lv({ health: hl, hunger: hu, attack: at, critChance: cc, critDamage: cd, armor: ar, accuracy: ac, dodge: dg, lootChance: lt });
        const gear: GearInput = { weapon: w ? { kind: 'item', stats: w.stats } : { kind: 'empty' }, helmet: { kind: 'empty' }, legs: { kind: 'empty' },
          gloves: g ? { kind: 'item', stats: g.stats } : { kind: 'empty' }, chest: ch ? { kind: 'item', stats: ch.stats } : { kind: 'empty' }, boots: bt ? { kind: 'item', stats: bt.stats } : { kind: 'empty' } };
        const hit = computeHit({ levels, gear, ammo, booster: 'none', rankBonusPct: 0 });
        const H = 100 + 120 * hl / 10 * 1; const maxH = [100, 112, 124][hl]!; void H;
        const hungerMax = [5, 6, 7][hu]!;
        let food: { meals: number; cost: number } | null = null;
        for (const [t, price] of foodList) {
          const fp = foodPlan(hit, N, maxH, maxH, hungerMax, t, price, 10);
          if (fp.feasible && (!food || fp.cost! < food.cost - 1e-12 || (Math.abs(fp.cost! - food.cost) < 1e-12 && fp.meals < food.meals))) food = { meals: fp.meals, cost: fp.cost! };
        }
        if (!food) continue;
        const cost = (w?.price ?? 0) + (g?.price ?? 0) + (ch?.price ?? 0) + (bt?.price ?? 0) + (ammo === 'none' ? 0 : N * AMMO.light.lead * 0.5) + food.cost;
        if (cost > budget) continue;
        const dmg = N * hit.expected;
        if (dmg > best.dmg + 1e-9 || (Math.abs(dmg - best.dmg) <= 1e-9 && cost < best.cost - 1e-9)) best = { dmg, cost };
      }
    const got = r.builds[0]!;
    approx(got.expectedDamage, best.dmg, 1e-6); approx(got.cost.total, best.cost, 1e-6); assert.ok(best.dmg > 0);
  });

  it('considers all nine war skills; locked skills stay locked', () => {
    // long fight with plenty of points: survivability skills must receive points; valuable crates must pull in loot chance
    const r = optimizeWarBuild(base({ hits: 60, player: { level: 40, totalPoints: 150 }, gear: { mode: 'fixed', gear: EMPTY }, objective: { type: 'maxNet', goldPerDamage: 0.001, crateValue: 500 }, food: { options: [{ type: 'bread', price: 1 }, { type: 'cookedFish', price: 3 }] } }));
    assert.ok(r.ok); if (!r.ok) return; const L = r.builds[0]!.levels;
    assert.ok(L.lootChance > 0, 'loot chance valued'); assert.ok(L.health + L.hunger + L.armor + L.dodge > 0, 'survival skills used'); assert.ok(L.attack > 0);
    assert.ok(r.builds[0]!.survival.feasible && r.builds[0]!.survival.meals <= r.builds[0]!.survival.hungerAvailable);
    // low-level player: skills that are not unlocked remain 0 (armor L6, hunger L8, dodge L12, crit damage L8, health L4)
    const low = optimizeWarBuild(base({ player: { level: 5, totalPoints: 16 }, hits: 5, gear: { mode: 'fixed', gear: EMPTY } })); assert.ok(low.ok); if (!low.ok) return;
    for (const k of ['armor', 'hunger', 'dodge', 'critDamage'] as const) assert.equal(low.builds[0]!.levels[k], 0, k);
    // a pure-damage objective does not blindly max every skill: survival skills are bought only when needed, and spare points go to loot only as a secondary tie-break (damage, then cost, then loot)
    const dmg = optimizeWarBuild(base({ hits: 20, player: { level: 40, totalPoints: 150 }, gear: { mode: 'fixed', gear: EMPTY } })); assert.ok(dmg.ok); if (!dmg.ok) return;
    const noLoot = optimizeWarBuild(base({ hits: 20, player: { level: 40, totalPoints: 150 }, gear: { mode: 'fixed', gear: EMPTY }, constraints: [cap('noloot', 'lootChance', 0)] })); assert.ok(noLoot.ok); if (!noLoot.ok) return;
    approx(dmg.builds[0]!.expectedDamage, noLoot.builds[0]!.expectedDamage); assert.ok(dmg.builds[0]!.levels.lootChance >= noLoot.builds[0]!.levels.lootChance);
    assert.ok(dmg.builds[0]!.levels.armor + dmg.builds[0]!.levels.dodge + dmg.builds[0]!.levels.hunger < 30);
    // too many hits for any allocation -> explicit infeasible, not a made-up build
    const hard = optimizeWarBuild(base({ hits: 100000, gear: { mode: 'fixed', gear: EMPTY } })); assert.ok(!hard.ok && hard.reason === 'infeasible');
  });

  it('fixed gear: equipment is mandatory, skills use its real stats, nothing is bought', () => {
    const gear: GearInput = { ...EMPTY, weapon: { kind: 'item', stats: { attack: 90, critChance: 12, usesAmmo: true } }, gloves: { kind: 'item', stats: { accuracy: 12 } }, boots: { kind: 'item', stats: { dodge: 8 } } };
    const r = optimizeWarBuild(base({ gear: { mode: 'fixed', gear }, ammoOptions: ['light', 'heavy'], prices: { leadPerUnit: 1 } })); assert.ok(r.ok); if (!r.ok) return;
    for (const b of r.builds) {
      assert.equal(b.cost.acquisition, 0); assert.equal(b.cost.replacement, 0);
      assert.deepEqual(b.gear.map((g) => g.id), ['fixed:weapon', null, 'fixed:gloves', null, null, 'fixed:boots']);
      const h = computeHit({ levels: b.levels, gear, ammo: b.ammo, booster: 'none', rankBonusPct: 0 }); approx(b.expectedDamage, 20 * h.expected);
    }
    assert.ok(r.assumptions.some((a) => a.includes('Fixed Gear')));
    const missing = optimizeWarBuild(base({ gear: { mode: 'fixed', gear: { weapon: { kind: 'empty' } } } })); assert.ok(!missing.ok && missing.reason === 'missing-input');
  });

  it('equipment optimization: picks affordable, available gear; budget changes the answer; unavailable gear is never recommended', () => {
    const free = optimizeWarBuild(base({ gear: { mode: 'optimize', candidates: cands }, ammoOptions: ['none', 'light', 'heavy'], prices: { leadPerUnit: 1 }, objective: { type: 'maxDamage' } })); assert.ok(free.ok); if (!free.ok) return;
    const top = free.builds[0]!; assert.equal(top.gear.find((g) => g.slot === 'weapon')!.id, 'rifle'); assert.equal(top.ammo, 'heavy'); assert.equal(top.cost.acquisition >= 300, true);
    const poor = optimizeWarBuild(base({ gear: { mode: 'optimize', candidates: cands }, ammoOptions: ['none', 'light', 'heavy'], prices: { leadPerUnit: 1 }, objective: { type: 'maxDamage', budget: 200 } })); assert.ok(poor.ok); if (!poor.ok) return;
    assert.ok(poor.builds[0]!.cost.total <= 200); assert.ok(poor.builds[0]!.expectedDamage < top.expectedDamage); assert.notEqual(poor.builds[0]!.gear.find((g) => g.slot === 'weapon')!.id, 'rifle');
    const none = optimizeWarBuild(base({ gear: { mode: 'optimize', candidates: cands, allowEmpty: true }, objective: { type: 'maxDamage', budget: 0 } })); assert.ok(none.ok);
    if (none.ok) assert.ok(none.builds[0]!.gear.every((g) => g.id === null || g.owned));
    const ids = new Set(Object.values(cands).flat().map((x) => (x as { id: string }).id)); for (const b of free.builds) for (const g of b.gear) assert.ok(g.id === null || ids.has(g.id));
  });

  it('cost-aware objectives: best value is cheaper than max damage and stays above the damage share', () => {
    const r = optimizeWarBuild(base({ gear: { mode: 'optimize', candidates: cands }, ammoOptions: ['none', 'light', 'heavy'], prices: { leadPerUnit: 1 }, objective: { type: 'bestValue', minDamageShare: 0.8 } })); assert.ok(r.ok); if (!r.ok) return;
    const bv = r.builds[0]!, md = r.builds.find((b) => b.role === 'max-damage' || b.role === 'primary' && b === r.builds[0])!; const max = r.builds.find((b) => b.role === 'max-damage');
    const top = max ?? md; assert.ok(bv.expectedDamage >= 0.8 * top.expectedDamage - 1e-6); assert.ok(bv.cost.total <= top.cost.total + 1e-9);
    assert.ok(r.builds.every((b, i) => r.builds.findIndex((x) => JSON.stringify([x.levels, x.gear, x.ammo]) === JSON.stringify([b.levels, b.gear, b.ammo])) === i)); // distinct builds
    const net = optimizeWarBuild(base({ gear: { mode: 'optimize', candidates: cands }, objective: { type: 'maxNet' } })); assert.ok(!net.ok && net.reason === 'missing-input');
  });

  it('rarity-only items are estimates with a range; real stats win', () => {
    const r = optimizeWarBuild(base({ gear: { mode: 'optimize', candidates: { rarityOnly: [{ id: 'mystery-rifle', slot: 'weapon', rarity: 'rare', price: 100 }] }, estimate: 'mid' }, ammoOptions: ['light'], prices: { leadPerUnit: 0 } })); assert.ok(r.ok); if (!r.ok) return;
    const b = r.builds[0]!; assert.deepEqual(b.estimatedSlots, ['weapon']); assert.ok(b.damageRange && b.damageRange.low < b.expectedDamage && b.expectedDamage < b.damageRange.high);
    assert.ok(r.assumptions.some((a) => a.includes('Rarity-only')));
    const pair = (estimate: 'low' | 'mid' | 'high') => optimizeWarBuild(base({ gear: { mode: 'optimize', estimate, candidates: { weapons: [{ id: 'real', stats: { attack: 76, critChance: 10, usesAmmo: true }, durability: 100, price: 100 }], rarityOnly: [{ id: 'mystery-rifle', slot: 'weapon', rarity: 'rare', price: 100 }] } }, ammoOptions: ['light'], prices: { leadPerUnit: 0 } }));
    const low = pair('low'); assert.ok(low.ok); if (low.ok) { assert.equal(low.builds[0]!.gear[0]!.id, 'real'); assert.equal(low.builds[0]!.estimatedSlots.length, 0); } // conservative default: a rarity guess never beats a real item
    const high = pair('high'); assert.ok(high.ok); if (high.ok) { assert.equal(high.builds[0]!.gear[0]!.id, 'mystery-rifle'); assert.deepEqual(high.builds[0]!.estimatedSlots, ['weapon']); }
    const same = optimizeWarBuild(base({ gear: { mode: 'optimize', estimate: 'high', candidates: { weapons: [{ id: 'dup', stats: { attack: 76, critChance: 10, usesAmmo: true }, durability: 100, price: 100 }], rarityOnly: [{ id: 'dup', slot: 'weapon', rarity: 'rare', price: 100 }] } }, ammoOptions: ['light'], prices: { leadPerUnit: 0 } }));
    assert.ok(same.ok); if (same.ok) { assert.equal(same.builds[0]!.estimatedSlots.length, 0); approx(same.builds[0]!.gear[0]!.stats!.attack as number, 76); } // same item: actual stats win over the rarity estimate
  });

  it('durability: items that break within the horizon add replacement cost; owned items without a price are flagged, not zeroed', () => {
    const c: WarCandidates = { weapons: [{ id: 'old', stats: { attack: 90, critChance: 12, usesAmmo: true }, durability: 8, price: 100 }] };
    const r = optimizeWarBuild(base({ gear: { mode: 'optimize', candidates: c, allowEmpty: false }, ammoOptions: ['light'], prices: { leadPerUnit: 0 }, hits: 20 })); assert.ok(r.ok); if (!r.ok) return;
    approx(r.builds[0]!.cost.replacement, 200); // ceil(20/8)-1 = 2 extra copies
    const owned: WarCandidates = { weapons: [{ id: 'mine', stats: { attack: 90, critChance: 12, usesAmmo: true }, durability: 8 }] };
    const o = optimizeWarBuild(base({ gear: { mode: 'optimize', candidates: owned, allowEmpty: false }, ammoOptions: ['light'], prices: { leadPerUnit: 0 }, hits: 20 })); assert.ok(o.ok); if (!o.ok) return;
    assert.equal(o.builds[0]!.cost.complete, false); assert.ok(o.builds[0]!.cost.missingPrices.some((m) => m.includes('mine')));
  });

  it('Pill is optional and never changes the allocation or equipment', () => {
    const off = optimizeWarBuild(base({ gear: { mode: 'optimize', candidates: cands }, ammoOptions: ['none', 'light'], prices: { leadPerUnit: 1 }, pill: { include: false } }));
    const on = optimizeWarBuild(base({ gear: { mode: 'optimize', candidates: cands }, ammoOptions: ['none', 'light'], prices: { leadPerUnit: 1 },
      pill: { include: true, state: { kind: 'none' }, schedule: [{ startMinutes: 0, durationMinutes: 30, hits: 20 }], cost: { mode: 'buy', marketPrice: 20 } } }));
    const unknown = optimizeWarBuild(base({ gear: { mode: 'optimize', candidates: cands }, ammoOptions: ['none', 'light'], prices: { leadPerUnit: 1 },
      pill: { include: true, state: { kind: 'unknown' }, schedule: [{ startMinutes: 0, durationMinutes: 30, hits: 20 }], cost: { mode: 'owned' } } }));
    assert.ok(off.ok && on.ok && unknown.ok); if (!off.ok || !on.ok || !unknown.ok) return;
    assert.equal(off.pill, null); assert.deepEqual(on.builds.map((b) => [b.levels, b.gear, b.ammo]), off.builds.map((b) => [b.levels, b.gear, b.ammo]));
    assert.ok(on.pill!.every((p) => p.ok)); assert.ok(unknown.pill!.every((p) => !p.ok && p.reason === 'state-unknown'));
  });

  it('constraints are respected in the war build; economic skills are untouched; deterministic', () => {
    const cs: Constraint[] = [{ id: 'keep-slots', strength: 'mandatory', spec: { type: 'minStat', skill: 'companySlots', value: 4 } }, { id: 'prod5', strength: 'mandatory', spec: { type: 'minPoints', skill: 'production', points: 5 } }];
    const run = () => optimizeWarBuild(base({ constraints: cs, gear: { mode: 'optimize', candidates: cands }, ammoOptions: ['light'], prices: { leadPerUnit: 1 } }));
    const r = run(); assert.ok(r.ok); if (!r.ok) return;
    for (const b of r.builds) { assert.ok(b.levels.companySlots >= 2); assert.ok(cumulativeCost(b.levels.production) >= 5); assert.equal(b.levels.energy + b.levels.business + b.levels.leadership, 0); assert.ok(b.mandatoryPreserved.includes('keep-slots')); }
    assert.deepEqual(run(), r);
    const bad = optimizeWarBuild(base({ constraints: [{ id: 'x', strength: 'mandatory', spec: { type: 'minLevel', skill: 'attack', level: 10 } }, { id: 'y', strength: 'mandatory', spec: { type: 'minLevel', skill: 'accuracy', level: 10 } }], player: { level: 40, totalPoints: 60 } }));
    assert.ok(!bad.ok && bad.reason === 'conflict');
    const keep = optimizeWarBuild(base({ player: { level: 40, totalPoints: 120, currentLevels: lv({ attack: 4, energy: 3 }) }, allowReset: false, gear: { mode: 'fixed', gear: EMPTY } })); assert.ok(keep.ok);
    if (keep.ok) { assert.equal(keep.builds[0]!.resetRequired, false); assert.ok(keep.builds[0]!.levels.attack >= 4 && keep.builds[0]!.levels.energy === 3); }
  });

  it('too-large equipment searches are refused explicitly', () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ id: 'w' + i, stats: { attack: 40 + i, critChance: 5, usesAmmo: false }, durability: 100, price: 10 + i }));
    const r = optimizeWarBuild(base({ gear: { mode: 'optimize', candidates: { weapons: many, helmets: many.map((_, i) => ({ id: 'h' + i, stats: { critDamage: i }, durability: 100, price: 5 })), gloves: many.map((_, i) => ({ id: 'g' + i, stats: { accuracy: i }, durability: 100, price: 5 })) }, maxConfigs: 100 } }));
    assert.ok(!r.ok && r.reason === 'too-large');
  });
});

describe('economic build stays separate', () => {
  const econ = { companies: { count: 2, product: RECIPES.steel! }, prices: { steel: { sell: 10 }, iron: { buy: 1 } }, marketTaxPct: 5, job: { wagePerPoint: 0.5 }, incomeTaxPct: 5 };
  it('economy objective changes only economic skills; war skills stay at their mandatory minimums', () => {
    const r = optimizeBuild({ player: { level: 40, totalPoints: 80 }, objective: { type: 'maxEconomy' }, combat: { gear: EMPTY, ammo: 'none', booster: 'none', rankBonusPct: 0 }, economy: econ as never });
    assert.ok(r.ok); if (!r.ok) return;
    for (const b of r.builds) for (const s of WAR_SKILLS) assert.equal(b.levels[s], 0, s);
    assert.ok(r.builds[0]!.levels.production + r.builds[0]!.levels.business + r.builds[0]!.levels.energy > 0);
  });
  it('a war build never spends points on economic skills, so the two builds are independent', () => {
    const w = optimizeWarBuild(base({ gear: { mode: 'fixed', gear: EMPTY } })); assert.ok(w.ok); if (!w.ok) return;
    for (const s of ECON_SKILLS) assert.equal(w.builds[0]!.levels[s], 0, s);
  });
});
