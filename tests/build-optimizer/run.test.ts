import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { importForBuild, type CompanyLike, type ImportDeps, type MarketRowLike, type OfferLike, type ProfileLike } from '@/features/build-optimizer';
import { parseOptimizeInput, type OptimizeInput } from '@/features/build-optimizer/api-schema';
import { gearFromSlots, loadAndRun, ownedCandidates, runOptimization, trimCandidates, userInputsOf, SUSTAINABLE_MAX_CONFIGS } from '@/features/build-optimizer/run';
import { offersToCandidates } from '@/features/build-optimizer';

const fx = (f: string) => JSON.parse(readFileSync(`tests/fixtures/real/${f}`, 'utf8'));
const skills = fx('player-skills.json').skills as ProfileLike['skills'];
const profile: ProfileLike = { id: 'usr_1', name: 'Tester', countryId: 'eg', level: 22, damage: { total: '2549826', day: '0', week: '0', month: '0' }, skills, hasSkills: true, rankCode: null };
const market = fx('market.json') as MarketRowLike[];
const offers = fx('equipment-offers.json').offers as OfferLike[];
const companies = (fx('companies.json').companies as CompanyLike[]).filter((c) => ['steel', 'concrete', 'lead'].includes(c.itemCode)).slice(0, 2);
const deps: ImportDeps = { profile: async () => ({ player: profile }), companies: async () => ({ rows: companies }), stats: async () => ({}), market: async () => ({ rows: market }), offers: async (slot) => ({ rows: offers.filter((o) => o.slot === slot) }) };
const FOOD = [{ type: 'bread', price: 0.5 }, { type: 'steak', price: 1.2 }, { type: 'cookedFish', price: 2 }];
const ALL6 = { weapon: { equipped: false }, helmet: { equipped: false }, gloves: { equipped: false }, chest: { equipped: false }, legs: { equipped: false }, boots: { equipped: false } };
const raw = (o: Record<string, unknown> = {}) => ({ playerId: 'usr_1', mode: 'war', user: { availableSkillPoints: 6 }, war: { kind: 'fixedHits', hits: 30, gearMode: 'optimize', ammo: ['none', 'light'], food: FOOD, objective: { kind: 'maxDamage' } }, ...o });
const parse = (o: Record<string, unknown> = {}): OptimizeInput => { const r = parseOptimizeInput(raw(o)); assert.ok(r.ok, JSON.stringify(r)); return (r as { ok: true; value: OptimizeInput }).value; };
const run = async (o: Record<string, unknown> = {}) => { const input = parse(o); const imp = await importForBuild('usr_1', deps, userInputsOf(input)); assert.ok(imp); return runOptimization(imp!, input); };
const json = (v: unknown) => assert.deepEqual(JSON.parse(JSON.stringify(v)), v, 'result must be JSON-safe (no Infinity/undefined)');

describe('request validation', () => {
  it('rejects bad input with specific messages and never defaults silently', () => {
    const bad = (o: unknown) => { const r = parseOptimizeInput(o); assert.ok(!r.ok); return (r as { errors: string[] }).errors.join('|'); };
    assert.ok(bad(null).includes('object')); assert.ok(bad({ playerId: '../x', mode: 'war' }).includes('playerId'));
    assert.ok(bad(raw({ mode: 'nope' })).includes('mode'));
    assert.ok(bad(raw({ war: { hits: 0, ammo: ['none'] } })).includes('war.hits')); assert.ok(bad(raw({ war: { hits: 9999, ammo: ['none'] } })).includes('war.hits'));
    assert.ok(bad(raw({ war: { hits: 10, ammo: [] } })).includes('ammo'));
    assert.ok(bad(raw({ user: { prestigeCount: 1.5 } })).includes('whole number')); assert.ok(bad(raw({ user: { totalSkillPoints: -1 } })).includes('totalSkillPoints'));
    assert.ok(bad(raw({ constraints: [{ skill: 'attack', kind: 'min', level: 11 }] })).includes('level'));
    assert.ok(parseOptimizeInput(raw({ war: { hits: 10, ammo: ['none'], gearMode: 'fixed', fixedGear: { weapon: { equipped: false } } } })).ok, 'omitted slots may be filled from the profile; the run layer checks that every slot is resolved');
    assert.ok(bad(raw({ war: { hits: 10, ammo: ['none'], gearMode: 'fixed', fixedGear: { ...ALL6, weapon: { equipped: true, stat1: 50 } } } })).includes('stat2'));
    assert.ok(bad(raw({ war: { hits: 10, ammo: ['none'], ownedGear: { weapon: { equipped: true, stat1: 50, stat2: 5 } } } })).includes('durability'));
    assert.ok(bad(raw({ pill: { enabled: true, state: { kind: 'buff' }, battles: [{ startMinutes: 0, durationMinutes: 10, hits: 5 }], cost: { mode: 'owned' } } })).includes('minutes'));
    assert.ok(bad(raw({ pill: { enabled: true, state: { kind: 'none' }, battles: [], cost: { mode: 'owned' } } })).includes('battles'));
    assert.ok(bad(raw({ mode: 'hybrid', hybrid: { kind: 'constrained' } })).includes('minDailyNet'));
    const ok = parse({ constraints: [{ skill: 'attack', kind: 'min', level: 3 }] }); assert.equal(ok.constraints.length, 1); assert.equal(ok.keepCurrentSkills, false); assert.equal(ok.pill.enabled, false);
  });
  it('slot helpers: complete gear only; owned items need durability', () => {
    assert.equal(gearFromSlots({ weapon: { equipped: false } }), null);
    const g = gearFromSlots({ ...ALL6, weapon: { equipped: true, stat1: 50, stat2: 7, usesAmmo: true }, boots: { equipped: true, stat1: 9 } } as never)!;
    assert.deepEqual(g.weapon, { kind: 'item', stats: { attack: 50, critChance: 7, usesAmmo: true } }); assert.deepEqual(g.boots, { kind: 'item', stats: { dodge: 9 } }); assert.deepEqual(g.helmet, { kind: 'empty' });
    const o = ownedCandidates({ weapon: { equipped: true, stat1: 50, stat2: 7, durability: 60 }, chest: { equipped: true, stat1: 5 } });
    assert.equal(o.weapons!.length, 1); assert.equal(o.weapons![0]!.durability, 60); assert.equal(o.chests, undefined); // no durability -> not a candidate
  });
});

describe('war build through the run layer (real recorded fixtures)', () => {
  it('equipment optimization from real market offers returns JSON-safe, honest results', async () => {
    const r = await run(); assert.ok(r.ok, JSON.stringify(r)); if (!r.ok) return; json(r);
    assert.equal(r.kind, 'war'); assert.ok(r.builds.length >= 1); assert.equal(r.builds[0]!.skills.length, 14); assert.equal(r.builds[0]!.gear!.length, 6);
    assert.ok(r.builds[0]!.combat!.damage > 0); assert.equal(r.pointsExact, true); assert.equal(r.totalPoints, 91); // 85 invested + 6 available
    assert.equal(r.lowerBoundCost, false); // every consumable price was supplied (lead from the market snapshot)
    const noFoodPrices = await run({ war: { kind: 'fixedHits', hits: 30, gearMode: 'optimize', ammo: ['none', 'light'], food: [], objective: { kind: 'maxDamage' } } }); assert.ok(noFoodPrices.ok); if (noFoodPrices.ok) assert.equal(noFoodPrices.lowerBoundCost, true); // unknown food prices -> lower-bound, never silently free
  });
  it('fixed gear: every slot is mandatory and nothing is bought', async () => {
    const gear = { ...ALL6, weapon: { equipped: true, stat1: 60, stat2: 8, usesAmmo: true, durability: 80 }, chest: { equipped: true, stat1: 10, durability: 80 } };
    const r = await run({ war: { kind: 'fixedHits', hits: 30, gearMode: 'fixed', fixedGear: gear, ammo: ['light'], food: FOOD, objective: { kind: 'maxDamage' } } }); assert.ok(r.ok, JSON.stringify(r)); if (!r.ok) return; json(r);
    assert.equal(r.builds[0]!.cost!.acquisition, 0); assert.ok(r.current && r.current.damage! > 0); assert.ok(r.builds[0]!.combat!.damage >= r.current!.damage! - 1e-6);
    const missing = await run({ war: { kind: 'fixedHits', hits: 30, gearMode: 'fixed', ammo: ['none'], food: FOOD, fixedGear: { weapon: { equipped: false } }, objective: { kind: 'maxDamage' } } });
    assert.ok(!missing.ok); if (!missing.ok) assert.ok(JSON.stringify(missing).includes('unresolved') || JSON.stringify(missing).includes('every slot'), JSON.stringify(missing)); // the profile fixture reports no equipment: the other slots are unknown, not empty
  });
  it('objectives: best value and max net; unknown prices are refused or flagged', async () => {
    const bv = await run({ war: { kind: 'fixedHits', hits: 30, gearMode: 'optimize', ammo: ['none', 'light'], food: FOOD, objective: { kind: 'bestValue', minDamageSharePct: 60 } } }); assert.ok(bv.ok); if (bv.ok) json(bv);
    const net = await run({ war: { kind: 'fixedHits', hits: 30, gearMode: 'optimize', ammo: ['light'], food: FOOD, objective: { kind: 'maxNet', goldPerDamage: 0.001, crateValue: 50 } } }); assert.ok(net.ok, JSON.stringify(net)); if (net.ok) assert.ok(net.builds[0]!.net !== null);
    const noRev = await run({ war: { kind: 'fixedHits', hits: 30, gearMode: 'optimize', ammo: ['light'], food: FOOD, objective: { kind: 'maxNet' } } }); assert.ok(!noRev.ok && noRev.reason === 'missing-input');
    const noFood = await run({ war: { kind: 'fixedHits', hits: 30, gearMode: 'optimize', ammo: ['light'], food: [], objective: { kind: 'bestValue' } } }); assert.ok(!noFood.ok && noFood.message.includes('price'));
  });
  it('constraints, keep-current-skills and conflicts', async () => {
    const keep = await run({ keepCurrentSkills: true }); assert.ok(keep.ok); if (keep.ok) for (const b of keep.builds) { assert.equal(b.reset.required, false); for (const s of b.skills) assert.ok(s.proposed >= (s.current ?? 0)); }
    const conf = await run({ constraints: [{ skill: 'attack', kind: 'min', level: 10 }, { skill: 'accuracy', kind: 'min', level: 10 }, { skill: 'critDamage', kind: 'min', level: 10 }] }); assert.ok(!conf.ok && conf.reason === 'conflict' && conf.details.length > 0);
  });
  it('Pill: optional, never changes the build, unknown state is reported', async () => {
    const battles = [{ startMinutes: 0, durationMinutes: 30, hits: 30 }];
    const off = await run(); const on = await run({ pill: { enabled: true, state: { kind: 'none' }, battles, cost: { mode: 'buy', price: 20 } } }); const unk = await run({ pill: { enabled: true, state: { kind: 'unknown' }, battles, cost: { mode: 'owned' } } });
    assert.ok(off.ok && on.ok && unk.ok); if (!off.ok || !on.ok || !unk.ok) return; json(on);
    assert.equal(off.pill, null); assert.ok(on.pill && on.pill.ok && on.pill.plans.length > 0); assert.ok(unk.pill && !unk.pill.ok && unk.pill.reason === 'state-unknown');
    assert.deepEqual(on.builds.map((b) => b.skills.map((s) => s.proposed)), off.builds.map((b) => b.skills.map((s) => s.proposed)));
  });
  it('sustainable mode: fixed gear and trimmed market search', async () => {
    const s = await run({ war: { kind: 'sustainable', hits: 1, gearMode: 'optimize', ammo: ['none', 'light'], food: FOOD.map((f) => ({ ...f, stock: 20 })), leadStock: 500, objective: { kind: 'maxDamage' } } }); assert.ok(s.ok, JSON.stringify(s)); if (!s.ok) return; json(s);
    assert.equal(s.kind, 'sustainable'); assert.ok(s.builds[0]!.session!.hits > 0); assert.ok(s.notes.some((n) => n.includes('limited to')) || s.builds.length > 0);
    const gear = { ...ALL6, weapon: { equipped: true, stat1: 60, stat2: 8, usesAmmo: true, durability: 25 } };
    const f = await run({ war: { kind: 'sustainable', hits: 1, gearMode: 'fixed', fixedGear: gear, ammo: ['light'], food: FOOD, objective: { kind: 'maxDamage' } } }); assert.ok(f.ok, JSON.stringify(f)); if (f.ok) { assert.equal(f.builds[0]!.session!.limiting, 'durability:weapon'); assert.equal(f.builds[0]!.session!.hits, 25); }
  });
  it('trimCandidates keeps the explicit search within the cap and reports what it dropped', () => {
    const { candidates } = offersToCandidates(offers, { maxPerSlot: 6 });
    const t = trimCandidates(candidates as never, 2, SUSTAINABLE_MAX_CONFIGS); assert.ok(t.trimmed > 0);
    const n = (['weapons', 'helmets', 'gloves', 'chests', 'legs', 'boots'] as const).reduce((a, k) => a * ((t.candidates[k]?.length ?? 0) + 1), 1) * 2; assert.ok(n <= SUSTAINABLE_MAX_CONFIGS, String(n));
  });
});

describe('economic and hybrid through the run layer', () => {
  const eco = { marketTaxPct: 5, incomeTaxPct: 5, jobWage: 0.8, sellBasis: 'bid' };
  it('economic build: economic skills only, current vs proposed net, JSON-safe', async () => {
    const r = await run({ mode: 'economic', economic: eco }); assert.ok(r.ok || r.reason === 'infeasible', JSON.stringify(r)); if (!r.ok) return; json(r);
    assert.equal(r.kind, 'economic'); for (const s of r.builds[0]!.skills.filter((x) => x.group === 'war')) assert.ok(s.proposed >= 0);
    assert.ok(r.builds[0]!.economy !== null); assert.ok(r.current && r.current.economyNet !== undefined);
  });
  it('hybrid build: both metrics, constrained and weighted', async () => {
    const c = await run({ mode: 'hybrid', economic: eco, hybrid: { kind: 'constrained', minDailyNet: -1000000 }, war: { kind: 'fixedHits', hits: 30, gearMode: 'optimize', ammo: ['none'], food: FOOD, objective: { kind: 'maxDamage' } } }); assert.ok(c.ok || c.reason === 'infeasible', JSON.stringify(c)); if (c.ok) { json(c); assert.equal(c.kind, 'hybrid'); assert.ok(c.builds[0]!.combat && c.builds[0]!.economy); }
    const w = await run({ mode: 'hybrid', economic: eco, hybrid: { kind: 'weighted', weightCombat: 1, weightEconomy: 1 } }); assert.ok(w.ok || w.reason === 'infeasible', JSON.stringify(w));
  });
  it('missing market data is reported, not defaulted', async () => {
    const input = parse({ mode: 'economic', economic: eco });
    const imp = await importForBuild('usr_1', { ...deps, market: async () => { throw new Error('down'); } }, userInputsOf(input)); const r = runOptimization(imp!, input);
    assert.ok(!r.ok && r.reason === 'missing-input' && r.details.some((d) => d.includes('market')));
  });
  it('unknown player and unreadable skills', async () => {
    const nf = await loadAndRun('nobody', parse(), { ...deps, profile: async () => ({ player: null }) }); assert.equal((nf as { reason?: string }).reason, 'not-found');
    const input = parse(); const imp = await importForBuild('usr_1', { ...deps, profile: async () => ({ player: { ...profile, skills: [], hasSkills: false } }) }, userInputsOf(input)); const r = runOptimization(imp!, input); assert.ok(!r.ok && r.reason === 'missing-input');
  });
});
