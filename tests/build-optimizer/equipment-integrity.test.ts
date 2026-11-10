import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  buildEquipmentSnapshot, buildPlayerState, importForBuild, toOptimizeRequest, toWarBuildRequest,
  type CompanyLike, type ImportDeps, type MarketRowLike, type OfferLike, type PlayerEquipmentLike, type ProfileLike,
} from '@/features/build-optimizer';
import { parseOptimizeInput, type OptimizeInput } from '@/features/build-optimizer/api-schema';
import { runOptimization, userInputsOf } from '@/features/build-optimizer/run';
import { importViewModel } from '@/features/build-optimizer/view-model';
import { EquipmentStatus } from '@/features/build-optimizer/ui/EquipmentStatus';
import { defaultForm, type SlotForm } from '@/features/build-optimizer/ui/form';
import { getBuilderMessages } from '@/features/build-optimizer/ui/messages';
import { en } from '@/features/build-optimizer/ui/messages.en';
import { ar } from '@/features/build-optimizer/ui/messages.ar';
import { parsePlayer } from '@/lib/domain/player';

const fx = (f: string) => JSON.parse(readFileSync(`tests/fixtures/real/${f}`, 'utf8'));
const skills = fx('player-skills.json').skills as ProfileLike['skills'];
const profile = (o: Partial<ProfileLike> = {}): ProfileLike => ({ id: 'usr_1', name: 'Tester', countryId: 'eg', level: 22, damage: { total: '2549826', day: '0', week: '0', month: '0' }, skills, hasSkills: true, rankCode: null, ...o });
const row = (slot: string, stats: Record<string, number> | null, o: Partial<PlayerEquipmentLike> = {}): PlayerEquipmentLike => ({ slot, itemCode: `${slot}-item`, rarity: 'common', stats, durability: 90, ...o });
const SIX = (): PlayerEquipmentLike[] => [
  row('weapon', { attack: 70, criticalChance: 10 }, { itemCode: 'pistol', durability: 82 }), row('helmet', { criticalDamages: 12 }), row('gloves', { precision: 3 }),
  row('chest', { armor: 4 }), row('pants', { armor: 5 }), row('boots', { dodge: 2 }),
];
const without = (slot: string) => SIX().filter((r) => r.slot !== slot);

describe('equipment snapshot: completeness and per-slot status', () => {
  it('a complete six-slot snapshot keeps the existing behavior: one complete api gear, durability preserved as data', () => {
    const snap = buildEquipmentSnapshot(SIX());
    assert.equal(snap.completeness, 'complete'); assert.deepEqual(snap.counts, { present: 6, missing: 0, invalid: 0, duplicate: 0 }); assert.deepEqual(snap.warnings, []);
    const s = buildPlayerState({ profile: profile({ equipment: SIX() }) });
    assert.equal(s.gear.source, 'api'); assert.equal(s.equipment.resolved.completeness, 'complete');
    assert.deepEqual(s.gear.value!.weapon, { kind: 'item', stats: { attack: 70, critChance: 10, usesAmmo: true } });
    assert.deepEqual(s.gear.value!.legs, { kind: 'item', stats: { armor: 5 } }); // API "pants" -> engine "legs"
    assert.equal(s.equipment.resolved.slots.weapon.durability, 82); assert.equal(s.equipment.snapshot.slots.weapon.durability, 82);
    assert.ok(!JSON.stringify(s.gear.value).includes('82'), 'durability is data only: it is not copied into the engine gear');
  });
  it('knife is the documented no-ammo exception (wiki 01-basics 3.5)', () => {
    const rows = SIX().map((r) => (r.slot === 'weapon' ? { ...r, itemCode: 'knife' } : r));
    assert.deepEqual(buildPlayerState({ profile: profile({ equipment: rows }) }).gear.value!.weapon, { kind: 'item', stats: { attack: 70, critChance: 10, usesAmmo: false } });
  });
  it('a five-slot snapshot (the real production shape) is partial: the missing slot is unknown, never empty, and no loadout is produced', () => {
    const snap = buildEquipmentSnapshot(without('pants'));
    assert.equal(snap.completeness, 'partial'); assert.equal(snap.slots.pants.status, 'missing'); assert.equal(snap.counts.present, 5);
    assert.ok(snap.warnings.some((w) => w.includes('partial') && w.includes('pants') && w.includes('not empty')));
    const s = buildPlayerState({ profile: profile({ equipment: without('pants') }) });
    assert.equal(s.gear.value, null); assert.equal(s.gear.source, 'unavailable'); assert.deepEqual(s.equipment.resolved.unresolved, ['legs']);
    assert.equal(s.equipment.resolved.slots.legs.status, 'missing'); assert.notEqual(s.equipment.resolved.slots.legs.status, 'explicitEmpty');
    assert.ok(s.missing.some((m) => m.includes('legs') && m.includes('partial')));
    assert.equal(s.equipmentSnapshot.value!.length, 5, 'the raw snapshot rows are still retained');
  });
  it('no block, null block and an empty list are all "unknown", and an absent block is distinguishable from an empty list', () => {
    const cases: (PlayerEquipmentLike[] | null | undefined)[] = [undefined, null, []];
    for (const equipment of cases) {
      const s = buildPlayerState({ profile: profile({ equipment }) });
      assert.equal(s.gear.value, null); assert.equal(s.equipment.snapshot.completeness, 'unknown'); assert.equal(s.equipment.resolved.unresolved.length, 6);
    }
    assert.equal(buildEquipmentSnapshot(null).reported, false); assert.equal(buildEquipmentSnapshot([]).reported, true);
    assert.deepEqual(buildPlayerState({ profile: profile({ equipment: null }) }).warnings.filter((w) => w.includes('equipment')), [], 'an absent block adds a missing-input entry, not a warning');
  });
  it('a slot reported more than once is "duplicate": none of its rows is used, all are kept, and it is never resolved silently', () => {
    for (const extra of [1, 2]) {
      const rows = [...SIX(), ...Array.from({ length: extra }, (_, i) => row('helmet', { criticalDamages: 20 + i }))];
      const snap = buildEquipmentSnapshot(rows);
      assert.equal(snap.slots.helmet.status, 'duplicate'); assert.equal(snap.slots.helmet.entries.length, 1 + extra); assert.equal(snap.slots.helmet.item, null);
      assert.equal(snap.completeness, 'partial'); assert.ok(snap.warnings.some((w) => w.includes('helmet') && w.includes('more than once')));
      assert.equal(buildPlayerState({ profile: profile({ equipment: rows }) }).gear.value, null);
    }
  });
  it('invalid rows are preserved with a reason instead of being dropped or defaulted to 0', () => {
    const snap = buildEquipmentSnapshot([
      row('weapon', { attack: 70 }), row('helmet', null), row('gloves', { precision: Number.NaN }), row('chest', { armor: 4 }), row('pants', { armor: Number.POSITIVE_INFINITY }),
      row('boots', { dodge: 2 }), row('cape', { armor: 1 }),
    ], [{ index: 7, slot: 'boots', reason: 'invalid-stats' }]);
    assert.equal(snap.slots.weapon.status, 'invalid'); assert.deepEqual(snap.slots.weapon.problems, ['missing-stat:criticalChance']);
    assert.equal(snap.slots.helmet.status, 'invalid'); assert.equal(snap.slots.gloves.status, 'invalid'); assert.equal(snap.slots.pants.status, 'invalid');
    assert.equal(snap.slots.boots.status, 'duplicate', 'a valid boots row plus a rejected boots row is a conflict, not a silent pick');
    assert.equal(snap.slots.chest.status, 'present');
    assert.deepEqual(snap.unrecognized.map((u) => u.slot), ['cape']); assert.ok(snap.warnings.some((w) => w.includes('cape')));
    assert.equal(snap.rejected.length, 1);
    const onlyRejected = buildEquipmentSnapshot(without('boots'), [{ index: 5, slot: 'boots', reason: 'invalid-stats' }]);
    assert.equal(onlyRejected.slots.boots.status, 'invalid'); assert.deepEqual(onlyRejected.slots.boots.problems, ['invalid-stats']);
  });
  it('durability is kept exactly as reported; odd values only warn and are never interpreted', () => {
    const rows = SIX().map((r) => (r.slot === 'helmet' ? { ...r, durability: 150 } : r.slot === 'gloves' ? { ...r, durability: null } : r));
    const snap = buildEquipmentSnapshot(rows);
    assert.equal(snap.slots.helmet.durability, 150); assert.equal(snap.slots.helmet.status, 'present'); assert.equal(snap.slots.gloves.durability, null); assert.equal(snap.slots.gloves.status, 'present');
    assert.ok(snap.warnings.some((w) => w.includes('helmet') && w.includes('150')));
    assert.equal(snap.completeness, 'complete');
  });
});

describe('user slot-level overrides and fill-ins', () => {
  const weapon = { kind: 'item', stats: { attack: 90, critChance: 12, usesAmmo: true } } as const;
  it('a user value fills a missing slot only; the merged loadout is complete and labelled by source', () => {
    const s = buildPlayerState({ profile: profile({ equipment: without('pants') }), user: { gear: { legs: { kind: 'item', stats: { armor: 9 } } } } });
    assert.equal(s.equipment.resolved.completeness, 'complete'); assert.deepEqual(s.gear.value!.legs, { kind: 'item', stats: { armor: 9 } });
    assert.equal(s.gear.source, 'derived'); assert.deepEqual(s.equipment.resolved.sources.user, ['legs']); assert.equal(s.equipment.resolved.sources.api.length, 5);
    assert.deepEqual(s.gear.value!.weapon, { kind: 'item', stats: { attack: 70, critChance: 10, usesAmmo: true } });
  });
  it('a user value overrides a usable API slot for that slot only, and the replacement is reported', () => {
    const s = buildPlayerState({ profile: profile({ equipment: SIX() }), user: { gear: { weapon } } });
    assert.deepEqual(s.gear.value!.weapon, weapon); assert.deepEqual(s.equipment.resolved.overridden, ['weapon']);
    assert.deepEqual(s.gear.value!.helmet, { kind: 'item', stats: { critDamage: 12 } });
    assert.ok(s.warnings.some((w) => w.includes('replaced') && w.includes('weapon')));
  });
  it('only the user can declare a slot empty: explicitEmpty is user-sourced, never inferred from a missing API row', () => {
    const s = buildPlayerState({ profile: profile({ equipment: without('boots') }), user: { gear: { boots: { kind: 'empty' } } } });
    assert.equal(s.equipment.resolved.slots.boots.status, 'explicitEmpty'); assert.equal(s.equipment.resolved.slots.boots.source, 'user'); assert.deepEqual(s.gear.value!.boots, { kind: 'empty' });
    assert.equal(s.equipment.snapshot.slots.boots.status, 'missing');
  });
  it('user slots alone never form a complete loadout unless all six are resolved; a complete user gear behaves as before', () => {
    const partial = buildPlayerState({ profile: profile(), user: { gear: { weapon } } });
    assert.equal(partial.gear.value, null); assert.equal(partial.equipment.resolved.completeness, 'partial'); assert.equal(partial.equipment.resolved.unresolved.length, 5);
    const all6 = { weapon, helmet: { kind: 'empty' }, gloves: { kind: 'empty' }, chest: { kind: 'empty' }, legs: { kind: 'empty' }, boots: { kind: 'empty' } } as const;
    const full = buildPlayerState({ profile: profile({ equipment: without('pants') }), user: { gear: all6 } });
    assert.equal(full.gear.source, 'user'); assert.deepEqual(full.gear.value, all6);
  });
  it('the request layer keeps slot-level user input (a partial fixedGear no longer disappears)', () => {
    const input = parseOptimizeInput({ playerId: 'usr_1', mode: 'war', user: { availableSkillPoints: 6 }, war: { kind: 'fixedHits', hits: 10, gearMode: 'optimize', ammo: ['none'], food: [], objective: { kind: 'maxDamage' }, fixedGear: { legs: { equipped: true, stat1: 9 } } } });
    assert.ok(input.ok); const u = userInputsOf((input as { ok: true; value: OptimizeInput }).value);
    assert.deepEqual(Object.keys(u.gear ?? {}), ['legs']);
  });
});

describe('fixed gear and current-build comparisons never use a partial loadout', () => {
  const fixed = { hits: 10, gearMode: 'fixed' as const, objective: { type: 'maxDamage' as const } };
  it('Fixed Gear is rejected before the engine with the unresolved slots named, and accepted once they are filled', () => {
    const partial = buildPlayerState({ profile: profile({ equipment: without('pants') }) });
    const r = toWarBuildRequest(partial, fixed); assert.equal(r.ok, false);
    if (!r.ok) assert.ok(r.missing.some((m) => m.includes('legs') && m.includes('unknown and not empty')), r.missing.join('|'));
    const filled = buildPlayerState({ profile: profile({ equipment: without('pants') }), user: { gear: { legs: { kind: 'empty' } } } });
    assert.equal(toWarBuildRequest(filled, fixed).ok, true);
    assert.equal(toWarBuildRequest(buildPlayerState({ profile: profile({ equipment: SIX() }) }), fixed).ok, true, 'six-slot behavior is preserved');
  });
  it('the optimize request does not feed a partial snapshot into the combat model and says so', () => {
    const partial = buildPlayerState({ profile: profile({ equipment: without('pants') }) });
    const r = toOptimizeRequest(partial, { objective: { type: 'maxDamagePerHit' } }); assert.ok(r.ok);
    if (r.ok) { assert.deepEqual(r.request.combat.gear, {}); assert.ok(r.notes.some((n) => n.includes('Equipped gear unknown') && n.includes('legs'))); }
    const full = toOptimizeRequest(buildPlayerState({ profile: profile({ equipment: SIX() }) }), { objective: { type: 'maxDamagePerHit' } }); assert.ok(full.ok);
    if (full.ok) assert.equal(Object.keys(full.request.combat.gear).length, 6);
  });
  const skillsFx = skills;
  const market = fx('market.json') as MarketRowLike[];
  const offers = fx('equipment-offers.json').offers as OfferLike[];
  const companies = (fx('companies.json').companies as CompanyLike[]).filter((c) => ['steel', 'concrete', 'lead'].includes(c.itemCode)).slice(0, 2);
  const depsFor = (equipment: PlayerEquipmentLike[] | null): ImportDeps => ({ profile: async () => ({ player: { ...profile({ equipment }), skills: skillsFx } }), companies: async () => ({ rows: companies }), stats: async () => ({}), market: async () => ({ rows: market }), offers: async (slot) => ({ rows: offers.filter((o) => o.slot === slot) }) });
  const input = (): OptimizeInput => { const r = parseOptimizeInput({ playerId: 'usr_1', mode: 'war', user: { availableSkillPoints: 6 }, war: { kind: 'fixedHits', hits: 20, gearMode: 'optimize', ammo: ['none', 'light'], food: [{ type: 'bread', price: 0.5 }], objective: { kind: 'maxDamage' } } }); assert.ok(r.ok); return (r as { ok: true; value: OptimizeInput }).value; };
  it('"current build" is not computed from a partial snapshot, but is computed from a complete one', async () => {
    const i = input();
    const partial = await importForBuild('usr_1', depsFor(without('pants')), userInputsOf(i)); const rp = runOptimization(partial!, i);
    assert.ok(rp.ok); if (rp.ok) assert.equal(rp.current, null);
    const complete = await importForBuild('usr_1', depsFor(SIX()), userInputsOf(i)); const rc = runOptimization(complete!, i);
    assert.ok(rc.ok); if (rc.ok) assert.ok(rc.current !== null && rc.current.perHit !== null);
  });
  it('player-owned equipment and market offers stay separate: offers never populate the player gear', async () => {
    const imp = await importForBuild('usr_1', depsFor(null), undefined);
    assert.ok(imp!.candidates !== null && Object.keys(imp!.candidates.candidates).length > 0, 'offers were imported as candidates');
    assert.equal(imp!.state.gear.value, null); assert.equal(imp!.state.equipment.snapshot.reported, false);
    const vm = importViewModel(imp!); assert.equal(vm.equipment.completeness, 'unknown'); assert.ok((vm.offers?.total ?? 0) > 0);
    assert.ok(vm.equipment.slots.every((s) => s.status === 'missing' && s.fill === null));
  });
});

describe('profile parsing keeps rejected equipment rows as issues', () => {
  const base = { id: 'usr_1', username: 'Bob' };
  it('valid rows are kept, invalid rows become issues with a reason and the slot when readable', () => {
    const p = parsePlayer({ ...base, equipment: [
      { slot: 'weapon', itemCode: 'pistol', rarity: 'rare', stats: { attack: 70, criticalChance: 10 }, durability: 82 },
      { slot: 'helmet', itemCode: 'helm', stats: { criticalDamages: 'x' } }, { slot: 'gloves' }, { itemCode: 'a', stats: {} }, 'nope', null,
      { slot: 'chest', itemCode: 'c', stats: { armor: 4 }, durability: 'bad' },
    ] }, 'https://a')!;
    assert.equal(p.equipment!.length, 1); assert.equal(p.equipment![0]!.durability, 82);
    assert.deepEqual(p.equipmentIssues, [
      { index: 1, slot: 'helmet', reason: 'invalid-stats' }, { index: 2, slot: 'gloves', reason: 'missing-item-code' }, { index: 3, slot: null, reason: 'missing-slot' },
      { index: 4, slot: null, reason: 'not-an-object' }, { index: 5, slot: null, reason: 'not-an-object' }, { index: 6, slot: 'chest', reason: 'invalid-durability' },
    ]);
  });
  it('an absent block is null/null; a malformed block no longer makes the whole profile unreadable', () => {
    const none = parsePlayer(base, 'https://a')!; assert.equal(none.equipment, null); assert.equal(none.equipmentIssues, null);
    const bad = parsePlayer({ ...base, equipment: { weapon: 1 } }, 'https://a');
    assert.ok(bad !== null); assert.equal(bad!.equipment, null); assert.deepEqual(bad!.equipmentIssues, [{ index: -1, slot: null, reason: 'not-an-array' }]);
    assert.deepEqual(parsePlayer({ ...base, equipment: [] }, 'https://a')!.equipmentIssues, []);
  });
  it('rejected rows flow from the parser through the snapshot to the state warnings', () => {
    const p = parsePlayer({ ...base, level: 22, skills, equipment: [{ slot: 'weapon', itemCode: 'x', stats: { attack: 'x' } }, ...SIX().slice(1).map((r) => ({ slot: r.slot, itemCode: r.itemCode, stats: r.stats, durability: r.durability }))] }, 'https://a')!;
    const s = buildPlayerState({ profile: p as unknown as ProfileLike });
    assert.equal(s.equipment.snapshot.slots.weapon.status, 'invalid'); assert.ok(s.warnings.some((w) => w.includes('Equipment row 0') && w.includes('invalid-stats')));
    assert.equal(s.gear.value, null);
  });
});

describe('import view model and Data panel status', () => {
  const imp = (equipment: PlayerEquipmentLike[] | null) => ({ state: buildPlayerState({ profile: profile({ equipment }) }), market: null, candidates: null, failures: {} });
  it('reports each slot with status, item info, durability and a fill-in only for usable slots', () => {
    const vm = importViewModel(imp(without('pants'))).equipment;
    assert.equal(vm.completeness, 'partial'); assert.equal(vm.slots.length, 6);
    const w = vm.slots.find((s) => s.gear === 'weapon')!; assert.deepEqual(w.fill, { stat1: 70, stat2: 10, usesAmmo: true, durability: 82 }); assert.equal(w.itemCode, 'pistol');
    const legs = vm.slots.find((s) => s.gear === 'legs')!; assert.equal(legs.status, 'missing'); assert.equal(legs.fill, null);
    assert.deepEqual(vm.slots.find((s) => s.gear === 'helmet')!.fill, { stat1: 12, durability: 90 });
  });
  it('renders honest status in English and Arabic (missing = unknown, never empty)', () => {
    const vm = importViewModel(imp(without('pants'))).equipment;
    for (const lang of ['en', 'ar'] as const) {
      const t = getBuilderMessages(lang);
      const html = renderToStaticMarkup(createElement(EquipmentStatus, { t, eq: vm, form: defaultForm().gear, onUse: () => undefined }));
      assert.ok(html.includes(t.data.eqPartial)); assert.ok(html.includes(t.data.eqStatus.missing)); assert.ok(html.includes(t.data.eqUse));
      assert.ok(html.includes(t.slots.legs));
    }
    const none = renderToStaticMarkup(createElement(EquipmentStatus, { t: getBuilderMessages('en'), eq: importViewModel(imp(null)).equipment, form: defaultForm().gear, onUse: () => undefined }));
    assert.ok(none.includes(en.data.eqNotReported)); assert.ok(!none.includes(en.data.eqUse));
  });
  it('every new status and problem string exists, is non-empty, and is translated', () => {
    const reasons = ['not-an-array', 'not-an-object', 'missing-slot', 'missing-item-code', 'invalid-stats', 'invalid-durability', 'malformed', 'duplicate-rows', 'missing-stat'];
    for (const r of reasons) { assert.ok(en.data.eqProblem[r as keyof typeof en.data.eqProblem]); assert.ok(ar.data.eqProblem[r as keyof typeof ar.data.eqProblem]); assert.notEqual(en.data.eqProblem[r as keyof typeof en.data.eqProblem], ar.data.eqProblem[r as keyof typeof ar.data.eqProblem]); }
    for (const k of ['present', 'missing', 'invalid', 'duplicate'] as const) { assert.ok(en.data.eqStatus[k] && ar.data.eqStatus[k]); assert.notEqual(en.data.eqStatus[k], ar.data.eqStatus[k]); }
    for (const k of ['eqTitle', 'eqHint', 'eqComplete', 'eqPartial', 'eqUnknown', 'eqNotReported', 'eqUse', 'eqUsed', 'eqRejected', 'eqUnrecognized'] as const) { assert.ok(en.data[k] && ar.data[k]); assert.notEqual(en.data[k], ar.data[k]); }
  });
});

describe('profile durability reaches the Sustainable model (Wiki 01-basics §3.4: 1 durability per hit, weapon wears on every hit)', () => {
  const market = fx('market.json') as MarketRowLike[];
  const offers = fx('equipment-offers.json').offers as OfferLike[];
  const companies = (fx('companies.json').companies as CompanyLike[]).filter((c) => ['steel', 'concrete', 'lead'].includes(c.itemCode)).slice(0, 2);
  const deps = (equipment: PlayerEquipmentLike[] | null): ImportDeps => ({ profile: async () => ({ player: profile({ equipment }) }), companies: async () => ({ rows: companies }), stats: async () => ({}), market: async () => ({ rows: market }), offers: async (slot) => ({ rows: offers.filter((o) => o.slot === slot) }) });
  const sustainable = (fixedGear?: Record<string, unknown>): OptimizeInput => {
    const r = parseOptimizeInput({ playerId: 'usr_1', mode: 'war', user: { availableSkillPoints: 6 }, war: { kind: 'sustainable', hits: 1, gearMode: 'fixed', ...(fixedGear ? { fixedGear } : {}), ammo: ['light'], food: [{ type: 'bread', price: 0.5 }], objective: { kind: 'maxDamage' } } });
    assert.ok(r.ok, JSON.stringify(r)); return (r as { ok: true; value: OptimizeInput }).value;
  };
  const go = async (equipment: PlayerEquipmentLike[], fixedGear?: Record<string, unknown>) => { const i = sustainable(fixedGear); const imp = await importForBuild('usr_1', deps(equipment), userInputsOf(i)); return runOptimization(imp!, i); };
  const withWeaponDurability = (d: number | null) => SIX().map((r) => (r.slot === 'weapon' ? { ...r, durability: d } : r));

  it('a complete profile snapshot limits the session by the reported weapon durability, with the source stated', async () => {
    const r = await go(withWeaponDurability(10)); assert.ok(r.ok, JSON.stringify(r)); if (!r.ok || r.kind !== 'sustainable') return;
    assert.equal(r.builds[0]!.session!.limiting, 'durability:weapon'); assert.equal(r.builds[0]!.session!.hits, 10);
    assert.ok(r.notes.some((n) => n.includes('Durability taken from the profile') && n.includes('weapon 10')));
  });
  it('a typed durability overrides the profile value for that slot', async () => {
    const r = await go(withWeaponDurability(30), { weapon: { equipped: true, stat1: 70, stat2: 10, usesAmmo: true, durability: 15 }, helmet: { equipped: false }, gloves: { equipped: false }, chest: { equipped: false }, legs: { equipped: false }, boots: { equipped: false } });
    assert.ok(r.ok, JSON.stringify(r)); if (!r.ok || r.kind !== 'sustainable') return;
    assert.equal(r.builds[0]!.session!.hits, 15); assert.equal(r.builds[0]!.session!.limiting, 'durability:weapon');
  });
  it('Fixed Gear with an incomplete profile snapshot fails with the unresolved slots named, never by treating them as empty', async () => {
    const i = sustainable(); const imp = await importForBuild('usr_1', deps(SIX().filter((x) => x.slot !== 'pants')), userInputsOf(i));
    const r = runOptimization(imp!, i); assert.equal(r.ok, false);
    if (!r.ok) assert.ok(JSON.stringify(r).includes('legs') && JSON.stringify(r).includes('not empty'), JSON.stringify(r));
  });
  it('unknown durability is flagged and never silently treated as a known value', async () => {
    const r = await go(withWeaponDurability(null)); assert.ok(r.ok, JSON.stringify(r)); if (!r.ok || r.kind !== 'sustainable') return;
    assert.ok(r.assumptions.some((a) => a.includes('Durability of weapon unknown')), r.assumptions.join('|'));
    assert.ok(!r.notes.some((n) => n.includes('weapon ')) || !r.notes.some((n) => n.includes('Durability taken from the profile') && n.includes('weapon')));
  });
  it('a reported durability of 0 is not used (an item at 0 is gone, Wiki 01-basics §3.4)', async () => {
    const r = await go(withWeaponDurability(0)); assert.ok(r.ok, JSON.stringify(r)); if (!r.ok || r.kind !== 'sustainable') return;
    assert.notEqual(r.builds[0]!.session!.limiting, 'durability:weapon'); assert.ok(r.assumptions.some((a) => a.includes('Durability of weapon unknown')));
  });
});

describe('imported versus manual data (Data panel)', () => {
  const imp = (p: ProfileLike, companies: CompanyLike[] = []) => ({ state: buildPlayerState({ profile: p, companies }), market: null, candidates: null, failures: {} });
  const slotsForm = (over: Partial<Record<'weapon' | 'helmet' | 'gloves' | 'chest' | 'legs' | 'boots', Partial<SlotForm>>>) => { const g = defaultForm().gear; for (const k of Object.keys(over) as (keyof typeof g)[]) g[k] = { ...g[k], ...over[k] }; return g; };
  const vm = importViewModel(imp(profile({ equipment: SIX() }))).equipment;
  const html = (form: ReturnType<typeof slotsForm>) => renderToStaticMarkup(createElement(EquipmentStatus, { t: getBuilderMessages('en'), eq: vm, form, onUse: () => undefined }));

  it('compares the form with the profile slot by slot: matches / differs / treated as empty', () => {
    const page = html(slotsForm({ weapon: { equipped: true, stat1: '70', stat2: '10', usesAmmo: true, durability: '82' }, helmet: { equipped: true, stat1: '99' } }));
    assert.ok(page.includes(en.data.eqForm.same)); assert.ok(page.includes(en.data.eqForm.differs)); assert.ok(page.includes(en.data.eqForm.empty));
    assert.equal((page.match(/data-compare="same"/g) ?? []).length, 1); assert.equal((page.match(/data-compare="differs"/g) ?? []).length, 1); assert.equal((page.match(/data-compare="empty"/g) ?? []).length, 4);
  });
  it('lists imported data that is kept but not used as calculation input', () => {
    const economy = { lifetime: { from: null, to: null, shiftsWorked: 20, employeeShifts: 2, unitsProduced: 3, wagesEarned: '1000', marketBuys: null, marketSells: null }, recent: null, companies: 1 };
    assert.deepEqual(importViewModel(imp(profile())).retained, []);
    assert.deepEqual(importViewModel(imp(profile({ economy }))).retained, ['economy']);
    const upgraded: CompanyLike = { id: 'c1', itemCode: 'steel', storageLevel: 2, engineLevel: 1 };
    assert.deepEqual(importViewModel(imp(profile(), [upgraded])).retained, ['companyUpgrades']);
    assert.deepEqual(importViewModel(imp(profile(), [{ id: 'c2', itemCode: 'steel', storageLevel: 1, engineLevel: 1 }])).retained, []);
  });
  it('the new labels exist and are translated in English and Arabic', () => {
    for (const k of ['same', 'differs', 'empty'] as const) { assert.ok(en.data.eqForm[k] && ar.data.eqForm[k]); assert.notEqual(en.data.eqForm[k], ar.data.eqForm[k]); }
    assert.ok(en.player.retained && ar.player.retained && en.player.retained !== ar.player.retained);
    for (const k of ['economy', 'companyUpgrades', 'stats'] as const) { assert.ok(en.player.retainedItems[k] && ar.player.retainedItems[k]); assert.notEqual(en.player.retainedItems[k], ar.player.retainedItems[k]); }
  });
});
