import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import {
  SKILLS, SKILL_IDS, COST_BY_LEVEL, cumulativeCost, isUnlocked, skillValue, pointsEarned, resetCost, RANKS, rankFromDamage, RARITY_RANGES, RARITIES, AMMO, FOOD_PCT,
  FIELD_CRATE_ODDS, FIELD_CRATE_WEAPON_SHARE, PILL, battleModifierPct, diminish, dailyEconomy, RECIPES, emptyLevels, analysePill, computeHit, worksPerDay,
  type GearInput, type Levels,
} from '@/features/build-optimizer/engine';
import { listFormulas } from '@/features/build-optimizer/engine/registry';
import { W_SKILL, SKILL_ORDER, oHitDetail, rng, type Sk, type Ammo } from './oracle';

/**
 * Wiki conformance audit (Batch 4). Every table below is typed in from the Wiki text, NOT read from the engine, so a changed engine constant fails here.
 * Passing these tests proves the implementation matches the Wiki text; it does not make any estimated or unverified mechanic game-confirmed.
 */
describe('wiki audit: tables match the Wiki text', () => {
  it('skills: level-0 / level-10 values and unlock levels (01-basics §2.4)', () => {
    for (const s of SKILL_ORDER) { assert.equal(SKILLS[s].level0, W_SKILL[s][0], `${s} level 0`); assert.equal(SKILLS[s].level10, W_SKILL[s][1], `${s} level 10`); assert.equal(SKILLS[s].unlockLevel, W_SKILL[s][2], `${s} unlock`); }
    assert.equal(SKILL_IDS.length, 14);
  });
  it('skill-point costs 1,1,2,3,4,5,6,8,9,10; total 49; unlock is by PLAYER level (01-basics §2.4)', () => {
    assert.deepEqual([...COST_BY_LEVEL], [1, 1, 2, 3, 4, 5, 6, 8, 9, 10]); assert.equal(cumulativeCost(10), 49);
    [0, 1, 2, 4, 7, 11, 16, 22, 30, 39, 49].forEach((c, l) => assert.equal(cumulativeCost(l), c, `cumulative ${l}`));
    assert.equal(isUnlocked('dodge', 11), false); assert.equal(isUnlocked('dodge', 12), true); assert.equal(isUnlocked('leadership', 8), false); assert.equal(isUnlocked('leadership', 9), true);
  });
  it('points: 4 per level above 1, +4 per Prestige; reset 0.5 gold per spent point, first reset free (01-basics §2.1, §2.5, §2.8)', () => {
    assert.equal(pointsEarned(1), 0); assert.equal(pointsEarned(22), 84); assert.equal(pointsEarned(50), 196); assert.equal(pointsEarned(30, 2), 4 * 29 + 8);
    assert.equal(resetCost(80, false), 40); assert.equal(resetCost(80, true), 0); assert.equal(resetCost(0, false), 0);
  });
  it('military rank thresholds and bonuses, including the +8% to +12% jump (01-basics §2.6)', () => {
    const wiki: [number, number][] = [[0, 0], [5000, 1], [25000, 2], [100000, 3], [400000, 4], [1500000, 5], [5000000, 6], [15000000, 7], [50000000, 8], [200000000, 12]];
    assert.equal(RANKS.length, 10);
    wiki.forEach(([d, b], i) => { assert.equal(Number(RANKS[i]!.damage), d); assert.equal(RANKS[i]!.bonusPct, b); assert.equal(rankFromDamage(d).bonusPct, b, `at ${d}`); if (d > 0) assert.equal(rankFromDamage(d - 1).bonusPct, wiki[i - 1]![1], `just below ${d}`); });
  });
  it('rarity ranges (01-basics §3.3)', () => {
    const W: Record<string, number[][]> = { // weapon attack, weapon crit, helmet crit damage, armor/dodge/accuracy
      common: [[20, 35], [2, 6], [1, 12], [1, 6]], uncommon: [[45, 65], [5, 9], [12, 28], [6, 14]], rare: [[75, 100], [10, 16], [28, 48], [14, 24]],
      epic: [[110, 145], [15, 22], [48, 72], [24, 36]], legendary: [[150, 190], [24, 32], [72, 100], [36, 50]], mythic: [[230, 320], [38, 48], [100, 135], [50, 67]],
    };
    assert.deepEqual([...RARITIES], ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic']);
    for (const r of RARITIES) { const e = RARITY_RANGES[r], w = W[r]!; assert.deepEqual([...e.weaponAttack], w[0]); assert.deepEqual([...e.weaponCrit], w[1]); assert.deepEqual([...e.helmetCritDamage], w[2]); for (const k of ['armor', 'dodge', 'accuracy'] as const) assert.deepEqual([...e[k]], w[3], `${r} ${k}`); }
  });
  it('ammunition (+12/+25/+45% attack; 1/3/12 lead per round) and food (12/18/25% of max health) (01-basics §2.3, §3.5)', () => {
    assert.deepEqual(AMMO, { light: { pct: 12, lead: 1 }, medium: { pct: 25, lead: 3 }, heavy: { pct: 45, lead: 12 } }); assert.deepEqual(FOOD_PCT, { bread: 12, steak: 18, cookedFish: 25 });
  });
  it('Field Crate rarity odds (55 / 28 / 12 / 4 / 0.9 / 0.1 %) sum to 100% and weapons are 25% of equipment (01-basics §4.4)', () => {
    assert.deepEqual(FIELD_CRATE_ODDS, { common: 0.55, uncommon: 0.28, rare: 0.12, epic: 0.04, legendary: 0.009, mythic: 0.001 }); assert.ok(Math.abs(Object.values(FIELD_CRATE_ODDS).reduce((a, b) => a + b, 0) - 1) < 1e-12); assert.equal(FIELD_CRATE_WEAPON_SHARE, 0.25);
  });
  it('stimulant: +50% attack for 6 h, then -50% for 12 h (01-basics §3.6)', () => { assert.deepEqual({ ...PILL }, { buffMinutes: 360, debuffMinutes: 720, buffPct: 50, debuffPct: -50 }); });
  it('battle bonus caps: positives sum to at most +100%, penalties to at least -50%, applied separately (03-war §1.7)', () => {
    const m = (...p: number[]) => battleModifierPct(p.map((pct, i) => ({ source: `m${i}`, pct }) as never));
    assert.equal(m(60, 70), 100); assert.equal(m(-30, -40), -50); assert.equal(m(60, 70, -30, -40), 50); assert.equal(m(20, -25), -5); assert.equal(m(), 0);
  });
  it('armor above 45 and dodge above 36 count at 50% (01-basics §2.4 "Skill caps and diminishing returns")', () => {
    assert.equal(diminish(45, 45), 45); assert.equal(diminish(55, 45), 50); assert.equal(diminish(36, 36), 36); assert.equal(diminish(46, 36), 41); assert.equal(diminish(0, 45), 0);
  });
  it('production, business and leadership endpoints drive the economy formulas (01-basics §2.4, 02-economy §1.4)', () => {
    assert.equal(skillValue('production', 0), 10); assert.equal(skillValue('production', 10), 50); assert.equal(skillValue('business', 10), 130); assert.equal(skillValue('leadership', 10), 34);
  });
});

describe('wiki audit: registry integrity (no silent promotion of Estimated / Unverified mechanics)', () => {
  // Every entry and its evidence status, pinned. Changing a status here must be a conscious decision backed by a game-confirmed source (see docs/build-optimizer-wiki-conformance.md).
  const PINNED: Record<string, string> = {
    'combat.battleBonus': 'documented', 'combat.booster': 'documented', 'combat.bounty': 'documented', 'combat.conventions.whatif': 'unverified', 'combat.critMultiplier': 'documented', 'combat.hitOutcomes': 'documented',
    'combat.luck': 'documented', 'combat.luck.distribution': 'unverified', 'combat.overflow': 'documented', 'combat.overflow.order': 'unverified', 'combat.personalBoost': 'documented', 'combat.rounding': 'documented',
    'combat.sustain': 'estimated', 'combat.weaponAmmo': 'documented', 'constraints.resolve': 'documented', 'econ.barRegen': 'documented', 'econ.dailyNet': 'estimated', 'econ.pointsPerWork': 'estimated', 'econ.unitValue': 'estimated',
    'gear.rarityRanges': 'documented', 'loadout.durability': 'estimated', 'loadout.food': 'estimated', 'loadout.search': 'documented', 'objective.hybrid': 'estimated', 'objective.maxDamagePerHit': 'estimated',
    'objective.maxEconomy': 'estimated', 'objective.maxNetValue': 'estimated', 'pill.plan': 'estimated', 'pill.timeline': 'documented', 'rank.bonus': 'documented', 'rewards.contract': 'estimated', 'rewards.loot': 'documented',
    'skills.cost': 'documented', 'skills.pointsEarned': 'documented', 'skills.pointsEarned.prestigeInteraction': 'unverified', 'skills.resetCost': 'documented', 'skills.unlock': 'documented', 'skills.value.endpoints': 'documented',
    'skills.value.linear': 'estimated', 'solver.exhaustive': 'documented', 'solver.twoGroup': 'documented', 'sustain.search': 'documented', 'sustain.session': 'estimated', 'war.fixedGear': 'documented', 'war.objectives': 'documented',
    'war.search': 'documented', 'war.session': 'estimated',
  };
  it('the registry has exactly the pinned entries with the pinned statuses; nothing is "verified" (that needs in-game confirmation)', () => {
    const live = Object.fromEntries(listFormulas().map((f) => [f.id, f.status])); assert.deepEqual(live, PINNED);
    const counts: Record<string, number> = {}; for (const s of Object.values(PINNED)) counts[s] = (counts[s] ?? 0) + 1;
    assert.deepEqual(counts, { documented: 28, estimated: 15, unverified: 4 }); assert.equal((counts as Record<string, number>).verified ?? 0, 0);
  });
  it('every entry has a summary, a source and at least one linked test whose title exists in tests/build-optimizer; documented mechanics cite the Wiki, the owner or the API', () => {
    const titles: string[] = []; for (const f of readdirSync('tests/build-optimizer').filter((x: string) => x.endsWith('.test.ts'))) for (const m of readFileSync(`tests/build-optimizer/${f}`, 'utf8').matchAll(/\bit\(\s*(['"`])((?:\\.|(?!\1).)*)\1/g)) titles.push(m[2]!.toLowerCase());
    for (const f of listFormulas()) {
      assert.ok(f.summary.length > 20 && f.source.length > 3 && f.version >= 1, f.id); assert.ok(f.tests.length > 0, `${f.id} has no linked test`);
      for (const t of f.tests) assert.ok(titles.some((x) => x.includes(t.toLowerCase())), `${f.id}: linked test "${t}" does not exist`);
      if ((f.kind ?? 'mechanic') === 'mechanic' && f.status === 'documented') assert.ok(/wiki|project owner|GET \//i.test(f.source), `${f.id} is "documented" without a Wiki / owner / API source: ${f.source}`);
    }
  });
});

describe('wiki audit: linked tests for formulas that had none', () => {
  it('points per work: production skill value x (1 + bonuses); bonuses are caller-supplied and summed (estimated), Wiki 02-economy §1.4 / §1.6', () => {
    const lv = (production: number): Levels => ({ ...emptyLevels(), production, business: 10, companySlots: 10 });
    const econ = (bonus: number) => ({ companies: { count: 1, product: RECIPES.steel!, productionBonusPct: bonus }, prices: { steel: { sell: 10 }, iron: { buy: 1 } }, marketTaxPct: 0, productionTaxPct: 0 });
    for (const [level, perWork] of [[0, 10], [5, 30], [10, 50]] as const) {
      const r = dailyEconomy(lv(level), econ(0)); assert.ok(Math.abs(r.ownPointsPerDay - worksPerDay(130) * perWork) < 1e-9, `level ${level}`);
      const b = dailyEconomy(lv(level), econ(20)); assert.ok(Math.abs(b.ownPointsPerDay - worksPerDay(130) * perWork * 1.2) < 1e-9, `level ${level} +20%`);
    }
  });
  it('pill plans: damage per battle equals the phase-weighted sum of independently computed per-hit damage (buff +50%, debuff -50%)', () => {
    const r = rng(777); const lv = {} as Record<Sk, number>; for (const s of SKILL_ORDER) lv[s] = r.int(0, 10);
    const gear: GearInput = { weapon: { kind: 'item', stats: { attack: 120, critChance: 14, usesAmmo: true } }, helmet: { kind: 'item', stats: { critDamage: 40 } }, gloves: { kind: 'item', stats: { accuracy: 20 } }, chest: { kind: 'empty' }, legs: { kind: 'empty' }, boots: { kind: 'empty' } };
    const w = { id: 'w', attack: 120, crit: 14, usesAmmo: true, durability: 100 }, hm = { id: 'h', value: 40, durability: 100 }, gl = { id: 'g', value: 20, durability: 100 };
    const E = (pill: number) => oHitDetail(lv, w, hm, gl, 'medium' as Ammo, 3, 0, pill).per;
    const combat = { levels: lv as unknown as Levels, gear, ammo: 'medium' as const, rankBonusPct: 3 };
    const base = (schedule: { startMinutes: number; durationMinutes: number; hits: number }[]) => analysePill({ state: { kind: 'none' }, schedule, combat, cost: { mode: 'owned' }, candidateUseTimes: [0] });
    const a = base([{ startMinutes: 0, durationMinutes: 60, hits: 100 }, { startMinutes: 400, durationMinutes: 60, hits: 80 }, { startMinutes: 330, durationMinutes: 60, hits: 60 }]);
    assert.ok(a.ok); if (!a.ok) return; const plan = a.plans[0]!;
    assert.ok(Math.abs(plan.damagePerBattle[0]! - 100 * E(50)) < 1e-6, 'inside the 6 h buff window');
    assert.ok(Math.abs(plan.damagePerBattle[1]! - 80 * E(-50)) < 1e-6, 'inside the 12 h debuff window (minute 360 to 1080)');
    assert.ok(Math.abs(plan.damagePerBattle[2]! - 60 * (0.5 * E(50) + 0.5 * E(-50))) < 1e-6, 'straddling the buff / debuff boundary at minute 360');
    assert.ok(Math.abs(a.baseline.totalDamage - (100 + 80 + 60) * E(0)) < 1e-6, 'no new Pill: no modifier');
    assert.equal(computeHit({ ...combat, booster: 'none' }).expected, E(0));
  });
});
