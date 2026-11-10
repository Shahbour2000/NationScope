import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { importForBuild, type CompanyLike, type ImportDeps, type MarketRowLike, type OfferLike, type ProfileLike } from '@/features/build-optimizer';
import { defaultForm, parseBody, type ConstraintForm } from '@/features/build-optimizer/ui/form';
import { clearPins, isLocked, otherRules, pinCurrent, pinOf, pinnedCost, setPin } from '@/features/build-optimizer/ui/skill-pins';
import { runOptimization, userInputsOf } from '@/features/build-optimizer/run';
import type { OptimizeInput } from '@/features/build-optimizer/api-schema';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SkillPinGrid } from '@/features/build-optimizer/ui/SkillPinGrid';
import { importViewModel } from '@/features/build-optimizer/view-model';
import { en } from '@/features/build-optimizer/ui/messages.en';
import { ar } from '@/features/build-optimizer/ui/messages.ar';

const fx = (f: string) => JSON.parse(readFileSync(`tests/fixtures/real/${f}`, 'utf8'));
const profile: ProfileLike = { id: 'usr_1', name: 'Tester', countryId: 'eg', level: 22, damage: { total: '2549826', day: '0', week: '0', month: '0' }, skills: fx('player-skills.json').skills, hasSkills: true, rankCode: null };
const market = fx('market.json') as MarketRowLike[]; const offers = fx('equipment-offers.json').offers as OfferLike[];
const companies = (fx('companies.json').companies as CompanyLike[]).filter((c) => ['steel', 'concrete'].includes(c.itemCode)).slice(0, 2);
const deps: ImportDeps = { profile: async () => ({ player: profile }), companies: async () => ({ rows: companies }), stats: async () => ({}), market: async () => ({ rows: market }), offers: async (s) => ({ rows: offers.filter((o) => o.slot === s) }) };
const run = async (mode: 'war' | 'economic' | 'hybrid', cs: ConstraintForm[]) => {
  const f = { ...defaultForm(), mode, constraints: cs, pointsMethod: 'available' as const, availablePoints: '6', food: { bread: { use: true, price: '0.5', stock: '' }, steak: { use: false, price: '', stock: '' }, cookedFish: { use: false, price: '', stock: '' } }, econ: { ...defaultForm().econ, marketTax: '0' } };
  const parsed = parseBody(f, 'usr_1'); assert.ok(parsed.ok, JSON.stringify(parsed));
  const input = (parsed as { ok: true; value: OptimizeInput }).value;
  const imp = await importForBuild('usr_1', deps, userInputsOf(input)); assert.ok(imp);
  return { input, result: await runOptimization(imp!, input) };
};

describe('Skill Builder pins (UI helpers)', () => {
  it('set, replace, clear and read pins; only min rules are managed', () => {
    let cs: ConstraintForm[] = [{ skill: 'attack', kind: 'max', level: '8' }];
    cs = setPin(cs, 'attack', 3)!; assert.equal(pinOf(cs, 'attack'), 3); assert.equal(otherRules(cs, 'attack').length, 1);
    cs = setPin(cs, 'attack', 5)!; assert.equal(cs.filter((c) => c.kind === 'min').length, 1); assert.equal(pinOf(cs, 'attack'), 5);
    cs = setPin(cs, 'attack', null)!; assert.equal(pinOf(cs, 'attack'), null); assert.equal(cs.length, 1, 'the max rule is kept');
    assert.equal(setPin([], 'attack', 11), null); assert.equal(pinOf([{ skill: 'armor', kind: 'min', level: 'x' }], 'armor'), null, 'invalid text is not a pin');
  });
  it('cost of pins is the cumulative skill cost and the request limit of 14 rules is respected', () => {
    const cs = setPin(setPin([], 'attack', 3)!, 'armor', 10)!; assert.equal(pinnedCost(cs), 4 + 49);
    const many: ConstraintForm[] = Array.from({ length: 14 }, () => ({ skill: 'attack' as const, kind: 'max' as const, level: '9' }));
    assert.equal(setPin(many, 'armor', 2), null); assert.equal(clearPins(cs).length, 0);
  });
  it('locked only when the level is known and below the unlock level; unknown level never locks', () => {
    assert.equal(isLocked('dodge', 11), true); assert.equal(isLocked('dodge', 12), false); assert.equal(isLocked('dodge', null), false); assert.equal(isLocked('attack', 1), false);
  });
  it('"pin current levels" skips zero and locked skills', () => {
    const cs = pinCurrent([], { attack: 4, dodge: 2, armor: 0, health: null }, 10)!; assert.equal(pinOf(cs, 'attack'), 4); assert.equal(pinOf(cs, 'dodge'), null); assert.equal(pinOf(cs, 'armor'), null);
  });
  it('pins travel through the request body into the engine input', () => {
    const f = { ...defaultForm(), constraints: setPin([], 'attack', 4)! }; const p = parseBody(f, 'usr_1'); assert.ok(p.ok);
    assert.deepEqual((p as { ok: true; value: OptimizeInput }).value.constraints, [{ skill: 'attack', kind: 'min', level: 4 }]);
  });
});

describe('Skill Builder pins (engine effect per goal)', () => {
  it('war build: a pin is honoured in the result', async () => {
    const { result } = await run('war', setPin([], 'critChance', 3)!); assert.equal(result.ok, true, JSON.stringify(result).slice(0, 300));
    const b = (result as any).builds?.[0] ?? (result as any).sessions?.[0]; assert.ok(b, 'a build is returned');
    const lv = (b.levels ?? b.skills) as any; const v = Array.isArray(lv) ? lv.find((s: any) => s.id === 'critChance').proposed : lv.critChance; assert.ok(v >= 3, `critChance ${v}`);
  });
  it('economic goal: a combat pin is honoured (so the grid does not need to be read-only there)', async () => { const { result } = await run('economic', setPin([], 'attack', 10)!); const r = result as any; assert.equal(r.ok, true); assert.ok(r.builds[0].skills.find((x: any) => x.id === 'attack').proposed >= 10); });
  it('hybrid goal: a pin on a defensive skill is honoured', async () => { const { result } = await run('hybrid', setPin([], 'armor', 3)!); const r = result as any; assert.equal(r.ok, true); assert.ok(r.builds[0].skills.find((x: any) => x.id === 'armor').proposed >= 3); });
});

describe('Skill Builder grid (render)', () => {
  const render = async (t: typeof en, tweak?: (vm: any) => void, cs: ConstraintForm[] = []) => {
    const vm: any = importViewModel((await importForBuild('usr_1', deps))!); tweak?.(vm);
    return renderToStaticMarkup(createElement(SkillPinGrid, { t, numLocale: 'en', imp: vm, constraints: cs, onChange: () => undefined }));
  };
  it('shows all 14 skills with 10 pin segments each, in English and Arabic', async () => {
    for (const t of [en, ar]) { const html = await render(t); assert.equal((html.match(/<button[^>]*bo-seg10/g) ?? []).length, 140); assert.ok(html.includes(t.player.pinTitle)); assert.ok(html.includes(t.skills.attack)); assert.equal((html.match(/<li /g) ?? []).length, 14); }
  });
  it('pinned minimum is marked and reserves points; locked skills are disabled; unknown level never locks', async () => {
    const html = await render(en, undefined, setPin([], 'attack', 4)!); assert.ok(html.includes('≥ 4')); assert.ok(html.includes('data-edge="true"')); assert.ok(html.includes(en.player.pinReserved.replace('{n}', '7'))); /* cumulative cost of level 4 = 1+1+2+3 */
    const low = await render(en, (vm) => { vm.player.level = 5; }); assert.ok(low.includes(en.player.pinLocked.replace('{n}', '12')), 'dodge unlocks at 12'); assert.ok(low.includes('disabled'));
    const unknown = await render(en, (vm) => { vm.player.level = null; }); assert.ok(!unknown.includes(en.player.pinLocked.replace('{n}', '12')));
  });
  it('warns when pins cost more than the exactly known earned points, but not when the total is only a lower bound', async () => {
    const big = [...setPin(setPin(setPin([], 'attack', 10)!, 'armor', 10)!, 'critChance', 10)!];
    const exact = await render(en, (vm) => { vm.points.exact = true; vm.points.earned = 20; }, big); assert.ok(exact.includes(en.player.pinOverTitle));
    const lower = await render(en, (vm) => { vm.points.exact = false; vm.points.earned = 20; }, big); assert.ok(!lower.includes(en.player.pinOverTitle));
  });
});
