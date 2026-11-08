import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import {
  analysePill, earliestNewUse, emptyLevels, phaseShares, pillCost, PILL, RECIPES, optimizeBuild, computeHit, type Battle, type CombatInput, type GearInput,
} from '@/features/build-optimizer/engine';

const gear: GearInput = { weapon: { kind: 'item', stats: { attack: 30, critChance: 4, usesAmmo: false } }, helmet: { kind: 'empty' }, gloves: { kind: 'empty' }, chest: { kind: 'empty' }, legs: { kind: 'empty' }, boots: { kind: 'empty' } };
const combat = { levels: emptyLevels(), gear, ammo: 'none' as const, rankBonusPct: 0 };
const approx = (a: number, b: number, e = 1e-6) => assert.ok(Math.abs(a - b) < e, `${a} !~ ${b}`);
const battle = (startMinutes: number, durationMinutes: number, hits: number): Battle => ({ startMinutes, durationMinutes, hits });
const E2 = (c: Omit<CombatInput, 'booster'>, booster: 'none' | 'positive' | 'negative') => computeHit({ ...c, booster }).expected;
const E = (booster: 'none' | 'positive' | 'negative') => computeHit({ ...combat, booster }).expected;
/** Wiki formula without the per-hit rounding (03-war §1.6 step 7), for exact ratio checks. */
const U = (c: Omit<CombatInput, 'booster'>, booster: 'none' | 'positive' | 'negative') => computeHit({ ...c, booster }).expectedUnrounded;

describe('pill timeline', () => {
  it('pill timeline', () => {
    assert.deepEqual([PILL.buffMinutes, PILL.debuffMinutes, PILL.buffPct, PILL.debuffPct], [360, 720, 50, -50]);
    assert.equal(earliestNewUse({ kind: 'none' }), 0);
    assert.equal(earliestNewUse({ kind: 'debuff', remainingMinutes: 100 }), 100);
    assert.equal(earliestNewUse({ kind: 'buff', remainingMinutes: 100 }), 820); // rest of buff + full debuff
  });
  it('phase shares split a battle across phase boundaries', () => {
    const pieces = [{ from: 0, to: 60, phase: 'buff' as const }, { from: 60, to: 780, phase: 'debuff' as const }];
    const s = phaseShares(pieces, battle(30, 60, 10)); // 30 min buff + 30 min debuff
    approx(s.buff, 0.5); approx(s.debuff, 0.5); approx(s.none, 0);
    const after = phaseShares(pieces, battle(1000, 30, 10)); approx(after.none, 1);
    const exp = phaseShares(pieces, { startMinutes: 0, durationMinutes: 10, hits: 4, hitOffsetsMinutes: [1, 2, 61, 70] }); approx(exp.buff, 0.5);
  });
  it('pill cost: buy, craft (150 coca, 150 production points), owned, unknown stays null', () => {
    assert.equal(pillCost({ mode: 'buy', marketPrice: 12 }).gold, 12);
    assert.equal(pillCost({ mode: 'buy' }).gold, null);
    const c = pillCost({ mode: 'craft', cocaPrice: 2 }); assert.equal(c.gold, 300); assert.equal(c.productionPoints, RECIPES.stimulant!.pointsPerUnit);
    assert.equal(pillCost({ mode: 'craft' }).gold, null); assert.equal(pillCost({ mode: 'owned' }).gold, 0);
  });
});

describe('pill plans', () => {
  const base = { combat, cost: { mode: 'buy' as const, marketPrice: 1000 }, goldPerDamage: 0.01 };
  it('state unknown is refused unless explicitly assumed', () => {
    const r = analysePill({ ...base, state: { kind: 'unknown' }, schedule: [battle(0, 60, 100)] }); assert.ok(!r.ok && r.reason === 'state-unknown');
    const a = analysePill({ ...base, state: { kind: 'unknown' }, assumeState: { kind: 'none' }, schedule: [battle(0, 60, 100)] }); assert.ok(a.ok && a.assumptions.some((x) => x.includes('assumed')));
  });
  it('a battle fully inside the buff window gains exactly the buff share', () => {
    const r = analysePill({ ...base, state: { kind: 'none' }, schedule: [battle(0, 60, 100)] }); assert.ok(r.ok); if (!r.ok) return;
    const plan = r.plans.find((p) => p.useAtMinutes === 0)!;
    approx(plan.totalDamage, 100 * E('positive')); approx(r.baseline.totalDamage, 100 * E('none'));
    approx(plan.deltaDamage, 100 * (E('positive') - E('none'))); assert.equal(r.best.useAtMinutes, 0);
    approx(plan.net!, plan.deltaDamage * 0.01 - 1000);
    assert.equal(plan.hitsInDebuff, 0);
  });
  it('a later battle inside the debuff window makes the Pill a net loss for that battle', () => {
    // battle A (inside buff) then battle B 8 h later (inside debuff): damage of B drops by the debuff
    const sched = [battle(0, 60, 100), battle(480, 60, 100)];
    const r = analysePill({ ...base, state: { kind: 'none' }, schedule: sched }); assert.ok(r.ok); if (!r.ok) return;
    const p = r.plans.find((x) => x.useAtMinutes === 0)!;
    approx(p.damagePerBattle[1]!, 100 * E('negative')); assert.ok(p.damagePerBattle[1]! < r.baseline.damagePerBattle[1]!);
    assert.equal(p.hitsInDebuff, 100);
    // with symmetric +50/-50 and equal hits the gain and the loss cancel; because every hit is rounded down (Wiki step 7) they cancel only up to rounding (< 1 damage per hit)
    approx(p.deltaDamage, 100 * (E('positive') - E('none')) + 100 * (E('negative') - E('none')));
    assert.ok(Math.abs(p.deltaDamage) <= 200, String(p.deltaDamage));
    // using it at minute 0 is pointless (+50% then -50% cancels), but saving it for battle B gives that battle the buff
    const late = r.plans.find((x) => x.useAtMinutes === 480)!;
    assert.equal(r.best.useAtMinutes, 480); assert.ok(late.deltaDamage > 0); assert.ok(late.deltaDamage > p.deltaDamage);
    assert.equal(late.hitsInDebuff, 0);
  });
  it('an active debuff blocks a new Pill until it ends, and a battle straddling the end blends phases', () => {
    const r = analysePill({ ...base, state: { kind: 'debuff', remainingMinutes: 30 }, schedule: [battle(0, 60, 100)] }); assert.ok(r.ok); if (!r.ok) return;
    approx(r.baseline.totalDamage, 100 * (0.5 * E('negative') + 0.5 * E('none')));
    assert.ok(r.plans.every((p) => (p.useAtMinutes ?? 0) >= 30));
    const none = analysePill({ ...base, state: { kind: 'buff', remainingMinutes: 600 }, schedule: [battle(0, 60, 100)] }); assert.ok(none.ok);
    if (none.ok) { assert.ok(none.plans.every((p) => p.useAtMinutes! >= 1320)); assert.equal(none.best.label, 'no new Pill'); approx(none.baseline.totalDamage, 100 * E('positive')); }
    const blocked = analysePill({ ...base, state: { kind: 'buff', remainingMinutes: 600 }, schedule: [battle(0, 60, 100)], candidateUseTimes: [0, 100] }); assert.ok(blocked.ok);
    if (blocked.ok) { assert.equal(blocked.plans.length, 0); assert.ok(blocked.assumptions.some((x) => x.includes('No Pill can be used'))); }
  });
  it('cost per extra 1000 damage and unknown price', () => {
    const r = analysePill({ ...base, state: { kind: 'none' }, schedule: [battle(0, 60, 1000)] }); assert.ok(r.ok); if (!r.ok) return;
    const p = r.plans[0]!; approx(p.costPer1000ExtraDamage!, (1000 / p.deltaDamage) * 1000);
    const u = analysePill({ ...base, cost: { mode: 'buy' }, state: { kind: 'none' }, schedule: [battle(0, 60, 1000)] }); assert.ok(u.ok);
    if (u.ok) { assert.equal(u.plans[0]!.goldCost, null); assert.equal(u.plans[0]!.net, null); }
  });
  it('the Pill is a third summand with ammo and rank (Wiki 03-war §1.6 step 2)', () => {
    const ammoCombat = { ...combat, levels: { ...emptyLevels(), attack: 10 }, ammo: 'heavy' as const, gear: { ...gear, weapon: { kind: 'item' as const, stats: { attack: 50, critChance: 4, usesAmmo: true } } }, rankBonusPct: 8 };
    const r = analysePill({ combat: ammoCombat, state: { kind: 'none' }, schedule: [battle(0, 60, 100)], cost: { mode: 'owned' } }); assert.ok(r.ok); if (!r.ok) return;
    const sum = (pill: number) => 1 + (45 + pill + 8) / 100; // ammo + pill + rank, summed
    approx(U(ammoCombat, 'positive') / U(ammoCombat, 'none'), sum(50) / sum(0));
    approx(U(ammoCombat, 'negative') / U(ammoCombat, 'none'), sum(-50) / sum(0));
    approx(computeHit({ ...ammoCombat, booster: 'positive' }).personalMultiplier, sum(50));
    assert.equal(r.evidence, 'estimated'); // weakest link: interpolated skill values / sustain mapping, not the Pill
    assert.ok(!('byStacking' in r));
  });
  it('positive phase, negative phase, expired phase and a battle spanning phases', () => {
    const lev = { ...emptyLevels(), attack: 10 }; // attack skill 400, knife +30
    const c = { ...combat, levels: lev };
    const Epos = E2(c, 'positive'), Eneg = E2(c, 'negative'), Enone = E2(c, 'none');
    approx(U(c, 'positive') / U(c, 'none'), 1.5); approx(U(c, 'negative') / U(c, 'none'), 0.5); // no ammo/rank: the stimulant alone scales the whole attack
    assert.ok(Math.abs(Epos - U(c, 'positive')) < 1 && Math.abs(Enone - U(c, 'none')) < 1);
    const pos = analysePill({ combat: c, state: { kind: 'buff', remainingMinutes: 120 }, schedule: [battle(10, 60, 50)], cost: { mode: 'owned' } }); assert.ok(pos.ok);
    if (pos.ok) { approx(pos.baseline.totalDamage, 50 * Epos); assert.equal(pos.baseline.hitsInBuff, 50); }
    const neg = analysePill({ combat: c, state: { kind: 'debuff', remainingMinutes: 120 }, schedule: [battle(10, 60, 50)], cost: { mode: 'owned' } }); assert.ok(neg.ok);
    if (neg.ok) { approx(neg.baseline.totalDamage, 50 * Eneg); assert.equal(neg.baseline.hitsInDebuff, 50); }
    // expired: used at 0, battle starts after 360 + 720 = 1080 minutes
    const expired = analysePill({ combat: c, state: { kind: 'none' }, schedule: [battle(1080, 30, 50)], cost: { mode: 'owned' }, candidateUseTimes: [0] }); assert.ok(expired.ok);
    if (expired.ok) { const p = expired.plans[0]!; approx(p.totalDamage, 50 * Enone); approx(p.deltaDamage, 0); assert.equal(p.hitsInBuff + p.hitsInDebuff, 0); }
    const justBefore = analysePill({ combat: c, state: { kind: 'none' }, schedule: [battle(1079, 1, 10)], cost: { mode: 'owned' }, candidateUseTimes: [0] }); assert.ok(justBefore.ok);
    if (justBefore.ok) approx(justBefore.plans[0]!.totalDamage, 10 * Eneg); // last minute of the debuff
    // spanning buff -> debuff -> expired: use at 0; battle 300..1140 covers 60 min buff, 720 min debuff, 60 min none
    const span = analysePill({ combat: c, state: { kind: 'none' }, schedule: [battle(300, 840, 840)], cost: { mode: 'owned' }, candidateUseTimes: [0] }); assert.ok(span.ok); if (!span.ok) return;
    const p = span.plans[0]!; approx(p.hitsInBuff, 60); approx(p.hitsInDebuff, 720); approx(p.totalDamage, 60 * Epos + 720 * Eneg + 60 * Enone);
    // explicit hit times follow the same windows
    const ex = analysePill({ combat: c, state: { kind: 'none' }, schedule: [{ startMinutes: 0, durationMinutes: 1200, hits: 4, hitOffsetsMinutes: [10, 400, 1000, 1100] }], cost: { mode: 'owned' }, candidateUseTimes: [0] }); assert.ok(ex.ok);
    if (ex.ok) approx(ex.plans[0]!.totalDamage, Epos + 2 * Eneg + Enone);
  });
  it('disabled Pill means no Pill modifier anywhere', () => {
    const h = computeHit({ ...combat, booster: 'none' }); assert.equal(h.pillPct, 0); assert.ok(!h.usedFormulas.includes('combat.booster'));
    const base0 = analysePill({ combat, state: { kind: 'none' }, schedule: [battle(0, 60, 10)], cost: { mode: 'owned' }, candidateUseTimes: [] }); assert.ok(base0.ok);
    if (base0.ok) { approx(base0.baseline.totalDamage, 10 * E('none')); assert.equal(base0.plans.length, 0); }
  });
  it('rejects invalid schedules', () => {
    assert.ok(!analysePill({ ...base, state: { kind: 'none' }, schedule: [] }).ok);
    assert.ok(!analysePill({ ...base, state: { kind: 'none' }, schedule: [battle(0, 0, 10)] }).ok);
  });
  it('is attached to optimizer builds without changing the skill ranking', () => {
    const req = { player: { level: 30, totalPoints: 40 }, objective: { type: 'maxDamagePerHit' as const }, combat: { gear, ammo: 'none' as const, booster: 'none' as const, rankBonusPct: 0 } };
    const without = optimizeBuild(req), withPill = optimizeBuild({ ...req, pill: { state: { kind: 'none' }, schedule: [battle(0, 60, 200)], cost: { mode: 'buy', marketPrice: 5 } } });
    assert.ok(without.ok && withPill.ok); if (!without.ok || !withPill.ok) return;
    assert.deepEqual(withPill.builds.map((b) => b.levels), without.builds.map((b) => b.levels));
    const pa = withPill.builds[0]!.pill!; assert.ok(pa.ok);
    if (pa.ok) assert.ok(pa.best.deltaDamage > 0);
    assert.equal(without.builds[0]!.pill, null);
  });
});
