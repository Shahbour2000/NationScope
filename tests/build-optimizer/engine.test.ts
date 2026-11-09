import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import {
  AMMO, COST_BY_LEVEL, SKILL_IDS, cumulativeCost, emptyLevels, exactLevelForPoints, listFormulas, maxLevelForPoints,
  minLevelForPoints, minLevelForStat, pointsEarned, skillPointLedger, resetCost, resolveConstraints, skillValue, solve, optimizeBuild,
  computeHit, horizon, battleModifierPct, companyCapabilityConstraints, weakestStatus, isUnlocked, totalCost,
  type CombatInput, type Constraint, type Levels, type GearInput, type WarContext,
} from '@/features/build-optimizer/engine';

const lv = (o: Partial<Levels>): Levels => ({ ...emptyLevels(), ...o });
const knife: GearInput = { weapon: { kind: 'item', stats: { attack: 30, critChance: 4, usesAmmo: false } },
  helmet: { kind: 'empty' }, gloves: { kind: 'empty' }, chest: { kind: 'empty' }, legs: { kind: 'empty' }, boots: { kind: 'empty' } };
const base = (o: Partial<CombatInput> = {}): CombatInput => ({ levels: emptyLevels(), gear: knife, ammo: 'none', booster: 'none', rankBonusPct: 0, ...o });
const approx = (a: number, b: number, e = 1e-9) => assert.ok(Math.abs(a - b) < e, `${a} !~ ${b}`);

describe('skill points', () => {
  it('cumulative cost table', () => {
    assert.deepEqual(COST_BY_LEVEL, [1, 1, 2, 3, 4, 5, 6, 8, 9, 10]);
    assert.deepEqual([0,1,2,3,4,5,6,7,8,9,10].map(cumulativeCost), [0, 1, 2, 4, 7, 11, 16, 22, 30, 39, 49]);
    assert.equal(totalCost(lv({ attack: 10, accuracy: 10 })), 98);
    assert.throws(() => cumulativeCost(11)); assert.throws(() => cumulativeCost(-1)); assert.throws(() => cumulativeCost(1.5));
  });
  it('points<->level mapping', () => {
    assert.equal(minLevelForPoints(5), 4); assert.equal(maxLevelForPoints(5), 3);
    assert.equal(exactLevelForPoints(5), null); assert.equal(exactLevelForPoints(7), 4); assert.equal(minLevelForPoints(50), null);
  });
  it('skill endpoints', () => {
    assert.equal(skillValue('attack', 0), 100); assert.equal(skillValue('attack', 10), 400);
    assert.equal(skillValue('leadership', 10), 34); assert.equal(skillValue('companySlots', 0), 2);
  });
  it('linear interpolation', () => { assert.equal(skillValue('attack', 5), 250); assert.equal(skillValue('accuracy', 9), 104); });
  it('unlock levels', () => {
    assert.equal(isUnlocked('health', 3), false); assert.equal(isUnlocked('health', 4), true);
    assert.equal(isUnlocked('dodge', 11), false); assert.equal(isUnlocked('dodge', 12), true); assert.equal(isUnlocked('leadership', 9), true);
  });
  it('points earned', () => { assert.equal(pointsEarned(1), 0); assert.equal(pointsEarned(22), 84); assert.equal(pointsEarned(50), 196); assert.equal(pointsEarned(50, 2), 204); });
  it('skill point ledger', () => {
    const l = skillPointLedger({ level: 22, invested: 80 });
    assert.equal(l.earnedFromLevels, 84); assert.equal(l.earnedTotal, 84); assert.equal(l.available, 4); assert.equal(l.consistent, true); assert.equal(l.prestigeKnown, false); assert.equal(l.prestigePoints, null); assert.equal(l.exact, false); assert.equal(l.basis, 'lower-bound');
    const lb = skillPointLedger({ level: 22, invested: 85 }); assert.equal(lb.impliedMinPrestige, 1); assert.equal(lb.earnedTotal, 88); assert.equal(lb.available, 3); assert.equal(lb.consistent, true); assert.equal(lb.exact, false);
    const big = skillPointLedger({ level: 22, invested: 93 }); assert.equal(big.impliedMinPrestige, 3); assert.equal(big.earnedTotal, 96);
    const k = skillPointLedger({ level: 22, prestigeCount: 2, invested: 85 }); assert.equal(k.earnedTotal, 92); assert.equal(k.prestigePoints, 8); assert.equal(k.available, 7); assert.equal(k.exact, true);
    const z = skillPointLedger({ level: 22, prestigeCount: 0, invested: 85 }); assert.equal(z.consistent, false); assert.equal(z.available, null); assert.equal(z.earnedTotal, 84); // never silently raised
    const av = skillPointLedger({ level: 22, invested: 85, availablePoints: 3 }); assert.equal(av.earnedTotal, 88); assert.equal(av.prestigePoints, 4); assert.equal(av.exact, true);
    const odd = skillPointLedger({ level: 22, invested: 80, availablePoints: 5 }); assert.equal(odd.earnedTotal, 85); assert.equal(odd.prestigePoints, null); // 85 is not 84 + 4k: reported, not forced
    assert.equal(skillPointLedger({ level: 22, totalOverride: 90 }).earnedTotal, 90); assert.equal(skillPointLedger({ level: 22 }).available, null);
    assert.equal(skillPointLedger({ level: 22, totalOverride: 80, invested: 85 }).consistent, false);
  });
  it('reset cost', () => { assert.equal(resetCost(100, true), 0); assert.equal(resetCost(100, false), 50); });
  it('minStat levels', () => { assert.equal(minLevelForStat('companySlots', 2), 0); assert.equal(minLevelForStat('companySlots', 5), 3); assert.equal(minLevelForStat('companySlots', 13), null); });
});

describe('constraint resolution', () => {
  const ctx = { playerLevel: 30, totalPoints: 100 };
  const m = (id: string, spec: Constraint['spec']): Constraint => ({ id, strength: 'mandatory', spec });
  it('constraint resolution', () => {
    const r = resolveConstraints([m('a', { type: 'minPoints', skill: 'companySlots', points: 5 }), m('b', { type: 'maxLevel', skill: 'attack', level: 6 }), m('c', { type: 'exactLevel', skill: 'armor', level: 2 })], ctx);
    assert.ok(r.ok); if (!r.ok) return;
    assert.deepEqual(r.bounds.companySlots, { lo: 4, hi: 10 }); assert.deepEqual(r.bounds.attack, { lo: 0, hi: 6 });
    assert.deepEqual(r.bounds.armor, { lo: 2, hi: 2 }); assert.equal(r.minimumPointsRequired, 7 + 2);
  });
  it('conflicts', () => {
    const first = (res: ReturnType<typeof resolveConstraints>) => (res.ok ? undefined : res.conflicts[0]);
    let r = resolveConstraints([m('a', { type: 'minLevel', skill: 'attack', level: 7 }), m('b', { type: 'maxLevel', skill: 'attack', level: 3 })], ctx);
    assert.ok(first(r)?.code === 'BOUNDS_CONTRADICT' && first(r)?.constraintIds.includes('a') && first(r)?.constraintIds.includes('b'));
    r = resolveConstraints([m('x', { type: 'exactPoints', skill: 'attack', points: 5 })], ctx);
    assert.ok(first(r)?.code === 'EXACT_POINTS_UNATTAINABLE');
    r = resolveConstraints([m('l', { type: 'minLevel', skill: 'dodge', level: 1 })], { playerLevel: 10, totalPoints: 100 });
    assert.ok(first(r)?.code === 'SKILL_LOCKED');
    r = resolveConstraints([m('s', { type: 'minStat', skill: 'companySlots', value: 20 })], ctx);
    assert.ok(first(r)?.code === 'STAT_UNREACHABLE');
    r = resolveConstraints([m('p', { type: 'minLevel', skill: 'attack', level: 10 }), m('q', { type: 'minLevel', skill: 'accuracy', level: 10 })], { playerLevel: 30, totalPoints: 90 });
    assert.ok(first(r)?.code === 'BUDGET_EXCEEDED' && first(r)?.details?.shortfall === 8);
    r = resolveConstraints([m('v', { type: 'minLevel', skill: 'attack', level: 11 })], ctx);
    assert.ok(first(r)?.code === 'INVALID_CONSTRAINT');
  });
  it('preferences never change bounds', () => {
    const r = resolveConstraints([{ id: 'p', strength: 'preference', spec: { type: 'minLevel', skill: 'attack', level: 10 } }], { playerLevel: 30, totalPoints: 0 });
    assert.ok(r.ok);
  });
  it('capability helper', () => {
    const cs = companyCapabilityConstraints(4, 12);
    const r = resolveConstraints(cs, ctx); assert.ok(r.ok); if (!r.ok) return;
    assert.equal(r.bounds.companySlots.lo, 2); assert.equal(r.bounds.leadership.lo, 3); // 4 slots -> L2; 12 workers -> 4+3L>=12 -> L3
  });
});

describe('combat', () => {
  it('hit outcomes', () => {
    const h = computeHit(base()); // attack 100 + knife 30, acc 50, crit 10+4
    assert.equal(h.attackBase, 130); approx(h.cleanChance, 0.5); approx(h.critChance, 0.14);
    approx(h.expected, 130 * (0.5 * 0.5 + 0.5 * (0.86 + 0.14 * 2)));
    approx(h.outcomes.reduce((s, o) => s + o.probability, 0), 1);
    assert.equal(h.minPerHit, Math.floor(65 * 0.9)); assert.equal(h.maxPerHit, Math.floor(130 * 2 * 1.1));
  });
  it('crit convention', () => {
    const d = computeHit(base({ conventions: { critMultiplier: 'direct' } }));
    approx(d.outcomes[2]!.damage, 130 * 1.0); // CD 100 => x1.0 under 'direct'
    assert.equal(d.evidence, 'unverified');
  });
  it('overflow', () => {
    const h = computeHit(base({ levels: lv({ accuracy: 10, critChance: 10 }), gear: { ...knife, gloves: { kind: 'item', stats: { accuracy: 10 } } } }));
    assert.equal(h.accuracyTotal, 120); assert.equal(h.attackBase, 100 + 30 + 60); approx(h.cleanChance, 1);
    const w = computeHit(base({ levels: lv({ critChance: 10 }), gear: { ...knife, weapon: { kind: 'item', stats: { attack: 30, critChance: 60, usesAmmo: false } } } }));
    assert.equal(w.critChanceTotal, 110); assert.equal(w.critDamageTotal, 100 + 30); approx(w.critChance, 1);
  });
  it('weapon needs ammo', () => {
    const pistol: GearInput = { ...knife, weapon: { kind: 'item', stats: { attack: 50, critChance: 7, usesAmmo: true } } };
    const none = computeHit(base({ gear: pistol, ammo: 'none' })); assert.equal(none.attackBase, 100); assert.equal(none.critChanceTotal, 10);
    const lite = computeHit(base({ gear: pistol, ammo: 'light' })); assert.equal(lite.attackBase, 150); approx(lite.personalMultiplier, 1.12);
  });
  it('personal boosts additive', () => {
    const h = computeHit(base({ ammo: 'medium', rankBonusPct: 5 }));
    approx(h.personalMultiplier, 1 + (25 + 5) / 100);
    approx(computeHit(base({ ammo: 'medium', rankBonusPct: 5, conventions: { stacking: 'multiplicative' } })).personalMultiplier, 1.25 * 1.05);
  });
  it('booster phases', () => {
    // the Pill changes the Attack SKILL value only; ammo/rank multiplier is untouched
    const skill = 100; // attack level 0
    for (const [phase, pct] of [['none', 0], ['positive', 50], ['negative', -50]] as const) {
      const h = computeHit(base({ booster: phase }));
      approx(h.pillPct, pct); approx(h.attackSkillEffective, skill * (1 + pct / 100)); approx(h.attackBase, skill * (1 + pct / 100) + 30); approx(h.personalMultiplier, 1);
    }
  });
  it('pill is attack-skill only', () => {
    const lev = lv({ attack: 10, accuracy: 10, critChance: 5, critDamage: 5, armor: 3, dodge: 3, lootChance: 4 });
    const gloves: GearInput = { ...knife, gloves: { kind: 'item', stats: { accuracy: 10 } }, chest: { kind: 'item', stats: { armor: 5 } } };
    const none = computeHit(base({ levels: lev, gear: gloves, ammo: 'medium', rankBonusPct: 5 }));
    const buff = computeHit(base({ levels: lev, gear: gloves, ammo: 'medium', rankBonusPct: 5, booster: 'positive' }));
    const debuff = computeHit(base({ levels: lev, gear: gloves, ammo: 'medium', rankBonusPct: 5, booster: 'negative' }));
    for (const k of ['accuracyTotal', 'critChanceTotal', 'critDamageTotal', 'cleanChance', 'critChance', 'personalMultiplier', 'battleMultiplier', 'healthLossPerHit', 'dodgeProbability'] as const) { approx(buff[k], none[k]); approx(debuff[k], none[k]); }
    // accuracy overflow (skill 110 + gloves 10 = 120 -> +60 attack) is NOT the Attack skill: it is not scaled by the Pill
    const S = 400, W = 30, OF = 60, M = 1 + (25 + 5) / 100;
    approx(none.attackSkillEffective, S); approx(buff.attackSkillEffective, S * 1.5); approx(debuff.attackSkillEffective, S * 0.5);
    approx(none.outcomes[1]!.damage, (S + W + OF) * M); approx(buff.outcomes[1]!.damage, (S * 1.5 + W + OF) * M); approx(debuff.outcomes[1]!.damage, (S * 0.5 + W + OF) * M);
    assert.ok(buff.usedFormulas.includes('combat.booster')); assert.ok(!none.usedFormulas.includes('combat.booster'));
  });
  it('battle bonus caps', () => {
    const mod = (id: string, pct: number) => ({ id, label: id, pct, status: 'documented' as const, source: 'user' as const });
    assert.equal(battleModifierPct([mod('a', 70), mod('b', 60)]), 100);
    assert.equal(battleModifierPct([mod('a', -40), mod('b', -30)]), -50);
    assert.equal(battleModifierPct([mod('a', 120), mod('b', -60)]), 50);
    const war: WarContext = { warId: 'w1', side: 'attacker', modifiers: [mod('a', 20)], displayedTotalPct: 30 };
    approx(computeHit(base({ war })).battleMultiplier, 1.3); // displayed total overrides, no double counting
    assert.equal(computeHit(base()).battleMultiplier, 1);
  });
  it('missing inputs are reported not zeroed silently', () => {
    const h = computeHit({ levels: emptyLevels(), gear: {}, ammo: 'none', booster: 'none' });
    for (const k of ['gear.weapon', 'gear.helmet', 'gear.gloves', 'gear.chest', 'gear.legs', 'gear.boots', 'rankBonusPct']) assert.ok(h.missing.includes(k), k);
  });
  it('sustain', () => {
    const h = computeHit(base({ levels: lv({ armor: 10 }) })); approx(h.healthLossPerHit, 10 * (1 - 47.5 / 100)); approx(h.hitsPerFullHealth, 100 / 5.25); // armor 50 -> 45 + 5/2
    const g: GearInput = { ...knife, chest: { kind: 'item', stats: { armor: 60 } } };
    approx(computeHit(base({ gear: g })).healthLossPerHit, 10 * (1 - (45 + 7.5) / 100)); // 60 -> 45 + 15/2
    approx(computeHit(base({ gear: { ...knife, chest: { kind: 'item', stats: { armor: 100 } } } })).healthLossPerHit, 10 * (1 - 72.5 / 100));
  });
  it('bounty', () => {
    const h = computeHit(base({ ammo: 'light' }));
    const war: WarContext = { warId: 'w', side: 'attacker', modifiers: [], bounty: { ratePer1000: 2, remainingBudget: 1e9, eligible: true } };
    const t = horizon(h, 'light', 1000, { leadPerUnit: 0.5 }, war);
    approx(t.bountyIncome!, (h.expected * 1000 / 1000) * 2); approx(t.ammoCost!, 1000 * AMMO.light.lead * 0.5);
    const capped = horizon(h, 'light', 1000, { leadPerUnit: 0.5 }, { ...war, bounty: { ...war.bounty!, remainingBudget: 10 } });
    assert.equal(capped.bountyIncome, 10);
    assert.equal(horizon(h, 'light', 10, { leadPerUnit: 1 }, { ...war, bounty: { ...war.bounty!, eligible: false } }).bountyIncome, 0);
    assert.equal(horizon(h, 'light', 10, {}, war).net, null);
    assert.equal(horizon(h, 'none', 10, {}, war).ammoCost, 0);
  });
});

describe('solver + optimizer', () => {
  const bounds = Object.fromEntries(SKILL_IDS.map((s) => [s, { lo: 0, hi: 10 }])) as Record<(typeof SKILL_IDS)[number], { lo: number; hi: number }>;
  it('solver optimality vs brute force', () => {
    const skills = ['attack', 'accuracy', 'critChance'] as const;
    const score = (l: Levels) => computeHit(base({ levels: l })).expected;
    const budget = 25;
    const r = solve({ bounds, budget, decisionSkills: [...skills], score, topK: 1 });
    let best = -1;
    for (let a = 0; a <= 10; a++) for (let b = 0; b <= 10; b++) for (let c = 0; c <= 10; c++)
      if (cumulativeCost(a) + cumulativeCost(b) + cumulativeCost(c) <= budget) best = Math.max(best, score(lv({ attack: a, accuracy: b, critChance: c })));
    approx(r.candidates[0]!.score, best); assert.ok(r.exhaustive);
  });
  it('solver determinism', () => {
    const run = () => solve({ bounds, budget: 30, decisionSkills: ['attack', 'accuracy', 'critDamage', 'critChance'], score: (l) => computeHit(base({ levels: l })).expected, topK: 3 });
    assert.deepEqual(run(), run());
  });
  it('solver respects evaluation cap honestly', () => {
    const r = solve({ bounds, budget: 100, decisionSkills: ['attack', 'accuracy'], score: () => 1, maxEvaluations: 5 });
    assert.equal(r.exhaustive, false);
  });
  const req = (o: object = {}) => ({ player: { level: 30, totalPoints: 60 }, objective: { type: 'maxDamagePerHit' as const }, combat: { gear: knife, ammo: 'none' as const, booster: 'none' as const, rankBonusPct: 0 }, ...o });
  it('objective damage', () => {
    const r = optimizeBuild(req()); assert.ok(r.ok); if (!r.ok) return;
    assert.ok(r.builds.length >= 1 && r.builds[0]!.pointsSpent <= 60); assert.ok(r.exhaustive);
    assert.ok(r.builds[0]!.score >= r.builds[r.builds.length - 1]!.score);
  });
  it('mandatory constraints are never violated, even when worse for damage', () => {
    const cs: Constraint[] = [{ id: 'keep5', strength: 'mandatory', spec: { type: 'minPoints', skill: 'companySlots', points: 5 } }, ...companyCapabilityConstraints(2)];
    const free = optimizeBuild(req()), con = optimizeBuild(req({ constraints: cs }));
    assert.ok(free.ok && con.ok); if (!free.ok || !con.ok) return;
    for (const b of con.builds) assert.ok(cumulativeCost(b.levels.companySlots) >= 5);
    assert.ok(con.builds[0]!.score <= free.builds[0]!.score);
    assert.ok(con.builds[0]!.mandatoryPreserved.includes('keep5'));
  });
  it('conflicting constraints are explained', () => {
    const r = optimizeBuild(req({ player: { level: 30, totalPoints: 10 }, constraints: [{ id: 'big', strength: 'mandatory', spec: { type: 'minLevel', skill: 'companySlots', level: 10 } }] }));
    assert.ok(!r.ok && r.reason === 'conflict' && r.conflicts[0]!.code === 'BUDGET_EXCEEDED');
  });
  it('no-reset keeps current levels and reports reset need otherwise', () => {
    const cur = lv({ attack: 3, companySlots: 2, accuracy: 2 });
    const keep = optimizeBuild(req({ player: { level: 30, totalPoints: 60, currentLevels: cur }, allowReset: false })); assert.ok(keep.ok);
    if (keep.ok) for (const b of keep.builds) { assert.ok(!b.resetRequired && b.resetCostGold === 0); assert.ok(b.levels.attack >= 3 && b.levels.companySlots >= 2); }
    const reset = optimizeBuild(req({ player: { level: 30, totalPoints: 60, currentLevels: lv({ companySlots: 8 }), firstResetFree: false } })); assert.ok(reset.ok);
    if (reset.ok) { assert.ok(reset.builds[0]!.resetRequired); assert.equal(reset.builds[0]!.resetCostGold, cumulativeCost(8) * 0.5); }
    assert.ok(!optimizeBuild(req({ allowReset: false })).ok);
  });
  it('preferences are reported, not enforced', () => {
    const r = optimizeBuild(req({ constraints: [{ id: 'pref', strength: 'preference', spec: { type: 'minLevel', skill: 'dodge', level: 5 } }] }));
    assert.ok(r.ok); if (r.ok) assert.ok(r.builds[0]!.preferencesViolated.includes('pref'));
  });
  it('objective net value', () => {
    const war: WarContext = { warId: 'w', side: 'attacker', modifiers: [], bounty: { ratePer1000: 1, remainingBudget: 1e9, eligible: true } };
    const miss = optimizeBuild(req({ objective: { type: 'maxNetValue' }, combat: { gear: knife, ammo: 'light', booster: 'none', rankBonusPct: 0, war } }));
    assert.ok(!miss.ok && miss.reason === 'missing-input');
    const ok = optimizeBuild(req({ objective: { type: 'maxNetValue' }, prices: { leadPerUnit: 0.1 }, hits: 100, combat: { gear: knife, ammo: 'light', booster: 'none', rankBonusPct: 0, war } }));
    assert.ok(ok.ok);
  });
  it('economic objective without inputs is an explicit missing-input', () => {
    const r = optimizeBuild(req({ objective: { type: 'maxEconomy' } })); assert.ok(!r.ok && r.reason === 'missing-input');
  });
  it('derived total points is flagged as an assumption', () => {
    const r = optimizeBuild(req({ player: { level: 10 } })); assert.ok(r.ok); if (r.ok) { assert.equal(r.totalPoints, 36); assert.ok(r.assumptions.length > 0); }
  });
});

describe('registry', () => {
  it('every formula lists tests that exist and statuses are honest', () => {
    const f = listFormulas(); assert.ok(f.length >= 20);
    for (const x of f) assert.ok(x.tests.length > 0, x.id);
    assert.equal(weakestStatus(['skills.cost']), 'documented');
    assert.equal(weakestStatus(['skills.value.linear']), 'estimated');
    assert.equal(weakestStatus(['combat.critMultiplier']), 'unverified');
    assert.equal(weakestStatus(['skills.pointsEarned']), 'documented');
  });
});
