import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { importForBuild, type ImportDeps, type MarketRowLike, type OfferLike, type ProfileLike, type CompanyLike } from '@/features/build-optimizer';
import { en } from '@/features/build-optimizer/ui/messages.en';
import { ar } from '@/features/build-optimizer/ui/messages.ar';
import { getBuilderMessages } from '@/features/build-optimizer/ui/messages';
import { ADVISORY, defaultForm, fixedGearComplete, parseBody, sectionsFor, toRequestBody, validate, type FormState } from '@/features/build-optimizer/ui/form';
import { DASH, fmt, fmtGold, minutesLabel, signed } from '@/features/build-optimizer/ui/format';
import { importViewModel } from '@/features/build-optimizer/view-model';
import { runOptimization, userInputsOf } from '@/features/build-optimizer/run';
import type { OptimizeInput } from '@/features/build-optimizer/api-schema';

const fx = (f: string) => JSON.parse(readFileSync(`tests/fixtures/real/${f}`, 'utf8'));
const profile: ProfileLike = { id: 'usr_1', name: 'Tester', countryId: 'eg', level: 22, damage: { total: '2549826', day: '0', week: '0', month: '0' }, skills: fx('player-skills.json').skills, hasSkills: true, rankCode: null };
const market = fx('market.json') as MarketRowLike[]; const offers = fx('equipment-offers.json').offers as OfferLike[];
const companies = (fx('companies.json').companies as CompanyLike[]).filter((c) => ['steel', 'concrete'].includes(c.itemCode)).slice(0, 2);
const deps: ImportDeps = { profile: async () => ({ player: profile }), companies: async () => ({ rows: companies }), stats: async () => ({}), market: async () => ({ rows: market }), offers: async (s) => ({ rows: offers.filter((o) => o.slot === s) }) };

const shape = (v: unknown, path = ''): string[] => (typeof v === 'object' && v !== null ? Object.entries(v).flatMap(([k, x]) => shape(x, `${path}.${k}`)) : [path]);
const leaves = (v: unknown, out: string[] = []): string[] => { if (typeof v === 'string') out.push(v); else if (typeof v === 'object' && v !== null) Object.values(v).forEach((x) => leaves(x, out)); return out; };

describe('translations', () => {
  it('Arabic has exactly the English keys, no empty strings, and the same placeholders', () => {
    assert.deepEqual(shape(ar).sort(), shape(en).sort());
    const flat = (m: unknown, p = ''): [string, string][] => (typeof m === 'string' ? [[p, m]] : Object.entries(m as object).flatMap(([k, x]) => flat(x, `${p}.${k}`)));
    const A = new Map(flat(ar)), E = new Map(flat(en));
    for (const [k, v] of E) {
      const a = A.get(k)!; assert.ok(a.trim().length > 0, k);
      const ph = (s: string) => (s.match(/\{[a-z]+\}/g) ?? []).sort().join(',');
      assert.equal(ph(a), ph(v), `placeholders differ at ${k}`);
    }
    assert.ok(/[\u0600-\u06FF]/.test(ar.title) && /[\u0600-\u06FF]/.test(ar.results.why.maxDamage));
    assert.equal(getBuilderMessages('ar'), ar); assert.equal(getBuilderMessages('en'), en); assert.equal(getBuilderMessages('xx'), en);
    assert.ok(leaves(en).every((s) => !s.includes('undefined')));
  });
  it('every message key the logic can emit exists', () => {
    // validation issues
    const f = defaultForm(); const keys = new Set<string>();
    for (const mode of ['war', 'economic', 'hybrid'] as const) for (const warKind of ['fixedHits', 'sustainable'] as const) for (const gearMode of ['fixed', 'optimize'] as const) for (const objective of ['maxDamage', 'bestValue', 'maxNet'] as const) {
      const form: FormState = { ...f, mode, warKind, gearMode, objective, pointsMethod: 'available', hits: '', pill: { ...f.pill, enabled: true, state: 'buff', battles: [] }, hybrid: { ...f.hybrid, minDailyNet: '', kind: 'constrained' } };
      for (const i of validate(form, null)) keys.add(i.key);
    }
    const imp = importViewModel({ state: { id: 'x', name: 'x', countryId: null, level: { value: 5, source: 'api' }, prestigeCount: { value: null, source: 'unavailable' }, skills: { levels: { value: null, source: 'unavailable' }, spentPoints: null, unmapped: [], unexpectedMaxLevel: [], inferredMappings: [] }, skillPoints: { earned: { value: null, source: 'unavailable' }, earnedFromLevels: null, prestigePoints: null, impliedMinPrestige: null, invested: null, available: { value: null, source: 'unavailable' }, exact: false, basis: null, consistent: null }, damage: { total: null, day: null, week: null, month: null }, rank: { code: null, name: { value: null, source: 'unavailable' }, bonusPct: { value: null, source: 'unavailable' } }, companies: { items: [], count: null, source: 'unavailable' }, stats: { value: null, source: 'unavailable' }, gear: { value: null, source: 'unavailable' }, pill: { value: null, source: 'unavailable' }, firstResetFree: { value: null, source: 'unavailable' }, currentHealthHunger: { value: null, source: 'unavailable' }, unit: null, party: null, missing: [], warnings: [] }, market: null, candidates: null, failures: {} });
    for (const mode of ['war', 'economic', 'hybrid'] as const) for (const warKind of ['fixedHits', 'sustainable'] as const) for (const gearMode of ['fixed', 'optimize'] as const) for (const objective of ['maxDamage', 'bestValue', 'maxNet'] as const) {
      for (const i of validate({ ...f, mode, warKind, gearMode, objective, pointsMethod: 'prestige', hits: '0', ammo: { none: false, light: false, medium: false, heavy: false }, food: { bread: { use: false, price: '', stock: '' }, steak: { use: false, price: '', stock: '' }, cookedFish: { use: false, price: '', stock: '' } }, constraints: [{ skill: 'attack', kind: 'min', level: '99' }], useMarket: false, hybrid: { kind: 'weighted', minDailyNet: '', wCombat: '', wEconomy: '' } }, imp)) keys.add(i.key);
    }
    assert.ok(keys.size > 5, [...keys].join(','));
    for (const k of keys) { assert.ok(k in en.issues, `en.issues.${k}`); assert.ok(k in ar.issues, `ar.issues.${k}`); }
    // result vocab
    for (const m of [en, ar]) {
      for (const r of ['conflict', 'missing-input', 'infeasible', 'too-large', 'error']) { assert.ok(r in m.results.reasons && r in m.results.reasonHelp); }
      for (const r of ['primary', 'max-damage', 'best-value', 'lowest-cost']) assert.ok(r in m.results.roles);
      for (const o of ['maxDamage', 'bestValue', 'maxNet', 'maxSessionDamage', 'maxEconomy', 'hybrid:constrained', 'hybrid:weighted']) { assert.ok(o in m.results.objectiveLabel, o); assert.ok(o in m.results.why, o); }
      for (const l of ['health-and-hunger', 'food-stock', 'ammo-stock', 'durability:weapon', 'durability:helmet', 'durability:gloves', 'durability:chest', 'durability:legs', 'durability:boots', 'none']) assert.ok(l in m.results.limits, l);
      for (const r of ['state-unknown', 'invalid']) assert.ok(r in m.results.pillErr);
      for (const k of ['war', 'sustainable', 'economic', 'hybrid']) assert.ok(k in m.results.kindLabel);
      for (const s of ['api', 'derived', 'user', 'unavailable']) assert.ok(s in m.player.source);
    }
  });
});

describe('form logic', () => {
  it('shows only the inputs a goal can use', () => {
    const f = defaultForm();
    assert.deepEqual(sectionsFor(f), { points: true, fight: true, gear: true, consumables: true, objective: true, pill: true, constraints: true, economic: false, hybrid: false });
    assert.equal(sectionsFor({ ...f, warKind: 'sustainable' }).pill, false);
    const eco = sectionsFor({ ...f, mode: 'economic' }); assert.equal(eco.fight, false); assert.equal(eco.gear, false); assert.equal(eco.consumables, false); assert.equal(eco.economic, true); assert.equal(eco.hybrid, false);
    const hy = sectionsFor({ ...f, mode: 'hybrid' }); assert.equal(hy.economic, true); assert.equal(hy.hybrid, true); assert.equal(hy.consumables, false);
  });
  it('validation tells the user what is missing and never blocks on advisories', async () => {
    const vm = importViewModel((await importForBuild('usr_1', deps))!); const f = defaultForm(); const keys = (x: FormState, i = vm) => validate(x, i).map((e) => e.key);
    assert.deepEqual(validate(f, null).map((e) => e.key), ['needPlayer']);
    assert.deepEqual(keys(f), []); // sensible defaults: nothing blocks a plain Max Damage run
    assert.ok(keys({ ...f, objective: 'bestValue' }).includes('needFoodPrices')); assert.ok(keys({ ...f, budget: '100' }).includes('needFoodPrices'));
    assert.ok(keys({ ...f, objective: 'maxNet' }).includes('needRevenue')); assert.ok(!keys({ ...f, objective: 'maxNet', goldPerDamage: '0.01', food: { bread: { use: true, price: '1', stock: '' }, steak: { use: true, price: '1', stock: '' }, cookedFish: { use: true, price: '1', stock: '' } } }).includes('needRevenue'));
    assert.ok(keys({ ...f, objective: 'bestValue', minSharePct: '0' }).includes('badShare')); assert.ok(keys({ ...f, hits: '' }).includes('needHits')); assert.ok(keys({ ...f, ammo: { none: false, light: false, medium: false, heavy: false } }).includes('needAmmo'));
    assert.ok(keys({ ...f, pointsMethod: 'available' }).includes('needAvailable')); assert.ok(keys({ ...f, pointsMethod: 'prestige' }).includes('needPrestige')); assert.ok(keys({ ...f, pointsMethod: 'total' }).includes('needTotal'));
    const pill = (p: Partial<FormState['pill']>) => ({ ...f, pill: { ...f.pill, enabled: true, ...p } });
    assert.ok(keys(pill({ state: 'unknown' })).includes('needPillState')); assert.ok(keys(pill({ state: 'buff', minutes: '' })).includes('needPillMinutes')); assert.ok(keys(pill({ state: 'none', battles: [] })).includes('needBattle')); assert.ok(!keys(pill({ state: 'none' })).includes('needPillState'));
    assert.ok(keys({ ...f, warKind: 'sustainable', pill: { ...f.pill, enabled: true, state: 'unknown' } }).every((k) => k !== 'needPillState')); // the Pill is not offered in sustainable mode
    const g = { ...f, gearMode: 'fixed' as const, gear: { ...f.gear, weapon: { equipped: true, stat1: '', stat2: '', usesAmmo: true, durability: '' } } }; assert.ok(keys(g).includes('needGearStats')); assert.ok(keys({ ...f, gear: { ...f.gear, chest: { equipped: true, stat1: '5', stat2: '', usesAmmo: true, durability: '250' } } }).includes('badDurability'));
    const eco = { ...f, mode: 'economic' as const }; assert.ok(keys(eco).includes('warnTaxes')); assert.ok(keys(eco).filter((k) => !ADVISORY.has(k)).length === 0); // advisory only
    assert.ok(keys(eco, { ...vm, market: { loaded: false, items: 0 } }).includes('needMarket'));
    assert.ok(keys({ ...f, mode: 'hybrid', hybrid: { kind: 'constrained', minDailyNet: '', wCombat: '', wEconomy: '' } }).includes('needMinNet')); assert.ok(keys({ ...f, mode: 'hybrid', hybrid: { kind: 'weighted', minDailyNet: '', wCombat: '', wEconomy: '1' } }).includes('needWeights'));
    assert.ok(keys({ ...f, constraints: [{ skill: 'attack', kind: 'min', level: '11' }] }).includes('badConstraint'));
    assert.ok(keys(f, { ...vm, skills: null }).includes('noSkills'));
  });
  it('fixed gear needs every ticked slot filled; unticked slots are explicit empties', () => {
    const f = defaultForm(); assert.equal(fixedGearComplete(f), true);
    f.gear.weapon = { equipped: true, stat1: '50', stat2: '', usesAmmo: true, durability: '' }; assert.equal(fixedGearComplete(f), false);
    f.gear.weapon.stat2 = '7'; assert.equal(fixedGearComplete(f), true);
  });
  it('formatting never turns unknown into zero', () => {
    assert.equal(fmt(null, 'en'), DASH); assert.equal(fmt(undefined, 'en'), DASH); assert.equal(fmt(Number.NaN, 'en'), DASH); assert.equal(fmtGold(null, 'en'), DASH); assert.equal(signed(null, 'en'), DASH);
    assert.equal(fmt(1234.5, 'en'), '1,235'); assert.equal(fmt(0, 'en'), '0'); assert.equal(signed(5, 'en'), '+5'); assert.equal(signed(-5, 'en'), '-5'); assert.equal(minutesLabel(75), '1h 15m'); assert.equal(minutesLabel(20), '0m'.replace('0', '20'));
    assert.ok(/[٠-٩]/.test(fmt(1234, 'ar-EG')) || fmt(1234, 'ar-EG').length > 0);
  });
});

describe('form -> request -> engine (every goal, real recorded data)', () => {
  const FOOD = (f: FormState) => { for (const k of ['bread', 'steak', 'cookedFish'] as const) f.food[k] = { use: true, price: '1', stock: k === 'bread' ? '' : '20' }; };
  const run = async (f: FormState) => {
    const body = JSON.parse(JSON.stringify(toRequestBody(f, 'usr_1'))); const parsed = parseBody(f, 'usr_1'); assert.ok(parsed.ok, JSON.stringify(parsed));
    const input = (parsed as { ok: true; value: OptimizeInput }).value; const imp = await importForBuild('usr_1', deps, userInputsOf(input)); assert.ok(imp);
    assert.deepEqual(body.playerId, 'usr_1'); return runOptimization(imp!, input);
  };
  const base = (): FormState => { const f = defaultForm(); FOOD(f); f.pointsMethod = 'available'; f.availablePoints = '6'; return f; };
  it('war: equipment optimization, all three objectives', async () => {
    for (const objective of ['maxDamage', 'bestValue', 'maxNet'] as const) {
      const f = base(); f.objective = objective; if (objective === 'maxNet') { f.goldPerDamage = '0.001'; f.crateValue = '40'; }
      const r = await run(f); assert.ok(r.ok, `${objective}: ${JSON.stringify(r)}`); if (r.ok) { assert.equal(r.kind, 'war'); assert.ok(r.builds[0]!.combat!.damage > 0); }
    }
  });
  it('war: fixed gear with a budget and the Pill', async () => {
    const f = base(); f.gearMode = 'fixed'; f.budget = '500'; f.gear.weapon = { equipped: true, stat1: '60', stat2: '8', usesAmmo: true, durability: '60' }; f.gear.chest = { equipped: true, stat1: '10', stat2: '', usesAmmo: true, durability: '80' };
    f.pill = { enabled: true, state: 'none', minutes: '', costMode: 'buy', price: '15', battles: [{ start: '0', duration: '30', hits: '30' }] };
    const r = await run(f); assert.ok(r.ok, JSON.stringify(r)); if (!r.ok) return;
    assert.equal(r.builds[0]!.cost!.acquisition, 0); assert.ok(r.pill && r.pill.ok); assert.ok(r.current && r.current.damage! > 0);
    const off = base(); off.gearMode = 'fixed'; off.gear = f.gear; const r2 = await run(off); assert.ok(r2.ok); if (r2.ok) { assert.equal(r2.pill, null); assert.deepEqual(r2.builds[0]!.skills.map((s) => s.proposed), r.builds[0]!.skills.map((s) => s.proposed)); }
  });
  it('war: sustainable, with owned items and stocks', async () => {
    const f = base(); f.warKind = 'sustainable'; f.leadStock = '300'; f.gear.weapon = { equipped: true, stat1: '60', stat2: '8', usesAmmo: true, durability: '90' };
    const r = await run(f); assert.ok(r.ok, JSON.stringify(r)); if (r.ok) { assert.equal(r.kind, 'sustainable'); assert.ok(r.builds[0]!.session!.hits > 0); }
  });
  it('economic and hybrid', async () => {
    const e = base(); e.mode = 'economic'; e.econ = { marketTax: '5', incomeTax: '5', productionTax: '', jobWage: '0.8', sellBasis: 'bid', workerPoints: '', workerWage: '' };
    const re = await run(e); assert.ok(re.ok || re.reason === 'infeasible', JSON.stringify(re)); if (re.ok) assert.ok(re.builds[0]!.economy);
    for (const kind of ['constrained', 'weighted'] as const) { const h = base(); h.mode = 'hybrid'; h.econ = e.econ; h.hybrid = { kind, minDailyNet: '-100000', wCombat: '1', wEconomy: '1' }; const rh = await run(h); assert.ok(rh.ok || rh.reason === 'infeasible', JSON.stringify(rh)); if (rh.ok) assert.equal(rh.kind, 'hybrid'); }
  });
  it('rules: keep current skills and must-keep constraints change the answer', async () => {
    const f = base(); f.keepCurrent = true; f.constraints = [{ skill: 'critDamage', kind: 'min', level: '4' }]; const r = await run(f); assert.ok(r.ok, JSON.stringify(r));
    if (r.ok) for (const b of r.builds) { assert.equal(b.reset.required, false); assert.ok(b.skills.find((s) => s.id === 'critDamage')!.proposed >= 4); }
    const c = base(); c.constraints = [{ skill: 'attack', kind: 'min', level: '10' }, { skill: 'accuracy', kind: 'min', level: '10' }, { skill: 'critChance', kind: 'min', level: '10' }]; const rc = await run(c); assert.ok(!rc.ok && rc.reason === 'conflict');
  });
  it('blank inputs stay unknown: prices missing -> lower bound, not zero-cost', async () => {
    const f = base(); for (const k of ['bread', 'steak', 'cookedFish'] as const) f.food[k] = { use: true, price: '', stock: '' }; f.useMarket = true;
    const r = await run(f); assert.ok(r.ok); if (r.ok) assert.equal(r.lowerBoundCost, true);
  });
  it('the import preview exposes provenance and missing data honestly', async () => {
    const imp = await importForBuild('usr_1', deps); const vm = importViewModel(imp!);
    assert.equal(vm.player.level, 22); assert.equal(vm.provenance.skills, 'api'); assert.equal(vm.provenance.gear, 'unavailable'); assert.equal(vm.provenance.pill, 'unavailable'); assert.equal(vm.points.exact, false);
    assert.equal(vm.skills!.length, 14); assert.ok(vm.market.loaded); assert.ok(vm.offers!.total > 0); assert.equal(vm.companies.count, companies.length);
    assert.deepEqual(JSON.parse(JSON.stringify(vm)), vm);
    assert.equal(ADVISORY.has('warnTaxes'), true);
  });
});
