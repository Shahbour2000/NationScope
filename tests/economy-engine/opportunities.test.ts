import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { activityFromTrades, findOpportunities, unitsPerDay } from "@/features/economy-engine/domain/opportunities";
import { recommend, QUICK_PAYBACK_DAYS } from "@/features/economy-engine/domain/recommendations";
import { bucketSeries, polyline } from "@/features/economy-engine/domain/series";
import { RECIPES } from "@/features/economy-engine/domain/recipes";
import { valuePerPP } from "@/features/economy-engine/domain/economics";
import type { MarketRowIn, Analysis } from "@/features/economy-engine/domain/engine";

const fx = (n: string) => JSON.parse(readFileSync(`tests/fixtures/real/${n}.json`, "utf8"));
const rows = new Map<string, MarketRowIn>((fx("market") as Record<string, string | number | null>[]).map((r) => [r.itemCode as string, {
  itemCode: r.itemCode as string, bestAsk: r.bestAsk == null ? null : BigInt(r.bestAsk as string), askQty: r.askQty as number | null,
  bestBid: r.bestBid == null ? null : BigInt(r.bestBid as string), bidQty: r.bidQty as number | null, last: r.last == null ? null : BigInt(r.last as string) }]));
const trades = (fx("market-trades") as { itemCode: string; qty: number; createdAt: string }[]).map((t) => ({ itemCode: t.itemCode, qty: t.qty, at: Date.parse(t.createdAt) }));
const NOW = Math.max(...trades.map((t) => t.at)) + 60_000;
const base = { rows, taxes: { marketBp: 1000n, productionBp: 0n }, recipes: RECIPES, referenceWage: 1000n, capacityPP: null, capital: null };

describe("activity sample from real all-items trades", () => {
  const a = activityFromTrades(trades, NOW);
  it("counts every valid trade once", () => { expect(a.tradeCount).toBe(trades.length); let u = 0; for (const x of a.byItem.values()) u += x.units; expect(u).toBe(trades.reduce((s, t) => s + t.qty, 0)); });
  it("gives no rate when the sample is too small or too short", () => {
    expect(unitsPerDay(activityFromTrades(trades.slice(0, 5), NOW), "grain")).toBeNull();
    expect(unitsPerDay(activityFromTrades([], NOW), "grain")).toBeNull();
  });
  it("ignores future, zero and non-finite rows", () => { expect(activityFromTrades([{ itemCode: "x", qty: 0, at: 1 }, { itemCode: "x", qty: 5, at: NOW + 9e9 }, { itemCode: "x", qty: 5, at: NaN }], NOW).tradeCount).toBe(0); });
});

describe("opportunity detector (real market.json)", () => {
  const act = activityFromTrades(trades, NOW);
  const opps = findOpportunities({ ...base, activity: act });
  it("covers every recipe and never invents a price", () => {
    expect(opps).toHaveLength(RECIPES.length);
    for (const o of opps) { if (o.recipe.inputs && o.ingredientCost === null) expect(o.vppInstant).toBeNull(); }
    for (const o of opps) expect(o.signals.includes("no-bids")).toBe((rows.get(o.item)?.bestBid ?? null) === null);
    expect(opps.find((o) => o.item === "cookedFish")!.signals).toContain("thin-depth");
  });
  it("value per PP matches the economics module exactly", () => {
    const c = opps.find((o) => o.item === "concrete")!;
    expect(c.vppInstant).toBe(valuePerPP({ unitPrice: 32400n, ppPerUnit: 8, ingredientCostPerUnit: 8n * 3490n, taxes: base.taxes }).perPP);
    expect(c.headroom).toBe(c.vppInstant! - 1000n);
  });
  it("daily profit = headroom x PP the visible bids can absorb (capacity unknown)", () => {
    const c = opps.find((o) => o.item === "concrete")!;
    expect(c.absorbablePP).toBe(309n * 8n); expect(c.planPP).toBe(309n * 8n);
    expect(c.dailyProfit).toBe(c.headroom! > 0n ? c.headroom! * 309n * 8n : 0n);
  });
  it("capacity caps the plan; capital decides affordability", () => {
    const o = findOpportunities({ ...base, activity: null, capacityPP: 100n, capital: 1n }).find((x) => x.item === "concrete")!;
    expect(o.planPP).toBe(100n); expect(o.affordable).toBe(false);
    expect(o.startCost).toBe(1000n * 100n + (100n * 8n * 3490n) / 8n);
    expect(findOpportunities({ ...base, activity: null, capacityPP: 100n, capital: 10n ** 9n }).find((x) => x.item === "concrete")!.affordable).toBe(true);
  });
  it("ranks by earnable gold, unknowns last", () => {
    const k = opps.map((o) => o.dailyProfit);
    for (let i = 1; i < k.length; i++) expect((k[i - 1] ?? -1n) >= (k[i] ?? -1n)).toBe(true);
  });
  it("flags a wage above value instead of hiding the item, and missing wage data", () => {
    const hi = findOpportunities({ ...base, activity: null, referenceWage: 10n ** 9n });
    expect(hi.every((o) => o.vppInstant === null || o.signals.includes("wage-above-value"))).toBe(true);
    expect(findOpportunities({ ...base, activity: null, referenceWage: null })[0]!.signals).toContain("no-wage-data");
  });
  it("uses live evidence only for what is live; inferred recipes keep their label", () => {
    const l = opps.find((o) => o.item === "livestock")!; expect(l.evidence.recipe).toBe("inferred"); expect(l.signals).toContain("inferred-recipe");
    expect(opps.find((o) => o.item === "limestone")!.evidence).toEqual({ price: "live", wage: "live", recipe: "wiki" });
  });
});

const okAnalysis = (profits: bigint[], unsold = 0): Analysis => ({
  ok: true, problems: [], ingredientPerUnit: 1n, referencePrice: 1n, vpp: 1000n, unitsPlanned: 10, depthCovers: unsold === 0, confidence: "live", notes: [],
  outcomes: (["conservative", "balanced", "competitive"] as const).map((id, k) => ({
    rec: { id, anchorNet: 1n, anchorGross: 1n, capGross: 1n, wage: BigInt(100 * (k + 1)), binding: "market" as const, viable: true, reasons: [] },
    plan: { ppTotal: 10n, unitsProduced: 10, unitsAfterProductionTax: 10, labourCost: 0n, ingredientCost: 0n, grossRevenue: 0n, marketTax: 0n, netRevenue: 0n, unitsSold: 10 - unsold, unitsUnsold: unsold, profit: profits[k]!, marginBp: 1000n, breakEvenPrice: 1n, profitPerPP: 1n },
    workerNetPerShift: null, workerNetPerDay: null })),
});
describe("recommendations", () => {
  const ri = (o: Partial<Parameters<typeof recommend>[0]> = {}) => ({ analysis: okAnalysis([30n, 20n, 10n]), upgrades: [], currentItem: "concrete", currentVpp: 1000n, best: null, affordablePP: null, neededPP: 100n, ...o });
  it("offers the balanced wage when it is profitable", () => { const r = recommend(ri()); expect(r[0]).toMatchObject({ kind: "offer-wage", scenario: "balanced", wage: 200n, profit: 20n }); });
  it("falls back to the first profitable scenario, or says not profitable", () => {
    expect(recommend(ri({ analysis: okAnalysis([30n, -5n, -9n]) }))[0]).toMatchObject({ scenario: "conservative" });
    expect(recommend(ri({ analysis: okAnalysis([-1n, -5n, -9n]) }))[0]).toMatchObject({ kind: "not-profitable", severity: "bad" });
  });
  it("warns about unsold units and short capital", () => {
    const r = recommend(ri({ analysis: okAnalysis([30n, 20n, 10n], 4), affordablePP: 40n }));
    expect(r.some((x) => x.kind === "unsold" && x.unsold === 4)).toBe(true); expect(r.some((x) => x.kind === "capital-short")).toBe(true);
  });
  it("suggests another product only for a clear gain", () => {
    const best = { item: "steel", vppInstant: 1200n } as never;
    expect(recommend(ri({ best })).some((x) => x.kind === "switch-product")).toBe(true);
    expect(recommend(ri({ best: { item: "steel", vppInstant: 1050n } as never })).some((x) => x.kind === "switch-product")).toBe(false);
    expect(recommend(ri({ best: { item: "concrete", vppInstant: 9999n } as never })).some((x) => x.kind === "switch-product")).toBe(false);
  });
  it("automation payback is quick only under the rule-of-thumb limit; storage only when binding", () => {
    const up = (days: number) => ({ code: "automatedEngine", fromLevel: 1, toLevel: 2, cost: 5n, gain: 24, valuePerDay: 1n, paybackDays: days, binding: null });
    expect(recommend(ri({ upgrades: [up(QUICK_PAYBACK_DAYS)] })).find((x) => x.kind === "automation")!.severity).toBe("good");
    expect(recommend(ri({ upgrades: [up(QUICK_PAYBACK_DAYS + 1)] })).find((x) => x.kind === "automation")!.severity).toBe("info");
    const st = (b: boolean | null) => ({ code: "storage", fromLevel: 1, toLevel: 2, cost: 5n, gain: 200, valuePerDay: null, paybackDays: null, binding: b });
    expect(recommend(ri({ upgrades: [st(true)] })).some((x) => x.kind === "storage")).toBe(true); expect(recommend(ri({ upgrades: [st(false)] })).some((x) => x.kind === "storage")).toBe(false);
  });
  it("says nothing numeric when the analysis failed", () => { expect(recommend(ri({ analysis: { ...okAnalysis([1n, 1n, 1n]), ok: false } }))).toEqual([]); });
  it("no capacity is reported instead of a fake recommendation", () => { expect(recommend(ri({ neededPP: 0n }))[0]).toMatchObject({ kind: "no-capacity" }); });
});

describe("chart series", () => {
  it("buckets long series, keeps order, and never exceeds max", () => {
    const pts = Array.from({ length: 500 }, (_, k) => ({ at: k * 1000, price: 100 + (k % 7) })); const b = bucketSeries(pts, 40);
    expect(b.length).toBeLessThanOrEqual(40); for (let i = 1; i < b.length; i++) expect(b[i]!.at).toBeGreaterThan(b[i - 1]!.at);
  });
  it("drops invalid points and needs two points to draw", () => {
    expect(polyline([{ at: 1, price: 5 }], 100, 20)).toBeNull();
    expect(bucketSeries([{ at: NaN, price: 1 }, { at: 1, price: Infinity }])).toEqual([]);
    const p = polyline([{ at: 0, price: 1 }, { at: 10, price: 3 }], 100, 20)!; expect(p.d.startsWith("M3.0,17.0")).toBe(true); expect([p.min, p.max]).toEqual([1, 3]);
    expect(polyline([{ at: 0, price: 2 }, { at: 5, price: 2 }], 100, 20)).not.toBeNull(); // flat line does not divide by zero
  });
});
