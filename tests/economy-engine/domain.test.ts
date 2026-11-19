import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { ceilDiv, floorDiv, goldText, mulBpFloor, parseIntString, pctToBp, roundDiv } from "@/features/economy-engine/domain/fixed";
import { evaluatePlan, grossForNet, netOfTax, valuePerPP, type Taxes } from "@/features/economy-engine/domain/economics";
import { dailyAbsorption, instantSale, patientSale, supplyState, tradeWindow, trendPct, volatilityPct, walkBook, type Trade } from "@/features/economy-engine/domain/market";
import { SCENARIO_DEFS, percentile, recommendAll, recommendWage } from "@/features/economy-engine/domain/salary";
import { levelOf, maxEnergy, productionPerShift, readSkills, sustainedShiftsPerDay } from "@/features/economy-engine/domain/skills";
import { readCompany, storeNearFull } from "@/features/economy-engine/domain/company";
import { upgradeRoi } from "@/features/economy-engine/domain/upgrades";
import { affordablePP, analyzeCompany, rankProducts, type MarketRowIn } from "@/features/economy-engine/domain/engine";
import { RECIPES, recipeOf } from "@/features/economy-engine/domain/recipes";
import { weakest } from "@/features/economy-engine/domain/evidence";

const fx = (n: string) => JSON.parse(readFileSync(`tests/fixtures/real/${n}.json`, "utf8"));
const rowsOf = (): Map<string, MarketRowIn> => new Map((fx("market") as Record<string, string | number | null>[]).map((r) => [r.itemCode as string, {
  itemCode: r.itemCode as string, bestAsk: r.bestAsk == null ? null : BigInt(r.bestAsk as string), askQty: r.askQty as number | null,
  bestBid: r.bestBid == null ? null : BigInt(r.bestBid as string), bidQty: r.bidQty as number | null, last: r.last == null ? null : BigInt(r.last as string),
}]));
const T = (o: Partial<Taxes> = {}): Taxes => ({ marketBp: 0n, productionBp: 0n, incomeBp: 0n, ...o });
/** Small deterministic PRNG so the property tests are reproducible. */
const prng = (seed: number) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);

describe("fixed-point arithmetic", () => {
  it("rounds half away from zero and floors toward -infinity", () => {
    expect(roundDiv(5n, 2n)).toBe(3n); expect(roundDiv(-5n, 2n)).toBe(-3n); expect(roundDiv(7n, 3n)).toBe(2n);
    expect(floorDiv(-7n, 2n)).toBe(-4n); expect(floorDiv(7n, 2n)).toBe(3n); expect(ceilDiv(7n, 2n)).toBe(4n); expect(ceilDiv(-7n, 2n)).toBe(-3n);
    expect(() => roundDiv(1n, 0n)).toThrow();
  });
  it("converts percent to basis points and applies it exactly", () => {
    expect(pctToBp(1)).toBe(100n); expect(pctToBp(7.5)).toBe(750n); expect(mulBpFloor(1450n, 500n)).toBe(72n);
    expect(() => pctToBp(NaN)).toThrow();
  });
  it("parses only integer strings", () => {
    expect(parseIntString("12345")).toBe(12345n); expect(parseIntString("1.5")).toBeNull(); expect(parseIntString(null)).toBeNull(); expect(parseIntString("")).toBeNull();
  });
  it("formats gold without float error", () => {
    expect(goldText(12345n)).toBe("1.2345"); expect(goldText(-5n)).toBe("-0.0005"); expect(goldText(123456789n, 2)).toBe("12,345.68");
    expect(0.1 + 0.2).not.toBe(0.3); expect(goldText(1000n + 2000n)).toBe("0.3000");
  });
});

describe("wage tax (golden: real /jobs rows)", () => {
  it("matches the API: 1,800 @1% -> net 1,782; 1,450 @5% -> net 1,378", () => {
    expect(netOfTax(1800n, 100n)).toBe(1782n); expect(netOfTax(1450n, 500n)).toBe(1378n);
  });
  it("every real offer row reproduces its own net/tax", () => {
    for (const o of fx("jobs").offers) {
      const gross = BigInt(o.grossPerPoint), bp = BigInt(o.incomeTax * 100);
      expect(netOfTax(gross, bp)).toBe(BigInt(o.netPerPoint)); expect(gross - BigInt(o.netPerPoint)).toBe(BigInt(o.taxPerPoint));
    }
  });
  it("grossForNet is the smallest gross reaching the net (property)", () => {
    const r = prng(7);
    for (let k = 0; k < 400; k++) {
      const bp = BigInt(Math.floor(r() * 4500)), net = BigInt(Math.floor(r() * 5000) + 1);
      const g = grossForNet(net, bp);
      expect(netOfTax(g, bp)).toBeGreaterThanOrEqual(net); expect(netOfTax(g - 1n, bp)).toBeLessThan(net);
    }
  });
});

describe("value per production point (golden, real market.json)", () => {
  const rows = rowsOf();
  it("raw limestone (1 PP/unit): VPP = price", () => {
    expect(valuePerPP({ unitPrice: 2200n, ppPerUnit: 1, ingredientCostPerUnit: 0n, taxes: T() }).perPP).toBe(2200n);
  });
  it("concrete: 8 PP and 8 limestone per unit (live company recipe)", () => {
    expect(rows.get("limestone")!.bestAsk).toBe(3490n); expect(rows.get("concrete")!.bestAsk).toBe(41900n); // fixture guard: the numbers below are hand-computed from these
    const ing = 8n * rows.get("limestone")!.bestAsk!; // 27,920
    expect(ing).toBe(27920n);
    expect(valuePerPP({ unitPrice: 41900n, ppPerUnit: 8, ingredientCostPerUnit: ing, taxes: T() }).perPP).toBe(1748n); // 13,980 / 8 = 1,747.5 -> half away
    // 10% market tax: 41,900 x 0.9 = 37,710 ; minus 27,920 = 9,790 ; / 8 = 1,223.75 -> 1,224
    expect(valuePerPP({ unitPrice: 41900n, ppPerUnit: 8, ingredientCostPerUnit: ing, taxes: T({ marketBp: 1000n }) }).perPP).toBe(1224n);
  });
  it("production tax and market tax multiply (not add)", () => {
    const v = valuePerPP({ unitPrice: 10000n, ppPerUnit: 1, ingredientCostPerUnit: 0n, taxes: { marketBp: 1000n, productionBp: 1000n } });
    expect(v.netRevenuePerUnit).toBe(8100n); // 10,000 x 0.9 x 0.9
  });
  it("a negative value (inputs dearer than output) is reported, not hidden", () => {
    expect(valuePerPP({ unitPrice: 100n, ppPerUnit: 1, ingredientCostPerUnit: 500n, taxes: T() }).perPP).toBe(-400n);
  });
  it("rejects a non-positive recipe size", () => { expect(() => valuePerPP({ unitPrice: 1n, ppPerUnit: 0, ingredientCostPerUnit: 0n, taxes: T() })).toThrow(); });
});

describe("order-book walk", () => {
  it("fills best price first across levels and reports shortfall", () => {
    const bids = [{ price: 100n, qty: 5 }, { price: 300n, qty: 2 }, { price: 200n, qty: 4 }];
    const f = walkBook(bids, 8, "bids");
    expect(f.value).toBe(300n * 2n + 200n * 4n + 100n * 2n); expect(f.filled).toBe(8); expect(f.worstPrice).toBe(100n); expect(f.shortfall).toBe(0);
    const g = walkBook(bids, 20, "bids"); expect(g.filled).toBe(11); expect(g.shortfall).toBe(9);
    expect(walkBook([{ price: 5n, qty: 3 }, { price: 2n, qty: 3 }], 4, "asks").value).toBe(2n * 3n + 5n);
  });
  it("ignores empty/zero levels and bad quantities", () => {
    expect(walkBook([{ price: 0n, qty: 5 }, { price: 9n, qty: 0 }], 3, "bids").filled).toBe(0);
    expect(walkBook([{ price: 9n, qty: 5 }], -2, "bids").filled).toBe(0);
    expect(walkBook([{ price: 9n, qty: 5 }], Number.NaN, "bids").filled).toBe(0);
  });
});

describe("plan economics (hand-checked)", () => {
  it("1,000 PP of limestone at wage 1,000, instant into a 2,010 bid, 10% market tax", () => {
    const r = evaluatePlan({ ppHired: 1000n, ppOwn: 0n, wage: 1000n, ppPerUnit: 1, ingredientCostPerUnit: 0n, taxes: T({ marketBp: 1000n }), sell: instantSale([{ price: 2010n, qty: 53232 }]) });
    expect(r.grossRevenue).toBe(2_010_000n); expect(r.marketTax).toBe(201_000n); expect(r.netRevenue).toBe(1_809_000n);
    expect(r.labourCost).toBe(1_000_000n); expect(r.profit).toBe(809_000n); expect(r.marginBp).toBe(4472n);
    expect(r.breakEvenPrice).toBe(1112n); // 1,000,000 / (1,000 x 0.9) = 1,111.1 -> rounded up
  });
  it("production tax removes units before sale; own PP carry no wage", () => {
    const r = evaluatePlan({ ppHired: 50n, ppOwn: 50n, wage: 10n, ppPerUnit: 1, ingredientCostPerUnit: 0n, taxes: T({ productionBp: 1000n }), sell: instantSale([{ price: 100n, qty: 1000 }]) });
    expect(r.unitsProduced).toBe(100); expect(r.unitsAfterProductionTax).toBe(90); expect(r.labourCost).toBe(500n); expect(r.netRevenue).toBe(9000n);
  });
  it("unsold units earn nothing but their ingredients are still paid", () => {
    const r = evaluatePlan({ ppHired: 100n, ppOwn: 0n, wage: 10n, ppPerUnit: 1, ingredientCostPerUnit: 7n, taxes: T(), sell: instantSale([{ price: 50n, qty: 10 }]) });
    expect(r.unitsSold).toBe(10); expect(r.unitsUnsold).toBe(90); expect(r.ingredientCost).toBe(700n); expect(r.profit).toBe(500n - 1000n - 700n);
  });
  it("patient sale caps units by market throughput", () => {
    const s = patientSale(200n, 12.9)(50); expect(s.sold).toBe(12); expect(s.unsold).toBe(38); expect(s.revenue).toBe(2400n);
    expect(patientSale(200n, null)(50).sold).toBe(50); expect(patientSale(null, 5)(50).sold).toBe(0);
  });
  it("no revenue -> no margin and no break-even price (never NaN)", () => {
    const r = evaluatePlan({ ppHired: 10n, ppOwn: 0n, wage: 1n, ppPerUnit: 1, ingredientCostPerUnit: 0n, taxes: T(), sell: instantSale([]) });
    expect(r.marginBp).toBeNull(); expect(r.breakEvenPrice).toBeNull();
  });
  it("profit falls as wage rises, and equals revenue - costs (property)", () => {
    const r = prng(11);
    for (let k = 0; k < 200; k++) {
      const pp = BigInt(Math.floor(r() * 5000) + 1), w = BigInt(Math.floor(r() * 3000)), ing = BigInt(Math.floor(r() * 500));
      const bids = [{ price: BigInt(Math.floor(r() * 4000) + 1), qty: Math.floor(r() * 3000) + 1 }, { price: BigInt(Math.floor(r() * 2000) + 1), qty: 4000 }];
      const tx = T({ marketBp: BigInt(Math.floor(r() * 4500)), productionBp: BigInt(Math.floor(r() * 2000)) });
      const mk = (wage: bigint) => evaluatePlan({ ppHired: pp, ppOwn: 0n, wage, ppPerUnit: 1, ingredientCostPerUnit: ing, taxes: tx, sell: instantSale(bids) });
      const a = mk(w), b = mk(w + 1n);
      expect(b.profit).toBeLessThanOrEqual(a.profit);
      expect(a.profit).toBe(a.netRevenue - a.labourCost - a.ingredientCost);
      expect(a.netRevenue).toBeGreaterThanOrEqual(0n); expect(a.labourCost).toBe(w * pp);
    }
  });
});

describe("salary scenarios (approved definitions)", () => {
  const offers = (fx("jobs").offers as { netPerPoint: string }[]).map((o) => BigInt(o.netPerPoint));
  const allowed = { min: 264n, max: 2400n, median: 800n };
  it("definitions are exactly 25/60, 50/75, 75/90", () => {
    expect(SCENARIO_DEFS).toEqual({ conservative: { percentile: 25, capPct: 60 }, balanced: { percentile: 50, capPct: 75 }, competitive: { percentile: 75, capPct: 90 } });
  });
  it("nearest-rank percentile", () => {
    expect(percentile([1n, 2n, 3n, 4n], 25)).toBe(1n); expect(percentile([1n, 2n, 3n, 4n], 50)).toBe(2n); expect(percentile([1n, 2n, 3n, 4n], 75)).toBe(3n);
    expect(percentile([], 50)).toBeNull(); expect(percentile([9n], 99)).toBe(9n);
  });
  it("a high break-even lets the market percentile decide", () => {
    const rs = recommendAll({ offersNet: offers, incomeBp: 100n, breakEven: 100000n, allowed });
    expect(rs.map((r) => r.binding)).toEqual(["market", "market", "market"]);
    expect(rs[0]!.wage <= rs[1]!.wage && rs[1]!.wage <= rs[2]!.wage).toBe(true);
    for (const r of rs) expect(netOfTax(r.wage, 100n)).toBeGreaterThanOrEqual(r.anchorNet!);
  });
  it("a low break-even is limited to 60/75/90% of it", () => {
    const rs = recommendAll({ offersNet: offers, incomeBp: 100n, breakEven: 300n, allowed: null });
    expect(rs.map((r) => r.wage)).toEqual([180n, 225n, 270n]); expect(rs.every((r) => r.binding === "profit-cap")).toBe(true);
  });
  it("margin is adjustable through the cap override", () => {
    expect(recommendWage("balanced", { offersNet: offers, incomeBp: 0n, breakEven: 1000n, allowed: null, capPctOverride: { balanced: 50 } }).wage).toBe(500n);
  });
  it("respects the legal band and says when nothing legal is profitable", () => {
    const hi = recommendWage("competitive", { offersNet: offers, incomeBp: 0n, breakEven: 10_000_000n, allowed: { min: 264n, max: 1000n, median: 800n } });
    expect(hi.wage).toBe(1000n); expect(hi.binding).toBe("legal-max");
    const low = recommendWage("conservative", { offersNet: offers, incomeBp: 0n, breakEven: 300n, allowed });
    expect(low.viable).toBe(false); expect(low.wage).toBe(264n);
    expect(recommendWage("balanced", { offersNet: offers, incomeBp: 0n, breakEven: -5n, allowed }).viable).toBe(false);
  });
  it("without any offers it falls back to the profit cap and says so", () => {
    const r = recommendWage("balanced", { offersNet: [], incomeBp: 0n, breakEven: 2000n, allowed: null });
    expect(r.binding).toBe("no-market-data"); expect(r.wage).toBe(1500n); expect(r.reasons[0]!.code).toBe("no-offers");
  });
  it("scenario wages never decrease with the percentile, and never exceed their cap (property)", () => {
    const r = prng(3);
    for (let k = 0; k < 200; k++) {
      const be = BigInt(Math.floor(r() * 4000) - 200), bp = BigInt(Math.floor(r() * 3000));
      const list = Array.from({ length: Math.floor(r() * 30) }, () => BigInt(Math.floor(r() * 3000) + 1));
      const rs = recommendAll({ offersNet: list, incomeBp: bp, breakEven: be, allowed: null });
      expect(rs[0]!.wage <= rs[1]!.wage && rs[1]!.wage <= rs[2]!.wage).toBe(true);
      for (const x of rs) expect(x.wage <= x.capGross).toBe(true);
    }
  });
});

describe("skills and player discovery data", () => {
  it("reads production from the transcribed profile fixture (level 4)", () => {
    const s = readSkills({ skills: fx("player-skills").skills });
    expect(levelOf(s.rows, "production")).toBe(4); expect(s.issues).toEqual([]);
    expect(productionPerShift(4)).toEqual({ value: 26, evidence: "inferred" });
  });
  it("also reads a wrapped {player:{skills}} response", () => { expect(levelOf(readSkills({ player: { skills: [{ code: "production", level: 7, maxLevel: 10 }] } }).rows, "production")).toBe(7); });
  it("drops invalid rows and makes conflicting duplicates unknown", () => {
    const s = readSkills({ skills: [{ code: "production", level: 3, maxLevel: 10 }, { code: "production", level: 5, maxLevel: 10 }, { code: "attack", level: -1 }, { level: 2 }, { code: "energy", level: 2, maxLevel: 10 }, { code: "energy", level: 2, maxLevel: 10 }] });
    expect(levelOf(s.rows, "production")).toBeNull(); expect(levelOf(s.rows, "energy")).toBe(2); expect(s.issues.filter((x) => x === "invalid-row")).toHaveLength(2);
  });
  it("reports a missing skills array instead of guessing", () => { expect(readSkills({ id: "x" })).toEqual({ rows: [], issues: ["no-skills-array"] }); expect(readSkills(null).rows).toEqual([]); });
  it("wiki endpoints: production 10->50, energy 30->150, shifts/day from 10%/h regeneration", () => {
    expect(productionPerShift(0).value).toBe(10); expect(productionPerShift(10).value).toBe(50); expect(productionPerShift(99).value).toBe(50);
    expect(maxEnergy(0).value).toBe(30); expect(maxEnergy(10).value).toBe(150);
    expect(sustainedShiftsPerDay(30)).toBe(7); expect(sustainedShiftsPerDay(150)).toBe(36);
  });
});

describe("company state and upgrades (real /companies/{id} sample)", () => {
  const c = readCompany(fx("company-detail"))!;
  it("parses live recipe, bonuses, taxes and the PP scale", () => {
    expect(c.itemCode).toBe("concrete"); expect(c.ppPerUnit).toBe(8); expect(c.needs).toEqual({ limestone: 8 });
    expect(c.bonusTotalPct).toBe(18); expect(c.bonuses.map((b) => b.source)).toEqual(["ethics.product", "destiny"]);
    expect(c.incomeBp).toBe(100n); expect(c.productionTaxBp).toBe(0n);
    expect(c.storedPP).toBe(19n); expect(c.capacityPP).toBe(400n); expect(c.enginePerDay).toBe(72);
  });
  it("bonusTotal equals the sum of its parts in the sample", () => { expect(c.bonuses.reduce((a, b) => a + b.percent, 0)).toBe(c.bonusTotalPct); });
  it("store state", () => {
    expect(storeNearFull(c, Date.parse("2026-10-20T00:00:00Z"))).toBe(false); expect(storeNearFull({ ...c, full: true }, 0)).toBe(true);
    expect(storeNearFull(c, Date.parse("2026-10-26T10:00:00Z"))).toBe(true); // forecast full within 24 h
    expect(storeNearFull(c, Date.parse("2026-11-17T00:00:00Z"))).toBe(false); // stale past forecast + 19/400 PP stored -> not full
    expect(storeNearFull({ ...c, fullAt: null, storedPP: 390n }, 0)).toBe(true);
    expect(storeNearFull({ ...c, fullAt: null, storedPP: null }, 0)).toBeNull();
  });
  it("automation ROI = cost / (extra PP x VPP)", () => {
    const eng = c.upgrades.find((u) => u.code === "automatedEngine")!;
    const roi = upgradeRoi(eng, { steelAsk: 49600n, resourceAsk: 41900n }, 1748n, false)!;
    expect(roi.cost).toBe(80n * 49600n + 80n * 41900n); expect(roi.gain).toBe(24); expect(roi.valuePerDay).toBe(24n * 1748n);
    expect(roi.paybackDays).toBeCloseTo(Number(roi.cost) / Number(roi.valuePerDay!), 1);
  });
  it("missing prices give unknown cost/payback, never zero", () => {
    const eng = c.upgrades.find((u) => u.code === "automatedEngine")!;
    const roi = upgradeRoi(eng, { steelAsk: null, resourceAsk: 1n }, 100n, null)!; expect(roi.cost).toBeNull(); expect(roi.paybackDays).toBeNull();
  });
  it("storage is informational only", () => {
    const st = c.upgrades.find((u) => u.code === "storage")!; const roi = upgradeRoi(st, { steelAsk: 1n, resourceAsk: 1n }, 5n, true)!;
    expect(roi.gain).toBe(200); expect(roi.binding).toBe(true); expect(roi.paybackDays).toBeNull();
  });
  it("rejects garbage without throwing", () => { expect(readCompany(null)).toBeNull(); expect(readCompany({ id: "x" })).toBeNull(); });
});

describe("market statistics", () => {
  const now = Date.parse("2026-10-21T12:00:00Z");
  const mk = (h: number, price: number, qty: number): Trade => ({ price: BigInt(price), qty, at: now - h * 3_600_000 });
  it("VWAP is volume-weighted and exact", () => {
    const w = tradeWindow([mk(1, 100, 10), mk(2, 200, 30), mk(300, 999, 5)], now, 7 * 86_400_000);
    expect(w.volume).toBe(40); expect(w.vwap).toBe(175n); expect(w.high).toBe(200n); expect(w.low).toBe(100n); expect(w.count).toBe(2);
  });
  it("absorption needs a usable sample", () => {
    expect(dailyAbsorption([mk(1, 10, 1)], now).unitsPerDay).toBeNull();
    const ts = Array.from({ length: 10 }, (_, k) => mk(2 + k * 2, 100, 50));
    const a = dailyAbsorption(ts, now); expect(a.unitsPerDay).toBeCloseTo((500 / 20) * 24, 5);
  });
  it("volatility and trend", () => {
    expect(volatilityPct([mk(1, 100, 1)])).toBeNull();
    const flat = Array.from({ length: 8 }, (_, k) => mk(k, 100, 5)); expect(volatilityPct(flat)).toBeCloseTo(0, 9);
    const rising = Array.from({ length: 10 }, (_, k) => mk(10 - k, 100 + k * 10, 5)); expect(trendPct(rising)!).toBeGreaterThan(0);
    expect(trendPct([mk(1, 1, 1)])).toBeNull();
  });
  it("supply state thresholds (heuristic) and unknowns", () => {
    expect(supplyState(1000, 100).state).toBe("oversupplied"); expect(supplyState(50, 100).state).toBe("undersupplied"); expect(supplyState(300, 100).state).toBe("balanced");
    expect(supplyState(null, 100).state).toBe("unknown"); expect(supplyState(10, 0).state).toBe("unknown");
  });
});

describe("product ranking and company analysis on real fixtures", () => {
  const rows = rowsOf();
  it("recipes: concrete matches the live company (8 PP, 8 limestone)", () => { expect(recipeOf("concrete")).toMatchObject({ ppPerUnit: 8, inputs: { limestone: 8 } }); expect(RECIPES.length).toBe(new Set(RECIPES.map((r) => r.item)).size); });
  it("every recipe input is itself a raw recipe (no hidden chains)", () => { for (const r of RECIPES) for (const k of Object.keys(r.inputs)) expect(recipeOf(k)?.kind).toBe("raw"); });
  it("ranks by instant value per PP, missing prices last, nothing invented", () => {
    const rk = rankProducts(rows, { marketBp: 0n, productionBp: 0n }, RECIPES);
    expect(rk).toHaveLength(RECIPES.length);
    const priced = rk.filter((r) => r.vppInstant !== null);
    for (let k = 1; k < priced.length; k++) expect(priced[k - 1]!.vppInstant! >= priced[k]!.vppInstant!).toBe(true);
    const idx = rk.findIndex((r) => r.vppInstant === null); if (idx >= 0) expect(rk.slice(idx).every((r) => r.vppInstant === null)).toBe(true);
    const cooked = rk.find((r) => r.item === "cookedFish")!; expect(cooked.bestAsk).toBeNull(); // no ask in the fixture
    expect(cooked.vppPatient).not.toBeNull(); // falls back to the last trade, but is not the instant figure
  });
  it("analysis: three scenarios, exact accounting, ordered wages", () => {
    const offersNet = (fx("jobs").offers as { netPerPoint: string }[]).map((o) => BigInt(o.netPerPoint));
    const a = analyzeCompany({
      item: "concrete", ppPerUnit: 8, inputs: { limestone: 8 }, rows, bids: null, vwap7d: null, unitsPerDay: null, absorbSharePct: 20,
      taxes: T({ marketBp: 1000n, incomeBp: 100n }), offersNet, allowed: { min: 264n, max: 2400n, median: 800n },
      hiredPPPerDay: 8000n, ownPPPerDay: 0n, sellMode: "instant", workerPPPerShift: 26, workerShiftsPerDay: 7, bonusPct: 18,
      evidence: { prices: "live", wages: "live", skill: "inferred", taxes: "live", recipe: "live" },
    });
    expect(a.ok).toBe(true); expect(a.outcomes.map((o) => o.rec.id)).toEqual(["conservative", "balanced", "competitive"]);
    for (const o of a.outcomes) { expect(o.plan.profit).toBe(o.plan.netRevenue - o.plan.labourCost - o.plan.ingredientCost); expect(o.plan.labourCost).toBe(o.rec.wage * 8000n); }
    expect(a.outcomes[0]!.plan.profit >= a.outcomes[2]!.plan.profit).toBe(true);
    expect(a.confidence).toBe("inferred"); expect(a.notes).toContain("book-fallback-best-bid");
    // worker income per shift = 26 PP x 1.18 x net wage
    const o = a.outcomes[1]!; expect(o.workerNetPerShift).toBe(roundDiv(BigInt(26 * 118) * netOfTax(o.rec.wage, 100n), 100n));
  });
  it("reports missing prices as problems instead of computing", () => {
    const empty = new Map<string, MarketRowIn>();
    const a = analyzeCompany({ item: "concrete", ppPerUnit: 8, inputs: { limestone: 8 }, rows: empty, bids: null, vwap7d: null, unitsPerDay: null, absorbSharePct: 20, taxes: T(), offersNet: [], allowed: null, hiredPPPerDay: 100n, ownPPPerDay: 0n, sellMode: "instant", workerPPPerShift: null, workerShiftsPerDay: null, bonusPct: 0, evidence: { prices: "live", wages: "live", skill: "inferred", taxes: "live", recipe: "wiki" } });
    expect(a.ok).toBe(false); expect(a.problems).toContain("no-input-price"); expect(a.outcomes).toEqual([]);
  });
  it("capital-aware: affordable PP never overspends", () => {
    const pp = affordablePP(1_000_000n, 1000n, 8, 17600n); // per unit: 8 x 1000 + 17,600 = 25,600 per 8 PP
    expect(pp).toBe(312n); expect(pp * 25600n / 8n <= 1_000_000n).toBe(true);
    expect(affordablePP(0n, 1n, 1, 1n)).toBe(0n);
  });
  it("overall confidence is the weakest input", () => { expect(weakest(["live", "inferred", "wiki"])).toBe("inferred"); expect(weakest([])).toBe("assumption"); });
});

import { AGENTS_ENABLED, agentPPPerHourCenti, hireDeposit, hourlyNet, maxHourlyWage, ownerNet, wagePerPP } from "@/features/economy-engine/domain/agents";
describe("agent model (gated; base output is an input, multipliers are the documented ones)", () => {
  it("is disabled until the game exposes agents", () => { expect(AGENTS_ENABLED).toBe(false); });
  it("+10% per skill level and the documented type factors", () => {
    expect(agentPPPerHourCenti({ basePPPerHour: 10, skill: 5, fit: "specialist-own" })).toBe(1500n);
    expect(agentPPPerHourCenti({ basePPPerHour: 10, skill: 5, fit: "specialist-similar" })).toBe(900n);
    expect(agentPPPerHourCenti({ basePPPerHour: 10, skill: 5, fit: "specialist-other" })).toBe(600n);
    expect(agentPPPerHourCenti({ basePPPerHour: 10, skill: 10, fit: "all-rounder" })).toBe(1400n);
  });
  it("rejects values the docs do not allow", () => { expect(() => agentPPPerHourCenti({ basePPPerHour: 10, skill: 0, fit: "all-rounder" })).toThrow(); expect(() => agentPPPerHourCenti({ basePPPerHour: 0, skill: 1, fit: "all-rounder" })).toThrow(); });
  it("max wage = output x VPP; net gain is zero at the max; deposit is 24 h", () => {
    const a = { basePPPerHour: 10, skill: 5, fit: "specialist-own" as const };
    expect(maxHourlyWage(a, 2000n)).toBe(30000n); expect(hourlyNet(a, 2000n, 30000n)).toBe(0n); expect(hourlyNet(a, 2000n, 10000n)).toBe(20000n);
    expect(wagePerPP(a, 30000n)).toBe(2000n); expect(hireDeposit(500n)).toBe(12000n); expect(ownerNet(1000n, 1000n)).toBe(900n);
  });
});
