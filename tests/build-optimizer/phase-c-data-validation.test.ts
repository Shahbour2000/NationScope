import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildPlayerState, buildMarketSnapshot, economyPrices, offersToCandidates, importForBuild,
  type ImportDeps, type MarketRowLike, type OfferLike, type ProfileLike,
} from '@/features/build-optimizer';
import { parsePlayer } from '@/lib/domain/player';
import { parseOptimizeInput, type OptimizeInput } from '@/features/build-optimizer/api-schema';
import { runOptimization, userInputsOf } from '@/features/build-optimizer/run';

/**
 * Batch 5 / Phase C: player, equipment and market data handling.
 * Fixtures: tests/fixtures/real/* are recorded responses (2026-10-17); tests/fixtures/synthetic/* are SYNTHETIC (see its _meta).
 * No recorded GET /players/{id} response exists in the repository, so profile cases are synthetic and say so.
 */
const real = (f: string) => JSON.parse(readFileSync(`tests/fixtures/real/${f}`, 'utf8'));
const syn = JSON.parse(readFileSync('tests/fixtures/synthetic/player-equipment-market-cases.json', 'utf8'));
const skills = real('player-skills.json').skills as ProfileLike['skills'];
const profileOf = (raw: unknown, withSkills = true): ProfileLike => {
  const p = parsePlayer(raw, 'https://a')!;
  return { ...p, skills: withSkills ? skills : p.skills, hasSkills: withSkills ? true : p.hasSkills } as ProfileLike;
};
const base = (o: Partial<ProfileLike> = {}): ProfileLike => ({ id: 'usr_1', name: 'T', countryId: 'eg', level: 22, damage: { total: '2549826', day: null, week: null, month: null }, skills, hasSkills: true, rankCode: null, ...o });
const offer = (o: Partial<OfferLike>): OfferLike => ({ offerId: 'o', itemCode: 'helmet2', rarity: 'uncommon', slot: 'helmet', stats: { criticalDamages: 10 }, durability: 100, price: '100000', ...o });

describe('profile import: complete, partial and null synthetic profiles', () => {
  it('SYNTHETIC complete profile: skills, rank, six-slot equipment and damage are read; Prestige stays display-only', () => {
    const s = buildPlayerState({ profile: profileOf(syn.profiles.complete) });
    assert.equal(s.level.value, 22); assert.equal(s.level.source, 'api');
    assert.equal(s.skills.levels.source, 'api');
    assert.equal(s.equipment.snapshot.completeness, 'complete');
    assert.equal(s.gear.source, 'api');
    assert.equal(s.prestigeCount.value, 0); assert.equal(s.prestigeCount.source, 'api');
    assert.equal(s.skillPoints.exact, false, 'API Prestige 0 is not used to declare the point total exact');
    assert.equal(s.rank.bonusPct.value, 5); assert.equal(s.rank.bonusPct.source, 'api');
    assert.equal(s.equipment.snapshot.slots.pants.durability, 77);
  });
  it('SYNTHETIC partial profile (identity only): everything else is unavailable, never zero', () => {
    const s = buildPlayerState({ profile: profileOf(syn.profiles.partial, false) });
    assert.equal(s.level.value, null); assert.equal(s.level.source, 'unavailable');
    assert.equal(s.skills.levels.value, null);
    assert.equal(s.prestigeCount.value, null);
    assert.equal(s.rank.bonusPct.value, null); assert.equal(s.rank.name.value, null);
    assert.equal(s.gear.value, null); assert.equal(s.equipment.snapshot.reported, false); assert.equal(s.equipment.snapshot.completeness, 'unknown');
    assert.equal(s.economy.value, null); assert.equal(s.skillPoints.earned.value, null); assert.equal(s.skillPoints.available.value, null);
    for (const m of ['level', 'skills', 'rank bonus']) assert.ok(s.missing.includes(m), m);
  });
  it('SYNTHETIC explicit nulls behave exactly like absent fields', () => {
    const s = buildPlayerState({ profile: profileOf(syn.profiles.nulls, false) });
    assert.equal(s.level.value, null); assert.equal(s.prestigeCount.value, null); assert.equal(s.rank.bonusPct.value, null);
    assert.equal(s.equipment.snapshot.reported, false); assert.equal(s.economy.value, null); assert.equal(s.countryId, null);
  });
  it('stats not loaded is unavailable; an empty stats object is "loaded, nothing readable", not missing', () => {
    assert.equal(buildPlayerState({ profile: base() }).stats.source, 'unavailable');
    const s = buildPlayerState({ profile: base(), statsRaw: {} });
    assert.equal(s.stats.source, 'api'); assert.deepEqual(s.stats.value, {});
  });
});

describe('REGRESSION: unusable profile level no longer crashes the import', () => {
  // Before the fix: buildPlayerState threw RangeError('playerLevel must be >= 1') for level 0 / negative, and produced fractional point totals for 1.5.
  for (const bad of [0, -3, 1.5, Number.NaN, Infinity]) {
    it(`level ${String(bad)} is reported as unavailable with a warning (not thrown, not clamped)`, () => {
      const s = buildPlayerState({ profile: base({ level: bad }) });
      assert.equal(s.level.value, null); assert.equal(s.level.source, 'unavailable');
      assert.ok(s.missing.includes('level'));
      assert.ok(s.warnings.some((w) => w.includes('not a whole number')));
      assert.equal(s.skillPoints.earned.value, null); assert.equal(s.skillPoints.available.value, null);
    });
  }
  it('a valid user level still overrides an unusable API level; an unusable user level is not silently replaced by the API one', () => {
    assert.equal(buildPlayerState({ profile: base({ level: 0 }), user: { level: 22 } }).level.value, 22);
    const s = buildPlayerState({ profile: base({ level: 22 }), user: { level: 0 } });
    assert.equal(s.level.value, null); assert.ok(s.warnings.length > 0);
  });
  it('level above the documented maximum of 50 is kept but warned', () => {
    const s = buildPlayerState({ profile: base({ level: 51 }) });
    assert.equal(s.level.value, 51); assert.ok(s.warnings.some((w) => w.includes('maximum of 50')));
  });
});

describe('REGRESSION: duplicate skill rows', () => {
  // Before the fix: the first row silently won, whatever the second said.
  it('rows that disagree make that skill unknown (no silent choice) and the build blocks unless the user supplies it', () => {
    const dup = [...skills, { code: 'attack', level: 9, maxLevel: 10 }];
    const s = buildPlayerState({ profile: base({ skills: dup }) });
    assert.equal(s.skills.levels.value, null); assert.ok(s.missing.includes('skills'));
    assert.ok(s.warnings.some((w) => w.includes('attack') && w.includes('different levels')));
    const fixed = buildPlayerState({ profile: base({ skills: dup }), user: { skillLevels: { attack: 5 } } });
    assert.equal(fixed.skills.levels.value?.attack, 5); assert.equal(fixed.skills.levels.source, 'user');
  });
  it('identical duplicate rows are harmless and silent', () => {
    const s = buildPlayerState({ profile: base({ skills: [...skills, { code: 'attack', level: 5, maxLevel: 10 }] }) });
    assert.equal(s.skills.levels.source, 'api'); assert.equal(s.skills.levels.value?.attack, 5);
    assert.ok(!s.warnings.some((w) => w.includes('different levels')));
  });
  it('an out-of-range skill level is never used (and never becomes 0)', () => {
    const s = buildPlayerState({ profile: base({ skills: skills.map((k) => (k.code === 'dodge' ? { ...k, level: 11 } : k)) }) });
    assert.equal(s.skills.levels.value, null); assert.ok(s.warnings.some((w) => w.includes('dodge')));
  });
});

describe('equipment snapshot: edge cases', () => {
  const edges = () => buildPlayerState({ profile: profileOf(syn.profiles.equipmentEdgeCases) }).equipment.snapshot;
  it('SYNTHETIC edge snapshot: duplicate, invalid, null-stats, unknown-slot, non-object and slot-less rows are each reported', () => {
    const e = edges();
    assert.equal(e.slots.weapon.status, 'present'); assert.equal(e.slots.gloves.status, 'present');
    assert.equal(e.slots.helmet.status, 'duplicate'); assert.equal(e.slots.helmet.item, null);
    assert.equal(e.slots.chest.status, 'invalid'); assert.deepEqual(e.slots.chest.problems, ['invalid-stats']);
    assert.equal(e.slots.pants.status, 'invalid'); assert.ok(e.slots.pants.problems.some((p) => p.startsWith('missing-stat:')));
    assert.equal(e.slots.boots.status, 'missing', 'a slot-less row cannot be attributed to boots');
    assert.deepEqual(e.unrecognized.map((u) => u.slot), ['cape']);
    assert.equal(e.completeness, 'partial'); assert.equal(e.counts.present, 2);
    assert.ok(e.rejected.length >= 2, 'the non-object row and the slot-less row are kept as issues');
  });
  it('REGRESSION: a negative gear stat is invalid, never used and never clamped (before: slot was "present" with armor -4)', () => {
    const e = buildPlayerState({ profile: base({ equipment: [{ slot: 'chest', itemCode: 'chest1', rarity: 'common', stats: { armor: -4 }, durability: 100 }] }) }).equipment.snapshot;
    assert.equal(e.slots.chest.status, 'invalid'); assert.equal(e.slots.chest.item, null);
  });
  it('an unresolved partial snapshot never yields gear; the user can fill the gaps slot by slot', () => {
    const s = buildPlayerState({ profile: profileOf(syn.profiles.equipmentEdgeCases) });
    assert.equal(s.gear.value, null); assert.ok(s.missing.some((m) => m.startsWith('usable equipped gear')));
  });
  it('ammo compatibility: only the documented knife code is ammo-free; the real weapon code "gun" needs ammo', () => {
    const w = (itemCode: string) => buildPlayerState({ profile: base({ equipment: [{ slot: 'weapon', itemCode, rarity: 'common', stats: { attack: 30, criticalChance: 4 }, durability: 100 }] }) }).equipment.snapshot.slots.weapon.item;
    assert.equal((w('gun') as { stats: { usesAmmo: boolean } }).stats.usesAmmo, true);
    assert.equal((w('knife') as { stats: { usesAmmo: boolean } }).stats.usesAmmo, false);
  });
});

describe('market snapshot: price and currency handling', () => {
  it('recorded market: a null ask stays unknown and is never a price of 0', () => {
    const rows = (Array.isArray(real('market.json')) ? real('market.json') : real('market.json').items) as MarketRowLike[];
    const m = buildMarketSnapshot(rows);
    assert.equal(m.ask['livestock'], null); assert.ok(m.last['livestock']! > 0);
    assert.ok(m.ask['lead']! > 0);
    assert.equal(economyPrices(m).livestock?.buy, undefined);
  });
  it('currency: every recorded row is "money" (gold) and the importer only requests the global market', () => {
    const rows = (Array.isArray(real('market.json')) ? real('market.json') : real('market.json').items) as { currency: string }[];
    assert.deepEqual([...new Set(rows.map((r) => r.currency))], ['money']);
  });
  it('REGRESSION (SYNTHETIC rows): zero, negative and malformed prices are unknown, never free (before: ask 0 became a free buy price)', () => {
    const m = buildMarketSnapshot(syn.marketRows as MarketRowLike[]);
    assert.equal(m.ask['steak'], null); assert.equal(m.bid['steak'], null); assert.equal(m.last['steak'], null);
    assert.equal(m.last['bread'], 0.12); assert.equal(m.ask['bread'], null);
    assert.equal(economyPrices(m).steak?.buy, undefined); assert.equal(economyPrices(m).steak?.sell, undefined);
  });
});

describe('market offers -> candidates', () => {
  it('recorded offers: nothing valid is rejected and no offer is reported as owned', () => {
    const c = offersToCandidates(real('equipment-offers.json').offers as OfferLike[]);
    assert.equal(c.skipped.length, 0);
    assert.ok((c.candidates.weapons?.length ?? 0) > 0);
    const w = c.candidates.weapons![0] as { stats: { usesAmmo: boolean } };
    assert.equal(w.stats.usesAmmo, true, 'real weapon code "gun" is a firearm');
  });
  it('REGRESSION: price 0, a negative price and a malformed price are rejected with a reason (before: 0 = free item, malformed = the whole import threw)', () => {
    const c = offersToCandidates([syn.offers.valid, syn.offers.zeroPrice, syn.offers.negativePrice, syn.offers.malformedPrice]);
    assert.deepEqual(c.candidates.helmets!.map((h) => h.id), ['iof_syn_1']);
    assert.deepEqual(c.skipped.map((x) => x.offerId).sort(), ['iof_syn_bad', 'iof_syn_neg', 'iof_syn_zero']);
    assert.ok(c.skipped.every((x) => x.reason.startsWith('invalid price')));
  });
  it('REGRESSION: a negative stat is rejected (before: an item with armor -3 was a candidate)', () => {
    const c = offersToCandidates([syn.offers.negativeStat, offer({ offerId: 'ok', slot: 'chest', itemCode: 'chest1', stats: { armor: 2 } })]);
    assert.deepEqual(c.candidates.chests!.map((x) => x.id), ['ok']); assert.equal(c.skipped[0]!.reason, 'missing stat values');
  });
  it('incomplete offers (missing stat, null durability, unknown slot) are rejected with a reason, never defaulted', () => {
    const c = offersToCandidates([syn.offers.missingStat, syn.offers.nullDurability, syn.offers.unknownSlot]);
    assert.deepEqual(c.skipped.map((x) => x.reason), ['missing stat values', 'durability unknown or too low', 'unknown slot cape']);
    assert.deepEqual(c.candidates.weapons, []);
  });
  it('REGRESSION: identical duplicate offer ids are one offer; conflicting ones are all rejected (before: both were candidates)', () => {
    const a = offer({ offerId: 'dup', price: '100000' });
    const same = offersToCandidates([a, { ...a }, offer({ offerId: 'z', stats: { criticalDamages: 30 }, price: '200000' })]);
    assert.deepEqual(same.candidates.helmets!.map((h) => h.id).sort(), ['dup', 'z']);
    const diff = offersToCandidates([a, { ...a, price: '1' }, offer({ offerId: 'z', stats: { criticalDamages: 30 }, price: '200000' })]);
    assert.deepEqual(diff.candidates.helmets!.map((h) => h.id), ['z']);
    assert.equal(diff.skipped.filter((x) => x.offerId === 'dup').length, 2);
  });
  it('a worn item (durability below the minimum) is rejected; durability is data, not a price discount', () => {
    const c = offersToCandidates([offer({ offerId: 'w', durability: 0 }), offer({ offerId: 'ok2' })]);
    assert.deepEqual(c.candidates.helmets!.map((h) => h.id), ['ok2']);
  });
  it('FINDING (disclosed, behaviour unchanged): the per-slot cap keeps the cheapest, so the strongest Pareto offers can be dropped', () => {
    const many = Array.from({ length: 9 }, (_, i) => offer({ offerId: `h${i}`, stats: { criticalDamages: 10 + i }, price: String((i + 1) * 100000) }));
    const c = offersToCandidates(many);
    assert.equal(c.candidates.helmets!.length, 6);
    assert.ok(!c.candidates.helmets!.some((h) => h.id === 'h8'), 'the strongest (dearest) helmet is not a candidate');
    assert.equal(c.prunedAway['helmets'], 3);
    assert.ok(c.assumptions.some((a) => a.includes('helmets') && a.includes('3')), 'and the loss is stated');
    assert.equal(offersToCandidates(many, { maxPerSlot: 9 }).candidates.helmets!.some((h) => h.id === 'h8'), true);
    assert.deepEqual(offersToCandidates(many.slice(0, 4)).prunedAway, {});
  });
});

describe('importer: coverage and partial failures are recorded, never hidden', () => {
  const deps = (over: Partial<ImportDeps> = {}): ImportDeps => ({
    profile: async () => ({ player: base() }), companies: async () => ({ rows: [] }), stats: async () => ({}), market: async () => ({ rows: [] }),
    offers: async (slot) => ({ rows: [offer({ offerId: `${slot}-1`, slot, stats: slot === 'weapon' ? { attack: 50, criticalChance: 8 } : slot === 'gloves' ? { precision: 4 } : slot === 'helmet' ? { criticalDamages: 5 } : slot === 'boots' ? { dodge: 3 } : { armor: 3 } }) ] }),
    ...over,
  });
  it('a reported next page is recorded as "more available"; no next page is not', async () => {
    const imp = await importForBuild('usr_1', deps({ offers: async (slot) => ({ rows: [offer({ offerId: `${slot}-1`, slot, stats: { criticalDamages: 5 } })], nextOffset: slot === 'helmet' ? 30 : null }) }));
    assert.equal(imp!.offerCoverage!['helmet']!.moreAvailable, true); assert.equal(imp!.offerCoverage!['helmet']!.fetched, 1);
    assert.equal(imp!.offerCoverage!['boots']!.moreAvailable, false);
  });
  it('a slot whose offers fail to load is a recorded failure with no coverage entry; the rest of the import survives', async () => {
    const imp = await importForBuild('usr_1', deps({ offers: async (slot) => { if (slot === 'weapon') throw new Error('boom'); return { rows: [] }; } }));
    assert.equal(imp!.failures['equipment:weapon'], 'boom'); assert.equal(imp!.offerCoverage!['weapon'], undefined);
    assert.equal(imp!.state.level.value, 22);
  });
  it('REGRESSION: one malformed offer price no longer makes the whole import throw', async () => {
    const imp = await importForBuild('usr_1', deps({ offers: async (slot) => ({ rows: slot === 'helmet' ? [syn.offers.malformedPrice, syn.offers.valid] : [] }) }));
    assert.ok(imp); assert.deepEqual(imp!.candidates!.candidates.helmets!.map((h) => h.id), ['iof_syn_1']);
  });
  it('an unusable level in the profile no longer makes the whole import throw', async () => {
    const imp = await importForBuild('usr_1', deps({ profile: async () => ({ player: base({ level: 0 }) }) }));
    assert.equal(imp!.state.level.value, null);
  });
});

describe('optimization run: what the market search could not see is stated in the result notes', () => {
  const FOOD = [{ type: 'bread', price: 0.5 }];
  const input = (): OptimizeInput => { const r = parseOptimizeInput({ playerId: 'usr_1', mode: 'war', user: { availableSkillPoints: 6 }, war: { kind: 'fixedHits', hits: 20, gearMode: 'optimize', ammo: ['none', 'light'], food: FOOD, objective: { kind: 'maxDamage' } } }); assert.ok(r.ok, JSON.stringify(r)); return (r as { ok: true; value: OptimizeInput }).value; };
  const weapons = Array.from({ length: 9 }, (_, i) => offer({ offerId: `w${i}`, slot: 'weapon', itemCode: 'gun', stats: { attack: 40 + i * 5, criticalChance: 5 }, price: String((i + 1) * 200000) }));
  const deps: ImportDeps = {
    profile: async () => ({ player: base() }), companies: async () => ({ rows: [] }), stats: async () => ({}),
    market: async () => ({ rows: real('market.json') as MarketRowLike[] }),
    offers: async (slot) => {
      if (slot === 'helmet') throw new Error('timeout');
      if (slot === 'weapon') return { rows: [...weapons, syn.offers.malformedPrice], nextOffset: 30 };
      return { rows: [] };
    },
  };
  it('failed slots, an unread next page, the per-slot cap and rejected offers each appear in the notes', async () => {
    const inp = input(); const imp = await importForBuild('usr_1', deps, userInputsOf(inp)); assert.ok(imp);
    const res = runOptimization(imp!, inp); assert.ok(res.ok, JSON.stringify(res));
    const notes = (res as { notes: string[] }).notes.join(' | ');
    assert.ok(notes.includes('could not be loaded for: helmet'), notes);
    assert.ok(notes.includes('Only the cheapest market offers were read for: weapon (10 cheapest read)') || notes.includes('weapon (10 cheapest read)'), notes);
    assert.ok(notes.includes('per-slot candidate cap') && notes.includes('weapons (3 dearer)'), notes);
    assert.ok(notes.includes('1 market offer(s) were ignored'), notes);
  });
  it('a clean, complete import adds none of those notes', async () => {
    const clean: ImportDeps = { ...deps, offers: async (slot) => ({ rows: slot === 'weapon' ? weapons.slice(0, 3) : [], nextOffset: null }) };
    const inp = input(); const imp = await importForBuild('usr_1', clean, userInputsOf(inp));
    const res = runOptimization(imp!, inp); assert.ok(res.ok);
    const notes = (res as { notes: string[] }).notes.join(' | ');
    for (const frag of ['could not be loaded', 'Only the cheapest', 'per-slot candidate cap', 'ignored as unusable']) assert.ok(!notes.includes(frag), frag);
  });
});
