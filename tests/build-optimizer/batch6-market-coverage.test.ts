import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { importForBuild, offersToCandidates, spreadByPrice, OFFER_MAX_PAGES, OFFER_PAGE_SIZE, type ImportDeps, type OfferLike, type ProfileLike } from '@/features/build-optimizer';
import { rng } from './oracle';

/**
 * Batch 6: the two approved market-coverage fixes.
 *  (1) offers are read page by page by following `nextOffset`, with hard bounds (page cap, no non-advancing offset, no empty page);
 *  (2) when a slot has more Pareto-optimal offers than the cap, the cheapest, the dearest and evenly spaced ones are kept.
 * Pagination contract: GET /equipment takes limit 1-60 and offset 0-10000 (src/lib/api/endpoints.ts) and returns `nextOffset`. Only ONE capture shows
 * `nextOffset` (30 with 30 rows, 2026-10-17); "null / absent on the last page" is inferred, not recorded.
 */
const skills = [['energy', 1], ['stamina', 0], ['health', 4], ['hunger', 3], ['attack', 5], ['companies', 0], ['entrepreneurship', 1], ['production', 4], ['criticalChance', 5], ['criticalDamages', 4], ['armor', 5], ['precision', 4], ['dodge', 5], ['lootChance', 4], ['management', 0]]
  .map(([code, level]) => ({ code: code as string, level: level as number, maxLevel: code === 'stamina' ? 0 : 10 }));
const profile: ProfileLike = { id: 'usr_1', name: 'T', countryId: 'eg', level: 22, damage: { total: '1', day: null, week: null, month: null }, skills, hasSkills: true, rankCode: null };
const helmet = (i: number, o: Partial<OfferLike> = {}): OfferLike => ({ offerId: `h${i}`, itemCode: 'helmet2', rarity: 'uncommon', slot: 'helmet', stats: { criticalDamages: 10 + i }, durability: 100, price: String((i + 1) * 100000), ...o });

/** A fake API: `all` offers of one slot sorted cheapest first, served in pages of `limit` the way the capture shows (nextOffset = offset + rows). */
function pagedDeps(all: Record<string, OfferLike[]>, log: { slot: string; offset?: number }[], opts: { failAtOffset?: number; limit?: number } = {}): ImportDeps {
  const limit = opts.limit ?? OFFER_PAGE_SIZE;
  return {
    profile: async () => ({ player: profile }), companies: async () => ({ rows: [] }), stats: async () => ({}), market: async () => ({ rows: [] }),
    offers: async (slot, offset) => {
      log.push({ slot, offset });
      const o = offset ?? 0;
      if (opts.failAtOffset !== undefined && o === opts.failAtOffset) throw new Error('503');
      const rows = (all[slot] ?? []).slice(o, o + limit);
      return { rows, nextOffset: o + limit < (all[slot] ?? []).length ? o + limit : null };
    },
  };
}

describe('offer pagination (follows nextOffset, bounded)', () => {
  it('constants: API maximum page size and a small page cap (at most 6 slots x 3 pages = 18 requests)', () => {
    assert.equal(OFFER_PAGE_SIZE, 60); assert.equal(OFFER_MAX_PAGES, 3);
  });
  it('a strong offer beyond the first page is now seen (before: only the first 30 cheapest per slot were read)', async () => {
    const all = Array.from({ length: 100 }, (_, i) => helmet(i)); // h99 is the dearest and strongest
    const log: { slot: string; offset?: number }[] = [];
    const imp = await importForBuild('usr_1', pagedDeps({ helmet: all }, log, { limit: 30 }));
    assert.equal(imp!.offerCoverage!['helmet']!.fetched, 90, 'three pages of 30');
    assert.equal(imp!.offerCoverage!['helmet']!.moreAvailable, true, 'the 4th page was not read and that is recorded');
    assert.deepEqual(log.filter((l) => l.slot === 'helmet').map((l) => l.offset), [undefined, 30, 60]);
  });
  it('with real page size the 180 cheapest offers per slot are read; an exhausted slot stops by itself', async () => {
    const log: { slot: string; offset?: number }[] = [];
    const imp = await importForBuild('usr_1', pagedDeps({ helmet: Array.from({ length: 170 }, (_, i) => helmet(i)), boots: [] }, log));
    assert.equal(imp!.offerCoverage!['helmet']!.fetched, 170); assert.equal(imp!.offerCoverage!['helmet']!.pages, 3); assert.equal(imp!.offerCoverage!['helmet']!.moreAvailable, false);
    assert.equal(imp!.offerCoverage!['boots']!.pages, 1);
    assert.ok(log.length <= 6 * OFFER_MAX_PAGES, `${log.length} requests`);
    assert.equal(log.filter((l) => l.slot === 'helmet').length, 3);
  });
  it('page cap: never more than OFFER_MAX_PAGES requests per slot, however many pages the API offers', async () => {
    const log: { slot: string; offset?: number }[] = [];
    const imp = await importForBuild('usr_1', pagedDeps({ helmet: Array.from({ length: 5000 }, (_, i) => helmet(i)) }, log));
    assert.equal(log.filter((l) => l.slot === 'helmet').length, OFFER_MAX_PAGES);
    assert.equal(imp!.offerCoverage!['helmet']!.moreAvailable, true);
  });
  it('an offset that does not advance, or an empty page that still reports a next page, stops the loop and is reported (no endless requests)', async () => {
    let calls = 0;
    const stuck: ImportDeps = { ...pagedDeps({}, []), offers: async (slot) => { if (slot !== 'helmet') return { rows: [], nextOffset: null }; calls++; return { rows: [helmet(calls)], nextOffset: 30 }; } };
    const imp = await importForBuild('usr_1', stuck);
    assert.equal(calls, 2, 'first page, then one request at offset 30, then stop because 30 did not advance past 30');
    assert.equal(imp!.offerCoverage!['helmet']!.moreAvailable, true);
    let empty = 0;
    const emptyPage: ImportDeps = { ...pagedDeps({}, []), offers: async (slot, offset) => { if (slot !== 'helmet') return { rows: [], nextOffset: null }; empty++; return { rows: (offset ?? 0) === 0 ? [helmet(0)] : [], nextOffset: (offset ?? 0) + 60 }; } };
    await importForBuild('usr_1', emptyPage);
    assert.equal(empty, 2);
  });
  it('a failure on a later page keeps the rows already read, records the failure, and marks coverage incomplete', async () => {
    const log: { slot: string; offset?: number }[] = [];
    const imp = await importForBuild('usr_1', pagedDeps({ helmet: Array.from({ length: 100 }, (_, i) => helmet(i)) }, log, { limit: 30, failAtOffset: 60 }));
    assert.equal(imp!.failures['equipment:helmet'], '503');
    assert.equal(imp!.offerCoverage!['helmet']!.fetched, 60); assert.equal(imp!.offerCoverage!['helmet']!.moreAvailable, true);
    assert.ok(imp!.candidates!.candidates.helmets!.length > 0);
  });
  it('a failure on the first page is a failure with no coverage entry (nothing was read)', async () => {
    const imp = await importForBuild('usr_1', pagedDeps({ helmet: [helmet(0)] }, [], { failAtOffset: 0 }));
    assert.equal(imp!.failures['equipment:helmet'], '503'); assert.equal(imp!.offerCoverage!['helmet'], undefined);
  });
  it('the same offer on two pages is one candidate (offers can move between pages while paging)', async () => {
    const dup: ImportDeps = { ...pagedDeps({}, []), offers: async (slot, offset) => (slot === 'helmet' ? { rows: [helmet(0), helmet(1)], nextOffset: (offset ?? 0) === 0 ? 2 : null } : { rows: [], nextOffset: null }) };
    const imp = await importForBuild('usr_1', dup);
    assert.deepEqual(imp!.candidates!.candidates.helmets!.map((h) => h.id).sort(), ['h0', 'h1']);
    assert.ok(imp!.candidates!.skipped.some((s) => s.reason.startsWith('duplicate offer')));
  });
  it('callers that ignore the offset argument and report no next page still work (single request per slot)', async () => {
    let n = 0;
    const d: ImportDeps = { ...pagedDeps({}, []), offers: async () => { n++; return { rows: [] }; } };
    await importForBuild('usr_1', d); assert.equal(n, 6);
  });
});

describe('per-slot candidate cap: spread selection', () => {
  it('spreadByPrice: identity within the cap; cheapest, dearest and even ranks above it; deterministic; exactly cap entries', () => {
    const xs = Array.from({ length: 12 }, (_, i) => i);
    assert.deepEqual(spreadByPrice(xs.slice(0, 5), 6), [0, 1, 2, 3, 4]);
    assert.deepEqual(spreadByPrice(xs, 6), [0, 2, 4, 7, 9, 11]);
    assert.deepEqual(spreadByPrice(xs, 2), [0, 11]); assert.deepEqual(spreadByPrice(xs, 1), [0]); assert.deepEqual(spreadByPrice(xs, 0), []);
    assert.deepEqual(spreadByPrice(xs, 6), spreadByPrice(xs, 6));
    for (let n = 1; n <= 40; n++) for (let cap = 1; cap <= 12; cap++) {
      const r = spreadByPrice(Array.from({ length: n }, (_, i) => i), cap);
      assert.equal(r.length, Math.min(n, cap), `n=${n} cap=${cap}`);
      assert.equal(new Set(r).size, r.length); assert.deepEqual([...r].sort((a, b) => a - b), r);
      if (n > cap && cap >= 2) { assert.equal(r[0], 0); assert.equal(r[r.length - 1], n - 1); }
    }
  });
  it('INDEPENDENT CHECK: for every budget, the best affordable stat lost by the cap is smaller than with "cheapest N" (worst-case rank regret)', () => {
    // Front = offers with strictly rising price AND stat (a Pareto front of a single-stat slot). Best under budget B = last offer with price <= B.
    const n = 12, cap = 6;
    const front = Array.from({ length: n }, (_, i) => ({ price: (i + 1) * 100, stat: 10 + i }));
    const regret = (kept: typeof front) => Math.max(...front.map((_, b) => { const best = front[b]!.stat; const have = Math.max(...kept.filter((k) => k.price <= front[b]!.price).map((k) => k.stat)); return best - have; }));
    const old = regret(front.slice(0, cap)), neu = regret(spreadByPrice(front, cap));
    assert.equal(old, n - cap); assert.ok(neu < old, `${neu} < ${old}`); assert.ok(neu <= Math.ceil((n - 1) / (cap - 1)));
  });
  it('INDEPENDENT CHECK (seeded): the rank regret per budget is bounded by the spacing of kept ranks and never exceeds cheapest-N; the unlimited-budget optimum is kept', () => {
    // Bounded in RANK terms only: with irregular stat steps neither strategy can promise a smaller loss in stat units for every budget.
    const r = rng(60606);
    for (let t = 0; t < 120; t++) {
      const n = r.int(7, 30), cap = r.int(2, 8);
      const front = Array.from({ length: n }, (_, i) => i); // rank = price order on a Pareto front
      const spread = spreadByPrice(front, cap), cheapest = front.slice(0, cap);
      const rankRegret = (kept: number[]) => Math.max(...front.map((b) => b - Math.max(...kept.filter((k) => k <= b))));
      const gap = Math.ceil((n - 1) / (cap - 1));
      assert.ok(rankRegret(spread) <= gap - 1, `case ${t}: ${rankRegret(spread)} <= ${gap - 1}`);
      assert.ok(rankRegret(spread) <= rankRegret(cheapest), `case ${t}`);
      assert.ok(spread.includes(n - 1), 'unlimited budget: the dearest is present');
    }
  });
  it('offersToCandidates: the strongest helmet survives, mixed with cheap ones; fewer than cap are untouched; prunedAway counts the rest', () => {
    const many = Array.from({ length: 30 }, (_, i) => helmet(i));
    const c = offersToCandidates(many);
    const ids = c.candidates.helmets!.map((h) => h.id);
    assert.equal(ids.length, 6); assert.ok(ids.includes('h0') && ids.includes('h29'));
    assert.equal(c.prunedAway['helmets'], 24);
    assert.deepEqual(offersToCandidates(many.slice(0, 6)).prunedAway, {});
    assert.equal(offersToCandidates(many, { maxPerSlot: 30 }).candidates.helmets!.length, 30);
  });
  it('dominated offers are still removed first (the cap only applies to Pareto-optimal ones)', () => {
    const worse = helmet(9, { offerId: 'worse', stats: { criticalDamages: 5 }, price: '999999' }); // dearer AND weaker than h0
    const c = offersToCandidates([helmet(0), worse, helmet(1), helmet(2)]);
    assert.deepEqual(c.candidates.helmets!.map((h) => h.id), ['h0', 'h1', 'h2']);
    assert.deepEqual(c.prunedAway, {}, 'a dominated offer is not a cap loss');
  });
});
