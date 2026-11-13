import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  RECIPES, rawRecipe, dailyEconomy, optimizeBuild, emptyLevels, cumulativeCost, SKILL_IDS, totalCost,
  type Constraint, type EconomyInput, type Levels, type OptimizeRequest, type Recipe,
} from '@/features/build-optimizer/engine';
import { recipeForMarketCode, MARKET_CODE, buildMarketSnapshot, economyPrices, buildPlayerState, toOptimizeRequest, type MarketRowLike, type ProfileLike, type CompanyLike } from '@/features/build-optimizer';
import { parseOptimizeInput } from '@/features/build-optimizer/api-schema';
import { rng, type Sk, type CSpec } from './oracle';
import { WIKI_RECIPES, WIKI_RAW_POINTS, oDaily, oBestEconomy, oWorks, oPointValue, type OCfg, type OLevels, type OGroup } from './oracle-economy';

/**
 * Batch 6 / Phase D: the economic model against an independent oracle (oracle-economy.ts) and the Wiki 02-economy tables.
 * Evidence labels stay as the registry has them: nothing here promotes an `estimated` formula to `verified`.
 */
const real = (f: string) => JSON.parse(readFileSync(`tests/fixtures/real/${f}`, 'utf8'));
const approx = (a: number, b: number, msg = '', e = 1e-7) => assert.ok(Math.abs(a - b) <= e * Math.max(1, Math.abs(a), Math.abs(b)), `${msg} ${a} !~ ${b}`);
const lv = (o: Partial<Levels> = {}): Levels => ({ ...emptyLevels(), ...o });
const PRODUCTS = ['concrete', 'steel', 'bread', 'steak', 'cookedFish', 'lightBullets', 'mediumBullets', 'heavyBullets', 'stimulant', 'oil', 'paper', 'coffee', 'fuelCell', 'limestone', 'iron', 'lead', 'cattle', 'fish', 'uranium', 'wood'];
const recipeOf = (code: string): Recipe => (RECIPES[code] ?? rawRecipe(code, WIKI_RAW_POINTS[code] ?? 1));
const toEngine = (c: OCfg): EconomyInput => ({
  companies: c.groups.map((g) => ({ count: g.count, product: recipeOf(g.product), productionBonusPct: g.bonusPct })),
  prices: c.prices, marketTaxPct: c.marketTaxPct, productionTaxPct: c.productionTaxPct, incomeTaxPct: c.incomeTaxPct,
  workers: c.workers ? { count: c.workers.count, pointsPerWorkerPerDay: c.workers.pointsPerDay, wagePerPoint: c.workers.wage } : undefined,
  job: c.jobWage === undefined ? undefined : { wagePerPoint: c.jobWage }, includeFullBar: c.fullBar,
});

function randomCfg(r: ReturnType<typeof rng>): OCfg {
  const ng = r.int(1, 3); const groups: OGroup[] = []; const used = new Set<string>();
  while (groups.length < ng) { const p = r.pick(PRODUCTS); if (used.has(p)) continue; used.add(p); groups.push({ count: r.int(1, 3), product: p, bonusPct: r.pick([0, 0, 5, 10, 30]) }); }
  const prices: OCfg['prices'] = {};
  const need = new Set<string>(); for (const g of groups) { need.add(g.product); for (const k of Object.keys(WIKI_RECIPES[g.product]?.needs ?? {})) need.add(k); }
  const roll = () => r.pick([0, 0.01, 0.5, 1, 2.5, 7, 20, 150]);
  for (const k of need) { const o: { sell?: number; buy?: number } = {}; if (!r.chance(0.07)) o.sell = roll(); if (!r.chance(0.07)) o.buy = roll(); prices[k] = o; }
  const tax = () => (r.chance(0.3) ? undefined : r.pick([0, 5, 10, 25, 45]));
  return {
    groups, prices, marketTaxPct: tax(), productionTaxPct: tax(), incomeTaxPct: tax(),
    workers: r.chance(0.5) ? { count: r.int(0, 40), pointsPerDay: r.pick([0, 50, 400, 1500]), wage: r.pick([0, 0.01, 0.2, 1]) } : undefined,
    jobWage: r.chance(0.5) ? r.pick([0, 0.05, 0.3, 1.2]) : undefined, fullBar: r.chance(0.3),
  };
}
const randLevels = (r: ReturnType<typeof rng>): Levels => { const l = emptyLevels(); for (const s of SKILL_IDS) l[s] = r.int(0, 10); return l; };

describe('Wiki 02-economy tables vs the engine (independent copy)', () => {
  it('recipes: production points and ingredients per unit match §1.2 for all 13 manufactured goods', () => {
    for (const [code, w] of Object.entries(WIKI_RECIPES)) {
      const e = RECIPES[code]!; assert.ok(e, code);
      assert.equal(e.pointsPerUnit, w.points, `${code} points`);
      assert.deepEqual(Object.fromEntries(e.ingredients.map((i) => [i.itemCode, i.qty])), w.needs, `${code} ingredients`);
    }
    assert.equal(Object.keys(RECIPES).length, Object.keys(WIKI_RECIPES).length, 'no recipe the Wiki does not list');
  });
  it('raw materials: market code -> points per unit (cattle 20, fish 40, uranium 10, everything else 1) and no ingredients', () => {
    const rawMarket: Record<string, string> = { limestone: 'limestone', grain: 'grain', cattle: 'livestock', fish: 'fish', iron: 'iron', coca: 'coca', lead: 'lead', petroleum: 'petroleum', wood: 'wood', coffeeBeans: 'coffeeBeans', uranium: 'uranium' };
    for (const [engine, market] of Object.entries(rawMarket)) {
      const r = recipeForMarketCode(market)!; assert.ok(r, market);
      assert.equal(r.pointsPerUnit, WIKI_RAW_POINTS[engine], engine); assert.deepEqual(r.ingredients, []);
    }
  });
  it('item codes: every mapped market code exists in the recorded market, and every recorded company product is modelled or known-unmodelled', () => {
    const market = (Array.isArray(real('market.json')) ? real('market.json') : real('market.json').items) as MarketRowLike[];
    const codes = new Set(market.map((m) => m.itemCode));
    for (const [engine, m] of Object.entries(MARKET_CODE)) assert.ok(codes.has(m.id), `${engine} -> ${m.id}`);
    const companies = (real('companies.json').companies ?? real('companies.json')) as CompanyLike[];
    const unmodelled = new Set(companies.map((c) => c.itemCode).filter((c) => recipeForMarketCode(c) === null));
    assert.deepEqual([...unmodelled], ['jet'], 'only the weapon (jet) has no recipe; it adds no modelled income and keeps its slot');
  });
  it('work economy basics: 10% of the maximum per hour, 10 per work', () => {
    approx(oWorks(30), 7.2); approx(oWorks(130), 31.2); approx(oWorks(30, true), 10.2);
    for (const max of [30, 56, 130, 150]) approx(dailyEconomy(lv({ business: 0 }), { companies: { count: 1, product: RECIPES.steel! }, prices: { steel: { sell: 1 }, iron: { buy: 0 } } }).ownWorksPerDay, oWorks(30));
    void 0;
  });
});

describe('dailyEconomy vs the oracle (400 seeded cases: prices missing / zero, taxes, bonuses, workers, job, slots)', () => {
  it('net, own profit, worker margin, job income, effective workers and slots agree', () => {
    const r = rng(7001); let nulls = 0, ok = 0, workersCapped = 0;
    for (let t = 0; t < 400; t++) {
      const cfg = randomCfg(r), l = randLevels(r) as Levels;
      const e = dailyEconomy(l, toEngine(cfg)), o = oDaily(l as OLevels, cfg);
      assert.equal(e.slotsOk, o.slotsOk, `case ${t} slots`);
      for (const [k, a, b] of [['net', e.net, o.net], ['own', e.ownProfit, o.own], ['workerMargin', e.workerMargin, o.workerMargin]] as const) {
        assert.equal(a === null, b === null, `case ${t} ${k} null-ness (${a} vs ${b})`);
        if (a !== null && b !== null) approx(a, b, `case ${t} ${k}`);
      }
      approx(e.jobIncome, o.job, `case ${t} job`); assert.equal(e.effectiveWorkers, o.workers, `case ${t} workers`);
      if (o.net === null) nulls++; else ok++; if (cfg.workers && cfg.workers.count > o.workers) workersCapped++;
    }
    assert.ok(ok > 100 && nulls > 50 && workersCapped > 20, `coverage ok=${ok} null=${nulls} capped=${workersCapped}`);
  });
  it('a missing price is unknown (net null), never a skipped group or a zero', () => {
    const cfg: OCfg = { groups: [{ count: 1, product: 'steel', bonusPct: 0 }, { count: 1, product: 'bread', bonusPct: 0 }], prices: { steel: { sell: 10 }, iron: { buy: 1 }, bread: { sell: 5 } } /* grain buy missing */ };
    const e = dailyEconomy(lv({ companySlots: 0 }), toEngine(cfg)); assert.equal(e.net, null); assert.ok(e.missing.some((m) => m.includes('grain')));
  });
  it('zero price is a price (not unknown): selling at 0 gives a loss equal to the ingredient cost', () => {
    const cfg: OCfg = { groups: [{ count: 1, product: 'steel', bonusPct: 0 }], prices: { steel: { sell: 0 }, iron: { buy: 2 } } };
    const e = dailyEconomy(lv({}), toEngine(cfg)); approx(oPointValue('steel', cfg)!, -2); assert.ok(e.net! < 0); approx(e.net!, oDaily(lv({}) as OLevels, cfg).net!);
  });
  it('product with 0 companies and no job earns exactly 0 (not null)', () => {
    const e = dailyEconomy(lv({}), { companies: [], prices: {} }); assert.equal(e.net, 0);
  });
  it('FINDING (registry text, Unverified): loss-making production is modelled as forced work (negative net). A player could simply not work; whether to floor at 0 needs a decision', () => {
    const cfg: OCfg = { groups: [{ count: 1, product: 'steel', bonusPct: 0 }], prices: { steel: { sell: 1 }, iron: { buy: 5 } } };
    assert.ok(dailyEconomy(lv({ business: 10, production: 10 }), toEngine(cfg)).net! < 0);
    assert.ok(oDaily(lv({ business: 10, production: 10 }) as OLevels, cfg).net! < 0, 'the oracle re-implements the registry text and agrees; this is the specified behaviour, not an implementation slip');
  });
});

describe('optimizeBuild(maxEconomy) vs exhaustive oracle (seeded)', () => {
  const ECON_SK: Sk[] = ['production', 'business', 'energy', 'leadership'];
  function request(cfg: OCfg, level: number, total: number, cons: Constraint[], cur: Levels | undefined, reset: boolean): OptimizeRequest {
    return { player: { level, totalPoints: total, currentLevels: cur }, objective: { type: 'maxEconomy' }, constraints: cons, allowReset: reset,
      combat: { gear: {}, ammo: 'none', booster: 'none', rankBonusPct: 0 }, economy: toEngine(cfg), topK: 1 };
  }
  it('240 cases: same status and same best daily net; the returned build obeys budget, unlocks and pins', () => {
    const r = rng(7002); const stats = { ok: 0, conflict: 0, infeasible: 0 };
    for (let t = 0; t < 240; t++) {
      const cfg = randomCfg(r); const level = r.pick([3, 5, 9, 12, 22, 30]); const total = r.int(0, 70);
      const cons: Constraint[] = []; const specs: CSpec[] = [];
      const n = cfg.groups.reduce((a, g) => a + g.count, 0);
      if (n > 0) specs.push({ type: 'minStat', skill: 'companySlots', value: n }); // the engine protects owned companies automatically
      const kind = r.int(0, 4);
      if (kind === 1) { const s = r.pick(ECON_SK), l = r.int(0, 10); cons.push({ id: 'pin', strength: 'mandatory', spec: { type: 'minLevel', skill: s, level: l } }); specs.push({ type: 'minLevel', skill: s, level: l }); }
      if (kind === 2) { const s = r.pick(ECON_SK), l = r.int(0, 10); cons.push({ id: 'cap', strength: 'mandatory', spec: { type: 'maxLevel', skill: s, level: l } }); specs.push({ type: 'maxLevel', skill: s, level: l }); }
      if (kind === 3 && cfg.workers && cfg.workers.count > 0) { const w = cfg.workers.count; cons.push({ id: 'cap:workers', strength: 'mandatory', spec: { type: 'minStat', skill: 'leadership', value: w } }); specs.push({ type: 'minStat', skill: 'leadership', value: w }); }
      let cur: Levels | undefined; let reset = true;
      if (kind === 4) { cur = emptyLevels(); for (const s of ECON_SK) cur[s] = r.int(0, 4); cur.attack = r.int(0, 3); reset = false; for (const s of SKILL_IDS) if (cur[s] > 0) specs.push({ type: 'minLevel', skill: s, level: cur[s] }); }
      const o = oBestEconomy(cfg, level, total, specs);
      const e = optimizeBuild(request(cfg, level, total, cons, cur, reset));
      const status = e.ok ? 'ok' : e.reason === 'conflict' ? 'conflict' : e.reason === 'infeasible' ? 'infeasible' : e.reason;
      assert.equal(status, o.status, `case ${t}: engine ${status} vs oracle ${o.status}`);
      stats[o.status]++;
      if (e.ok && o.best) {
        const b = e.builds[0]!;
        approx(b.economy!.net!, o.best.net, `case ${t} best net`);
        assert.ok(b.pointsSpent <= total, `case ${t} budget`); assert.equal(b.pointsSpent, totalCost(b.levels), `case ${t} points are counted the same way`);
        for (const s of SKILL_IDS) assert.ok(b.levels[s] === 0 || level >= ({ companySlots: 4, leadership: 9 } as Record<string, number>)[s]! || ({ companySlots: 4, leadership: 9 } as Record<string, number>)[s] === undefined, `case ${t} unlock ${s}`);
        for (const sp of specs) if (sp.type === 'minLevel') assert.ok(b.levels[sp.skill as keyof Levels] >= sp.level, `case ${t} pin`); else if (sp.type === 'maxLevel') assert.ok(b.levels[sp.skill as keyof Levels] <= sp.level, `case ${t} cap`);
        assert.equal(oDaily(b.levels as OLevels, cfg).net === null, false);
        approx(oDaily(b.levels as OLevels, cfg).net!, b.economy!.net!, `case ${t} the returned build is worth what the oracle says`);
      }
    }
    assert.ok(stats.ok > 70 && stats.conflict > 20 && stats.infeasible > 5, JSON.stringify(stats));
  });
  it('budget boundary: exactly the points the protected company slots need is feasible, one fewer is a conflict', () => {
    const cfg: OCfg = { groups: [{ count: 5, product: 'steel', bonusPct: 0 }], prices: { steel: { sell: 10 }, iron: { buy: 1 } } };
    // 5 companies need companySlots stat >= 5 -> level 3 (2 + 3) = 1+1+2 = 4 points
    const spec: CSpec[] = [{ type: 'minStat', skill: 'companySlots', value: 5 }];
    assert.equal(oBestEconomy(cfg, 30, 4, spec).status, 'ok'); assert.equal(oBestEconomy(cfg, 30, 3, spec).status, 'conflict');
    assert.equal(optimizeBuild(request(cfg, 30, 4, [], undefined, true)).ok, true);
    const e3 = optimizeBuild(request(cfg, 30, 3, [], undefined, true)); assert.ok(!e3.ok && e3.reason === 'conflict');
  });
  it('conflicting constraints are reported, never silently relaxed', () => {
    const cfg: OCfg = { groups: [{ count: 1, product: 'steel', bonusPct: 0 }], prices: { steel: { sell: 10 }, iron: { buy: 1 } } };
    const cons: Constraint[] = [{ id: 'a', strength: 'mandatory', spec: { type: 'minLevel', skill: 'production', level: 6 } }, { id: 'b', strength: 'mandatory', spec: { type: 'maxLevel', skill: 'production', level: 3 } }];
    const e = optimizeBuild(request(cfg, 30, 60, cons, undefined, true)); assert.ok(!e.ok && e.reason === 'conflict');
    assert.equal(oBestEconomy(cfg, 30, 60, [{ type: 'minLevel', skill: 'production', level: 6 }, { type: 'maxLevel', skill: 'production', level: 3 }, { type: 'minStat', skill: 'companySlots', value: 1 }]).status, 'conflict');
  });
  it('the optimum is not the cheapest or the highest-priced product: concrete beats steak on margin per point despite a lower sell price', () => {
    // steak sells for the most (60) but 1 cattle costs 50 for 18 points; concrete sells for 12 and costs 8 limestone x 0.2 for 8 points
    const cfg: OCfg = { groups: [{ count: 1, product: 'steak', bonusPct: 0 }, { count: 1, product: 'concrete', bonusPct: 0 }], prices: { steak: { sell: 60 }, cattle: { buy: 50 }, concrete: { sell: 12 }, limestone: { buy: 0.2 } }, marketTaxPct: 0, productionTaxPct: 0 };
    const v = ['steak', 'concrete'].map((p) => oPointValue(p, cfg)!);
    assert.ok(v[1]! > v[0]!, `${v}`);
    const l = lv({ business: 10, production: 10, companySlots: 0 });
    approx(dailyEconomy(l, toEngine(cfg)).ownProfit!, oDaily(l as OLevels, cfg).own!);
    approx(oDaily(l as OLevels, cfg).own!, oWorks(130) * 50 * v[1]!);
  });
  it('a 10% production bonus on a lower-margin group can make it the group the owner works in (bonus is part of the comparison)', () => {
    const cfg: OCfg = { groups: [{ count: 1, product: 'bread', bonusPct: 30 }, { count: 1, product: 'steel', bonusPct: 0 }], prices: { bread: { sell: 4 }, grain: { buy: 0.3 }, steel: { sell: 4 }, iron: { buy: 0.3 } } };
    const l = lv({ business: 10, production: 10, companySlots: 0 }); approx(dailyEconomy(l, toEngine(cfg)).ownProfit!, oDaily(l as OLevels, cfg).own!);
  });
  it('hybrid (constrained): a minimum daily net above the oracle maximum is infeasible; at the oracle maximum it is met', () => {
    const cfg: OCfg = { groups: [{ count: 2, product: 'steel', bonusPct: 0 }], prices: { steel: { sell: 10 }, iron: { buy: 1 } }, marketTaxPct: 10, incomeTaxPct: 10, jobWage: 0.5 };
    const o = oBestEconomy(cfg, 30, 60, [{ type: 'minStat', skill: 'companySlots', value: 2 }]); assert.equal(o.status, 'ok');
    const base: OptimizeRequest = { player: { level: 30, totalPoints: 60 }, objective: { type: 'hybrid', mode: 'constrained', minDailyNet: o.best!.net + 1 }, constraints: [], allowReset: true, combat: { gear: {}, ammo: 'none', booster: 'none', rankBonusPct: 0 }, economy: toEngine(cfg), topK: 1 };
    const above = optimizeBuild(base); assert.ok(!above.ok);
    const at = optimizeBuild({ ...base, objective: { type: 'hybrid', mode: 'constrained', minDailyNet: o.best!.net - 1e-6 } }); assert.ok(at.ok);
    if (at.ok) assert.ok(at.builds[0]!.economy!.net! >= o.best!.net - 1e-6 - 1e-9);
  });
});

describe('adapter -> economy with the recorded market (prices, currency, unmodelled products)', () => {
  const market = (Array.isArray(real('market.json')) ? real('market.json') : real('market.json').items) as MarketRowLike[];
  const companies = (real('companies.json').companies ?? real('companies.json')) as CompanyLike[];
  const skills = real('player-skills.json').skills as ProfileLike['skills'];
  const profile: ProfileLike = { id: 'usr_1', name: 'T', countryId: 'eg', level: 22, damage: { total: '2549826', day: null, week: null, month: null }, skills, hasSkills: true, rankCode: null };
  const gold = (s: string | null | undefined) => (s == null ? undefined : Number(BigInt(s)) / 10000); // independent money conversion

  it('sell = best bid, buy = best ask, in gold (1/10,000 units), for the products and ingredients of the owner companies', () => {
    const owned = ['steel', 'concrete', 'iron', 'limestone'].map((c) => companies.find((x) => x.itemCode === c)!);
    const state = buildPlayerState({ profile, companies: owned });
    const snap = buildMarketSnapshot(market);
    const sc = toOptimizeRequest(state, { objective: { type: 'maxEconomy' }, market: snap, taxes: { marketPct: 5, productionPct: 0, incomePct: 10 } });
    assert.ok(sc.ok, JSON.stringify(sc)); if (!sc.ok) return;
    const row = (code: string) => market.find((m) => m.itemCode === code)!;
    const cfg: OCfg = {
      groups: [{ count: 1, product: 'steel', bonusPct: 0 }, { count: 1, product: 'concrete', bonusPct: 0 }, { count: 1, product: 'iron', bonusPct: 0 }, { count: 1, product: 'limestone', bonusPct: 0 }],
      prices: Object.fromEntries(['steel', 'concrete', 'iron', 'limestone'].map((p) => [p, { sell: gold(row(p).bestBid), buy: gold(row(p).bestAsk) }])),
      marketTaxPct: 5, productionTaxPct: 0, incomePct: undefined,
    } as unknown as OCfg;
    const lvls = lv({ business: 3, production: 4, energy: 2, companySlots: 2 });
    const eng = dailyEconomy(lvls, sc.request.economy!);
    approx(eng.net!, oDaily(lvls as OLevels, cfg).net!, 'real-market net');
    assert.ok(sc.notes.some((n) => n.includes('Per-company production bonuses')), 'bonuses are disclosed as not imported');
  });
  it('a recorded market row with no ask keeps that ingredient unknown: the economy is null, not free', () => {
    const livestock = market.find((m) => m.itemCode === 'livestock')!; assert.equal(livestock.bestAsk, null);
    const steakCo: CompanyLike = { id: 'c1', itemCode: 'steak' };
    const state = buildPlayerState({ profile, companies: [steakCo] });
    // steak has no bid in the capture, so value it at the last trade; the cattle ask is still missing
    const sc = toOptimizeRequest(state, { objective: { type: 'maxEconomy' }, market: buildMarketSnapshot(market), sellBasis: 'last' });
    assert.ok(sc.ok); if (!sc.ok) return;
    const d = dailyEconomy(lv({ companySlots: 0 }), sc.request.economy!); assert.equal(d.net, null); assert.ok(d.missing.includes('price.buy.cattle'), d.missing.join());
    const res = optimizeBuild(sc.request); assert.ok(!res.ok);
  });
  it('a company making an unmodelled product (jet) keeps its slot but adds no income, and is disclosed', () => {
    const state = buildPlayerState({ profile, companies: [{ id: 'j', itemCode: 'jet' }, { id: 's', itemCode: 'steel' }] });
    const sc = toOptimizeRequest(state, { objective: { type: 'maxEconomy' }, market: buildMarketSnapshot(market) });
    assert.ok(sc.ok); if (!sc.ok) return;
    assert.ok(sc.notes.some((n) => n.includes('jet')));
    assert.equal(sc.request.constraints!.some((c) => c.spec.type === 'minStat' && c.spec.skill === 'companySlots' && c.spec.value === 2), true, 'both companies reserve slots');
  });
  it('market prices of 0 or unparsable are unknown (Batch 5), so they can never produce a free-ingredient economy', () => {
    const m = buildMarketSnapshot([{ itemCode: 'steel', bestBid: '90000', bestAsk: '100000' }, { itemCode: 'iron', bestBid: '0', bestAsk: '0' }]);
    assert.equal(economyPrices(m).iron?.buy, undefined);
  });
});

describe('request validation for economic inputs', () => {
  const base = (e: Record<string, unknown>) => ({ playerId: 'usr_1', mode: 'economic', economic: { sellBasis: 'bid', ...e } });
  it('tax rates outside the Wiki range 0-45 are rejected, valid ones accepted', () => {
    for (const k of ['marketTaxPct', 'incomeTaxPct', 'productionTaxPct']) {
      for (const bad of [-1, 46, 1000]) { const r = parseOptimizeInput(base({ [k]: bad })); assert.ok(!r.ok, `${k}=${bad}`); }
      assert.ok(parseOptimizeInput(base({ [k]: 45 })).ok, `${k}=45`); assert.ok(parseOptimizeInput(base({ [k]: 0 })).ok, `${k}=0`);
    }
  });
});
void cumulativeCost;
