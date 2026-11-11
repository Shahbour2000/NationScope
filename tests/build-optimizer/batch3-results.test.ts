import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { importForBuild, type CompanyLike, type ImportDeps, type MarketRowLike, type OfferLike, type ProfileLike } from '@/features/build-optimizer';
import { defaultForm, parseBody, type FormState } from '@/features/build-optimizer/ui/form';
import { runOptimization, userInputsOf } from '@/features/build-optimizer/run';
import type { OptimizeInput } from '@/features/build-optimizer/api-schema';
import type { ResultOk } from '@/features/build-optimizer/view-model';
import { cumulativeCost } from '@/features/build-optimizer/engine/skills';
import { comparisonMatrix, currentPointsSpent, deltaOf, gearSummary, skillSummary } from '@/features/build-optimizer/ui/result-cards';
import { ResultsPanel } from '@/features/build-optimizer/ui/ResultsPanel';
import { en } from '@/features/build-optimizer/ui/messages.en';
import { ar } from '@/features/build-optimizer/ui/messages.ar';

const fx = (f: string) => JSON.parse(readFileSync(`tests/fixtures/real/${f}`, 'utf8'));
const profile: ProfileLike = { id: 'usr_1', name: 'Tester', countryId: 'eg', level: 22, damage: { total: '2549826', day: '0', week: '0', month: '0' }, skills: fx('player-skills.json').skills, hasSkills: true, rankCode: null };
const market = fx('market.json') as MarketRowLike[]; const offers = fx('equipment-offers.json').offers as OfferLike[];
const companies = (fx('companies.json').companies as CompanyLike[]).filter((c) => ['steel', 'concrete'].includes(c.itemCode)).slice(0, 2);
const deps: ImportDeps = { profile: async () => ({ player: profile }), companies: async () => ({ rows: companies }), stats: async () => ({}), market: async () => ({ rows: market }), offers: async (s) => ({ rows: offers.filter((o) => o.slot === s) }) };
const run = async (tweak: Partial<FormState>): Promise<ResultOk> => {
  const f: FormState = { ...defaultForm(), pointsMethod: 'available', availablePoints: '6', food: { bread: { use: true, price: '0.5', stock: '' }, steak: { use: false, price: '', stock: '' }, cookedFish: { use: false, price: '', stock: '' } }, econ: { ...defaultForm().econ, marketTax: '0' }, ...tweak };
  const parsed = parseBody(f, 'usr_1'); assert.ok(parsed.ok, JSON.stringify(parsed));
  const input = (parsed as { ok: true; value: OptimizeInput }).value; const imp = await importForBuild('usr_1', deps, userInputsOf(input)); assert.ok(imp);
  const r = await runOptimization(imp!, input); assert.equal(r.ok, true, JSON.stringify(r).slice(0, 300)); return r as ResultOk;
};
const ids = (r: ResultOk) => comparisonMatrix(r).map((x) => x.def.id);
const html = (r: ResultOk, t: typeof en) => renderToStaticMarkup(createElement(ResultsPanel, { result: r, t, numLocale: 'en' }));

describe('Result cards: data mapping from real engine output', () => {
  it('war: Before/After comes from the engine\'s current build; delta is exact subtraction; cost has no Before', async () => {
    const r = await run({ mode: 'war' }); const m = comparisonMatrix(r); assert.ok(r.current);
    const dmg = m.find((x) => x.def.id === 'damage')!; assert.equal(dmg.before.value, r.current!.damage); assert.equal(dmg.after[0]!.value, r.builds[0]!.combat!.damage);
    const d = deltaOf(dmg.def, dmg.before.value, dmg.after[0]!.value)!; assert.equal(d.delta, r.builds[0]!.combat!.damage - r.current!.damage!);
    assert.equal(m.find((x) => x.def.id === 'perHit')!.before.value, r.current!.perHit); assert.equal(m.find((x) => x.def.id === 'lossPerHit')!.before.value, r.current!.lossPerHit);
    const cost = m.find((x) => x.def.id === 'totalCost'); if (cost) assert.equal(cost.before.value, null, 'no current cost is returned, so none is shown');
  });
  it('derived "points before" matches how the engine counts points (cost of proposed levels equals pointsSpent)', async () => {
    const r = await run({ mode: 'war' });
    for (const b of r.builds) assert.equal(b.skills.reduce((s, k) => s + cumulativeCost(k.proposed), 0), b.pointsSpent);
    assert.equal(currentPointsSpent(r.builds[0]!), r.builds[0]!.skills.reduce((s, k) => s + cumulativeCost(k.current!), 0));
  });
  it('sustainable: damage, sustainable hits, per hit and health loss all have a Before', async () => {
    const r = await run({ mode: 'war', warKind: 'sustainable' }); const m = comparisonMatrix(r);
    for (const id of ['damage', 'sustainHits', 'perHit', 'lossPerHit'] as const) assert.notEqual(m.find((x) => x.def.id === id)?.before.value ?? null, null, id);
  });
  it('economic: daily net Before is the engine\'s current economy net, and no combat rows appear', async () => {
    const r = await run({ mode: 'economic' }); const m = comparisonMatrix(r); assert.equal(m.find((x) => x.def.id === 'dailyNet')!.before.value, r.current!.economyNet);
    assert.ok(!ids(r).includes('damage') && !ids(r).includes('perHit'));
  });
  it('hybrid: only per hit and daily net are compared (the engine returns no current damage for hybrid)', async () => {
    const r = await run({ mode: 'hybrid' }); const list = ids(r); assert.ok(list.includes('perHit') && list.includes('dailyNet')); assert.ok(!list.includes('damage') && !list.includes('lossPerHit'));
  });
  it('without a current build there are no Before values and no deltas, never zeros', async () => {
    const r = await run({ mode: 'war' }); const none: ResultOk = { ...r, current: null };
    for (const row of comparisonMatrix(none).filter((x) => x.def.id !== 'points')) { assert.equal(row.before.value, null); assert.equal(deltaOf(row.def, row.before.value, row.after[0]!.value), null); }
  });
  it('delta tone follows the metric direction; percent only for a positive base; ties get no "best" badge', () => {
    const d = (id: 'lossPerHit' | 'perHit' | 'points') => ({ lossPerHit: { id, digits: 2, money: false, better: 'lower' as const }, perHit: { id, digits: 1, money: false, better: 'higher' as const }, points: { id, digits: 0, money: false, better: 'none' as const } }[id]);
    assert.equal(deltaOf(d('lossPerHit'), 5, 4)!.tone, 'good'); assert.equal(deltaOf(d('perHit'), 100, 90)!.tone, 'bad'); assert.equal(deltaOf(d('points'), 3, 9)!.tone, 'neutral'); assert.equal(deltaOf(d('perHit'), 0, 10)!.pct, null); assert.equal(deltaOf(d('perHit'), -5, 10)!.pct, null); assert.equal(deltaOf(d('perHit'), 50, 50)!.tone, 'neutral');
  });
  it('skill and gear summaries count changed / unchanged / unknown and owned / to buy / empty', async () => {
    const r = await run({ mode: 'war' }); const b = r.builds[0]!; const s = skillSummary(b);
    assert.equal(s.changed.length + s.unchanged + s.unknownCurrent, b.skills.length); for (const c of s.changed) assert.notEqual(c.from, c.to);
    const unknown = skillSummary({ ...b, skills: b.skills.map((k) => ({ ...k, current: null })) }); assert.equal(unknown.unknownCurrent, b.skills.length); assert.equal(unknown.changed.length, 0);
    const g = gearSummary(b); if (g) assert.equal(g.owned + g.toBuy + g.empty, b.gear!.length);
  });
});

describe('Result cards: rendering', () => {
  it('shows one card per build plus the Before / After table, in EN and AR; no tabs; full details are kept inside each card', async () => {
    for (const mode of ['war', 'economic', 'hybrid'] as const) {
      const r = await run({ mode });
      for (const t of [en, ar]) {
        const h = html(r, t);
        assert.equal((h.match(/class="bo-build bo-rcard"/g) ?? []).length, r.builds.length); assert.ok(h.includes(t.results.beforeAfterTitle)); assert.ok(h.includes(t.results.colCurrent)); assert.ok(h.includes(t.results.changesTitle));
        assert.ok(!h.includes('role="tab"')); assert.equal((h.match(/<details class="bo-more"/g) ?? []).length, r.builds.length); assert.ok(h.includes(t.results.skillsTitle)); assert.ok(h.includes(t.results.assumptionsTitle));
      }
    }
  });
  it('a single build opens its details; a missing current build is explained instead of showing zeros', async () => {
    const r = await run({ mode: 'war' }); const one: ResultOk = { ...r, builds: [r.builds[0]!], current: null };
    const h = html(one, en); assert.ok(h.includes('<details class="bo-more" open=""')); assert.ok(h.includes(en.results.noCurrent));
  });
  it('lists what the engine could not include in the current build', async () => {
    const r = await run({ mode: 'war' }); const h = html({ ...r, current: { ...r.current!, missing: ['rank bonus'] } }, en); assert.ok(h.includes(en.results.currentMissing)); assert.ok(h.includes('rank bonus'));
  });
});
