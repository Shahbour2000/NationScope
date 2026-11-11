import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { importForBuild, type CompanyLike, type ImportDeps, type MarketRowLike, type OfferLike, type ProfileLike } from '@/features/build-optimizer';
import { importViewModel } from '@/features/build-optimizer/view-model';
import { defaultForm, parseBody, type FormState } from '@/features/build-optimizer/ui/form';
import { en } from '@/features/build-optimizer/ui/messages.en';
import { ar } from '@/features/build-optimizer/ui/messages.ar';
import { GearTiles } from '@/features/build-optimizer/ui/GearTiles';
import { ConsumableTiles } from '@/features/build-optimizer/ui/ConsumableTiles';
import { CompanyStrip } from '@/features/build-optimizer/ui/CompanyStrip';
import { GoalPanel } from '@/features/build-optimizer/ui/GoalPanel';
import { PlayerPanel } from '@/features/build-optimizer/ui/PlayerPanel';
import { sectionsFor } from '@/features/build-optimizer/ui/form';
import type { OptimizeInput } from '@/features/build-optimizer/api-schema';

const fx = (f: string) => JSON.parse(readFileSync(`tests/fixtures/real/${f}`, 'utf8'));
const profile: ProfileLike = { id: 'usr_1', name: 'Tester', countryId: 'eg', level: 22, damage: { total: '2549826', day: '0', week: '0', month: '0' }, skills: fx('player-skills.json').skills, hasSkills: true, rankCode: null };
const market = fx('market.json') as MarketRowLike[]; const offers = fx('equipment-offers.json').offers as OfferLike[];
const companies = (fx('companies.json').companies as CompanyLike[]).filter((c) => ['steel', 'concrete'].includes(c.itemCode)).slice(0, 2);
const deps: ImportDeps = { profile: async () => ({ player: profile }), companies: async () => ({ rows: companies }), stats: async () => ({}), market: async () => ({ rows: market }), offers: async (s) => ({ rows: offers.filter((o) => o.slot === s) }) };
const noop = () => undefined;
const html = (el: any) => renderToStaticMarkup(el);
const vm = async (tweak?: (v: any) => void) => { const v: any = importViewModel((await importForBuild('usr_1', deps))!); tweak?.(v); return v; };

describe('Gear tiles', () => {
  it('renders six slot tiles in EN and AR; fixed and owned modes use different labels; summaries come from the form', () => {
    for (const t of [en, ar]) {
      const f = defaultForm(); f.gear.weapon = { equipped: true, stat1: '120', stat2: '18', usesAmmo: true, durability: '80' };
      const fixed = html(createElement(GearTiles, { t, gear: f.gear, fixed: true, update: noop, hasError: false }));
      assert.equal((fixed.match(/class="bo-tile"/g) ?? []).length, 6); assert.ok(fixed.includes('120 / 18')); assert.ok(fixed.includes(t.data.tileHaveFixed)); assert.ok(fixed.includes(t.data.tileEmpty));
      const owned = html(createElement(GearTiles, { t, gear: f.gear, fixed: false, update: noop, hasError: true }));
      assert.ok(owned.includes(t.data.tileHaveOwned)); assert.ok(owned.includes(t.data.tileNone)); assert.ok(owned.includes('data-error="true"'));
    }
  });
  it('the weapon editor exposes exactly the existing inputs (attack, crit chance, durability, uses ammo)', () => {
    const f = defaultForm(); f.gear.weapon.equipped = true;
    const h = html(createElement(GearTiles, { t: en, gear: f.gear, fixed: true, update: noop, hasError: false }));
    for (const id of ['bo-weapon-1', 'bo-weapon-2', 'bo-weapon-d']) assert.ok(h.includes(`id="${id}"`), id); assert.ok(h.includes(en.data.usesAmmo));
  });
  it('gear typed through the tiles reaches the engine input unchanged', () => {
    const f: FormState = { ...defaultForm(), mode: 'war', gearMode: 'fixed' }; f.gear.weapon = { equipped: true, stat1: '120', stat2: '18', usesAmmo: true, durability: '80' };
    const p = parseBody(f, 'usr_1'); assert.ok(JSON.stringify(p).includes('120'));
  });
});

describe('Consumable tiles', () => {
  const render = (t: typeof en, f: FormState, showPill = true, ammoError = false, foodError = false) => html(createElement(ConsumableTiles, { t, form: f, update: noop, showPill, ammoError, foodError }));
  it('shows allowed/excluded state for ammo and foods and only shows the Pill tile where the engine supports it', () => {
    for (const t of [en, ar]) {
      const f = defaultForm(); f.ammo = { none: false, light: true, medium: false, heavy: false }; f.food.bread = { use: true, price: '0.5', stock: '' };
      const h = render(t, f); assert.ok(h.includes(t.data.tileAllowed)); assert.ok(h.includes(t.data.tileExcluded)); assert.ok(h.includes(`0.5 ${t.data.gold}`)); assert.ok(h.includes(t.data.tilePillOff));
      assert.equal(render(t, f, false).includes(t.data.tilePillHelp), false, 'no Pill tile for fights the engine cannot plan a Pill for');
    }
    assert.equal(sectionsFor({ ...defaultForm(), mode: 'war', warKind: 'sustainable' }).pill, false); assert.equal(sectionsFor({ ...defaultForm(), mode: 'war', warKind: 'fixedHits' }).pill, true);
  });
  it('excluded ammo / foods without price surface the existing validation messages', () => {
    const h = render(en, defaultForm(), true, true, true); assert.ok(h.includes(en.data.needAmmo)); assert.ok(h.includes(en.data.needFoodPrices));
  });
  it('tile state is the same state the request body is built from (allowed ammo / foods)', () => {
    const war = (f: FormState) => JSON.stringify((parseBody(f, 'usr_1') as any).value.war);
    const some: FormState = { ...defaultForm(), mode: 'war' }; some.ammo = { none: false, light: true, medium: false, heavy: false };
    const all: FormState = { ...defaultForm(), mode: 'war' }; all.ammo = { none: true, light: true, medium: true, heavy: true };
    assert.ok(war(some).includes('light')); assert.ok(!war(some).includes('heavy'), 'excluded ammo is not sent'); assert.ok(war(all).includes('heavy'), 'allowed ammo is sent');
  });
});

describe('Company tiles (read-only information)', () => {
  it('lists imported companies, is not interactive, and states honestly when they are unknown or absent', async () => {
    const v = await vm(); const h = html(createElement(CompanyStrip, { t: en, numLocale: 'en', imp: v }));
    assert.ok(h.includes(en.data.companiesTitle)); assert.ok(h.includes('steel') || h.includes('concrete')); assert.ok(!h.includes('<button')); assert.ok(h.includes(en.data.companiesNote));
    assert.ok(html(createElement(CompanyStrip, { t: ar, numLocale: 'en', imp: { ...v, companies: { count: null, products: [] } } })).includes(ar.data.companiesUnknown));
    assert.ok(html(createElement(CompanyStrip, { t: en, numLocale: 'en', imp: { ...v, companies: { count: 0, products: [] } } })).includes(en.data.companiesNone));
  });
});

describe('Goal step', () => {
  const g = (t: typeof en, f: FormState) => html(createElement(GoalPanel, { t, form: f, set: noop }));
  it('the "next step asks for" list matches sectionsFor for every goal, in EN and AR', () => {
    for (const t of [en, ar]) {
      const war = g(t, { ...defaultForm(), mode: 'war', warKind: 'fixedHits', gearMode: 'fixed' }); assert.ok(war.includes(t.data.consumablesTitle)); assert.ok(war.includes(t.data.gearFixedTitle)); assert.ok(war.includes(t.data.pillTitle));
      const sus = g(t, { ...defaultForm(), mode: 'war', warKind: 'sustainable', gearMode: 'optimize' }); assert.ok(sus.includes(t.data.gearOwnedTitle)); assert.ok(!sus.includes(t.data.pillTitle + ' ·'), 'no Pill section for sustainable');
      const eco = g(t, { ...defaultForm(), mode: 'economic' }); assert.ok(eco.includes(t.data.economicTitle)); assert.ok(!eco.includes(t.data.consumablesTitle));
      const hyb = g(t, { ...defaultForm(), mode: 'hybrid' }); assert.ok(hyb.includes(t.data.hybridTitle)); assert.ok(hyb.includes(t.goal.hybrid));
    }
  });
});

describe('Player step', () => {
  it('no longer renders the developer-facing availability card; reports unreadable data in plain words', async () => {
    const v = await vm((x) => { x.provenance.companies = 'unavailable'; x.market.loaded = false; });
    const h = html(createElement(PlayerPanel, { t: en, numLocale: 'en', imp: v, state: 'ready' as any, error: null, onSelect: noop, skillsSlot: null }));
    assert.ok(!h.includes(en.player.availabilityTitle)); assert.ok(h.includes('could not be read')); assert.ok(h.includes(en.player.fCompanies)); assert.ok(h.includes(en.data.companiesTitle));
    const ok = html(createElement(PlayerPanel, { t: en, numLocale: 'en', imp: await vm(), state: 'ready' as any, error: null, onSelect: noop, skillsSlot: null })); assert.ok(!ok.includes('could not be read'));
  });
});
