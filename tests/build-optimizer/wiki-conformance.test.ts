import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  AMMO, battleModifierPct, buildPlayerState, computeHit, emptyLevels, FIELD_CRATE_ODDS, FOOD_PCT, pointsEarned, rankFromDamage, RARITY_RANGES, RECIPES,
  skillValue, toOptimizeRequest, type CombatInput, type GearInput, type Levels, type ProfileLike,
} from '@/features/build-optimizer';
import { getFormula } from '@/features/build-optimizer/engine/registry';

/**
 * Tests derived DIRECTLY from the Age of Nations Wiki (project files 01-basics.md, 02-economy.md, 03-war.md). Every expectation is a number
 * worked out by hand from the quoted rule, not copied from the implementation. Where the Wiki is silent a test asserts that the engine does
 * NOT invent a rule (luck distribution, post-Prestige total).
 */
const skills = JSON.parse(readFileSync('tests/fixtures/real/player-skills.json', 'utf8')).skills as ProfileLike['skills'];
const lv = (o: Partial<Levels> = {}): Levels => ({ ...emptyLevels(), ...o });
const knife = (attack = 30, critChance = 2): GearInput => ({ weapon: { kind: 'item', stats: { attack, critChance, usesAmmo: false } } });
const hit = (o: Partial<CombatInput> = {}) => computeHit({ levels: lv(), gear: knife(), ammo: 'none', booster: 'none', rankBonusPct: 0, ...o });
const approx = (a: number, b: number, e = 1e-9) => assert.ok(Math.abs(a - b) < e, `${a} !~ ${b}`);
const out = (h: ReturnType<typeof hit>, k: 'graze' | 'clean' | 'crit') => h.outcomes.find((o) => o.kind === k)!;

describe('wiki 03-war §1.6: damage pipeline', () => {
  it('wiki: hit pipeline', () => {
    // all skills at level 0: Attack skill 100, accuracy 50, crit chance 10, crit damage 100 (01-basics §2.4); knife attack 30, crit chance 2
    const h = hit();
    assert.equal(h.attackBase, 130); // step 1: skill attack + weapon attack
    approx(h.cleanChance, 0.5); // step 3: accuracy = chance of a clean hit
    approx(h.critChance, 0.12); // step 4: crit chance = skill 10 + weapon 2
    approx(out(h, 'graze').damage, 65); approx(out(h, 'graze').probability, 0.5); // a miss is a graze: 50% damage
    approx(out(h, 'clean').damage, 130); approx(out(h, 'clean').probability, 0.5 * 0.88);
    approx(out(h, 'crit').damage, 260); approx(out(h, 'crit').probability, 0.5 * 0.12); // crit only on clean hits; adds the crit-damage percentage (+100%)
    approx(h.expected, 0.5 * 65 + 0.44 * 130 + 0.06 * 260);
    approx(h.expectedUnrounded, h.expected); // whole numbers: rounding changes nothing here
  });
  it('wiki: rounding and minimum damage', () => {
    // rank +3%: every outcome gets a fractional part. Step 7: round DOWN.
    const h = hit({ rankBonusPct: 3 });
    approx(out(h, 'graze').damage, 66.95); approx(out(h, 'clean').damage, 133.9); approx(out(h, 'crit').damage, 267.8);
    approx(h.expected, 0.5 * 66 + 0.44 * 133 + 0.06 * 267); // floors, not rounding to nearest (67/134/268)
    approx(h.expectedUnrounded, 0.5 * 66.95 + 0.44 * 133.9 + 0.06 * 267.8);
    assert.ok(h.expected < h.expectedUnrounded);
    // minimum damage 1 (rule exercised with a synthetic negative weapon value; real inputs cannot go below the Attack skill)
    const low = hit({ gear: knife(-300, 0) });
    assert.equal(low.expected, 1); assert.equal(low.minPerHit, 1);
  });
  it('wiki: luck range only', () => {
    // step 5: damage varies by up to 10% either way. The Wiki gives the RANGE, not a distribution: the engine reports the floored extremes and
    // computes the central figure with luck fixed at 1.0 instead of assuming a distribution.
    const h = hit({ rankBonusPct: 3 });
    assert.equal(h.minPerHit, Math.floor(66.95 * 0.9)); assert.equal(h.maxPerHit, Math.floor(267.8 * 1.1));
    assert.ok(h.assumptions.some((a) => a.includes('no distribution')));
    assert.ok(getFormula('combat.luck.distribution').status === 'unverified'); assert.ok(getFormula('combat.luck').status === 'documented');
    assert.ok(!h.usedFormulas.includes('combat.luck.distribution'), 'no luck distribution is used in the calculation');
  });
  it('wiki: personal boosts are summed (ammo, stimulant, rank)', () => {
    // medium ammo +25%, rank +5%, stimulant +50% -> (130) * (1 + 0.25 + 0.05 + 0.50) = 234 for a clean hit; not 130*1.25*1.05*1.5
    const h = hit({ ammo: 'medium', rankBonusPct: 5, booster: 'positive' });
    approx(out(h, 'clean').damage, 130 * 1.8); approx(h.personalMultiplier, 1.8);
    approx(hit({ ammo: 'medium', rankBonusPct: 5, booster: 'negative' }).personalMultiplier, 0.8);
  });
  it('wiki: critical damage adds a percentage (skill level 10 = 350)', () => {
    const h = hit({ levels: lv({ critDamage: 10 }) });
    assert.equal(skillValue('critDamage', 10), 350); approx(out(h, 'crit').damage, 130 * (1 + 3.5));
  });
  it('wiki: accuracy and crit chance stop at 100; the excess becomes 3 Attack / 3 Critical Damage per point', () => {
    const h = hit({ levels: lv({ accuracy: 10, critChance: 10 }), gear: { weapon: { kind: 'item', stats: { attack: 30, critChance: 60, usesAmmo: false } }, gloves: { kind: 'item', stats: { accuracy: 10 } } } });
    assert.equal(h.accuracyTotal, 120); approx(h.cleanChance, 1); assert.equal(h.attackBase, 100 + 30 + 3 * 20); // accuracy 110 + 10 -> 20 over 100
    assert.equal(h.critChanceTotal, 110); approx(h.critChance, 1); assert.equal(h.critDamageTotal, 100 + 3 * 10);
  });
  it('wiki: a firearm without ammunition contributes nothing; the knife needs none', () => {
    const pistol: GearInput = { weapon: { kind: 'item', stats: { attack: 50, critChance: 5, usesAmmo: true } } };
    assert.equal(hit({ gear: pistol, ammo: 'none' }).attackBase, 100);
    assert.equal(hit({ gear: pistol, ammo: 'light' }).attackBase, 150);
    assert.equal(hit({ gear: knife(), ammo: 'none' }).attackBase, 130);
  });
  it('wiki: battle bonus caps', () => {
    // 03-war §1.7: bonuses summed with a +100% maximum, penalties summed with a -50% maximum
    const m = (pct: number) => ({ id: `m${pct}`, label: 'x', pct, status: 'documented' as const, source: 'user' as const });
    assert.equal(battleModifierPct([m(20), m(15)]), 35);
    assert.equal(battleModifierPct([m(80), m(60)]), 100);
    assert.equal(battleModifierPct([m(-25), m(-25), m(-25)]), -50);
    assert.equal(battleModifierPct([m(120), m(-25), m(-40)]), 100 - 50); // capped bonuses + capped penalties
    const h = hit({ war: { warId: 'w', side: 'attacker', modifiers: [m(20), m(-10)] } });
    approx(h.battleMultiplier, 1.1); approx(out(h, 'clean').damage, 143);
  });
  it('wiki: health cost per hit', () => {
    // 01-basics §2.2 / 03-war §1.5: a hit costs 10 health; armor reduces it, minimum 1; armor above 45 and dodge above 36 count at 50%
    approx(hit().healthLossPerHit, 10);
    approx(hit({ gear: { ...knife(), chest: { kind: 'item', stats: { armor: 20 } } } }).healthLossPerHit, 10 * (1 - 0.2)); // armor 20 -> 20% (mapping assumed, see combat.sustain)
    const big = hit({ gear: { ...knife(), chest: { kind: 'item', stats: { armor: 40 } }, legs: { kind: 'item', stats: { armor: 25 } } } }); // 65 -> 45 + 20/2 = 55
    approx(big.healthLossPerHit, 10 * (1 - 0.55));
    approx(hit({ gear: { ...knife(), boots: { kind: 'item', stats: { dodge: 40 } } } }).dodgeProbability, (36 + 4 / 2) / 100); // dodge 40 -> 36 + 4/2
    assert.ok(getFormula('combat.sustain').status === 'estimated');
  });
});

describe('wiki 01-basics: skills, ranks, items', () => {
  it('wiki: prestige points are not guessed', () => {
    // 4 points per level above 1 (§2.1); +4 per Prestige (§2.8). The total after the level drop is NOT stated by the Wiki.
    assert.equal(pointsEarned(22), 84); assert.equal(pointsEarned(50), 196); assert.equal(pointsEarned(22, 2), 92);
    assert.equal(getFormula('skills.pointsEarned.prestigeInteraction').status, 'unverified');
    const profile: ProfileLike = { id: 'u', name: 'T', countryId: 'eg', level: 22, damage: { total: '0', day: '0', week: '0', month: '0' }, skills, hasSkills: true, rankCode: null, prestige: 7 };
    const s = buildPlayerState({ profile });
    const without = buildPlayerState({ profile: { ...profile, prestige: undefined } });
    assert.equal(s.skillPoints.exact, false); assert.equal(s.skillPoints.earned.value, without.skillPoints.earned.value); // API Prestige is displayed but never folded into the total
    assert.ok(s.skillPoints.earned.value! >= 84); assert.equal(s.prestigeCount.value, 7);
    const r = toOptimizeRequest(s, { objective: { type: 'maxDamagePerHit' } }); assert.ok(r.ok);
    if (r.ok) assert.equal(r.request.player.prestigeCount, undefined);
  });
  it('rank thresholds and attack bonuses (§2.6)', () => {
    const wiki: [bigint, string, number][] = [[0n, 'volunteer', 0], [5_000n, 'fighter', 1], [25_000n, 'veteran', 2], [100_000n, 'sergeant', 3], [400_000n, 'lieutenant', 4], [1_500_000n, 'captain', 5], [5_000_000n, 'commander', 6], [15_000_000n, 'colonel', 7], [50_000_000n, 'general', 8], [200_000_000n, 'warlord', 12]];
    for (const [d, code, pct] of wiki) { assert.deepEqual([rankFromDamage(d).code, rankFromDamage(d).bonusPct], [code, pct]); if (d > 0n) assert.equal(rankFromDamage(d - 1n).code === code, false); }
  });
  it('ammunition and food (§3.5, §2.3)', () => {
    assert.deepEqual({ light: AMMO.light, medium: AMMO.medium, heavy: AMMO.heavy }, { light: { pct: 12, lead: 1 }, medium: { pct: 25, lead: 3 }, heavy: { pct: 45, lead: 12 } });
    assert.deepEqual(FOOD_PCT, { bread: 12, steak: 18, cookedFish: 25 });
  });
  it('rarity stat ranges (§3.3)', () => {
    const w: Record<string, [number, number, number, number]> = { common: [20, 35, 2, 6], uncommon: [45, 65, 5, 9], rare: [75, 100, 10, 16], epic: [110, 145, 15, 22], legendary: [150, 190, 24, 32], mythic: [230, 320, 38, 48] };
    const h: Record<string, [number, number]> = { common: [1, 12], uncommon: [12, 28], rare: [28, 48], epic: [48, 72], legendary: [72, 100], mythic: [100, 135] };
    const a: Record<string, [number, number]> = { common: [1, 6], uncommon: [6, 14], rare: [14, 24], epic: [24, 36], legendary: [36, 50], mythic: [50, 67] };
    for (const r of Object.keys(w) as (keyof typeof RARITY_RANGES)[]) {
      const t = RARITY_RANGES[r]; const x = w[r]!;
      assert.deepEqual([...t.weaponAttack, ...t.weaponCrit], x); assert.deepEqual([...t.helmetCritDamage], h[r]);
      for (const k of ['armor', 'dodge', 'accuracy'] as const) assert.deepEqual([...t[k]], a[r]);
    }
  });
  it('Field Crate odds and recipes (§4.4, 02-economy §1.2)', () => {
    assert.deepEqual(FIELD_CRATE_ODDS, { common: 0.55, uncommon: 0.28, rare: 0.12, epic: 0.04, legendary: 0.009, mythic: 0.001 });
    const r = RECIPES; assert.equal(r.concrete!.pointsPerUnit, 8); assert.deepEqual(r.concrete!.ingredients, [{ itemCode: 'limestone', qty: 8 }]);
    assert.equal(r.steak!.pointsPerUnit, 18); assert.equal(r.cookedFish!.pointsPerUnit, 36); assert.equal(r.stimulant!.pointsPerUnit, 150); assert.equal(r.fuelCell!.pointsPerUnit, 100);
    assert.deepEqual([r.lightBullets!.pointsPerUnit, r.mediumBullets!.pointsPerUnit, r.heavyBullets!.pointsPerUnit], [1, 3, 12]);
  });
});
