import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { emptyLevels, evaluateLoadouts, offersToCandidates, type OfferLike } from '@/features/build-optimizer';

/**
 * Regression: the per-slot Pareto pruning compared weapons only on attack, crit chance, durability and price. A cheaper, stronger firearm
 * therefore "dominated" a knife and removed it, although the knife needs no ammunition (Wiki 01-basics §3.5: every weapon except the knife
 * needs ammunition; a firearm without ammo contributes nothing). "Needs no ammo" is an advantage and must be part of the dominance test.
 */
const price = (gold: number) => String(gold * 10_000); // API money: 1/10,000 gold
const weapon = (offerId: string, itemCode: string, attack: number, crit: number, gold: number, durability = 100): OfferLike =>
  ({ offerId, itemCode, rarity: 'common', slot: 'weapon', stats: { attack, criticalChance: crit }, durability, price: price(gold) });
const ids = (xs: { id: string }[]) => xs.map((x) => x.id).sort();

describe('usesAmmo pruning bug (regression)', () => {
  it('a cheaper, stronger firearm does NOT prune a knife that needs no ammunition', () => {
    const { candidates } = offersToCandidates([weapon('knife1', 'knife', 30, 2, 10), weapon('pistol1', 'pistol', 50, 5, 5)]);
    assert.deepEqual(ids(candidates.weapons), ['knife1', 'pistol1']);
    assert.equal(candidates.weapons.find((w) => w.id === 'knife1')!.stats.usesAmmo, false);
    assert.equal(candidates.weapons.find((w) => w.id === 'pistol1')!.stats.usesAmmo, true);
  });
  it('an ammo-free weapon that is at least as good on every stat and not dearer still prunes a worse firearm', () => {
    const { candidates } = offersToCandidates([weapon('knife1', 'knife', 60, 6, 5), weapon('pistol1', 'pistol', 50, 5, 5)]);
    assert.deepEqual(ids(candidates.weapons), ['knife1']);
  });
  it('dominance between two firearms is unchanged', () => {
    const { candidates } = offersToCandidates([weapon('a', 'pistol', 50, 5, 5), weapon('b', 'pistol', 40, 4, 9), weapon('c', 'rifle', 80, 8, 20)]);
    assert.deepEqual(ids(candidates.weapons), ['a', 'c']);
  });
  it('dominance between two knives is unchanged', () => {
    const { candidates } = offersToCandidates([weapon('k1', 'knife', 30, 2, 10), weapon('k2', 'knife', 25, 2, 12)]);
    assert.deepEqual(ids(candidates.weapons), ['k1']);
  });
  it('the kept knife is usable when no ammunition is allowed, while the firearm alone would not be (the bug had real consequences)', () => {
    const { candidates } = offersToCandidates([weapon('knife1', 'knife', 30, 2, 10), weapon('pistol1', 'pistol', 50, 5, 5)]);
    const r = evaluateLoadouts(candidates, { levels: emptyLevels(), booster: 'none', hits: 10, ammoOptions: ['none'], objective: 'maxDamage' });
    assert.ok(r.ok); if (!r.ok) return;
    const best = r.results[0]!;
    assert.equal(best.ids.weapon, 'knife1'); assert.equal(best.ammo, 'none'); assert.ok(best.expectedDamage > 0);
    const pistolWithoutAmmo = r.results.find((x) => x.ids.weapon === 'pistol1');
    assert.ok(!pistolWithoutAmmo || pistolWithoutAmmo.expectedDamage < best.expectedDamage, 'a firearm without ammo contributes nothing');
  });
});
