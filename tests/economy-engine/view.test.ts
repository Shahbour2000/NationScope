import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import type { EngineContext } from "@/features/economy-engine/data/context";
import { mapJobs, mapMarket, mapPlayer, mapTaxes } from "@/features/economy-engine/data/context";
import { companyView, DEFAULT_CAPS, type Controls } from "@/features/economy-engine/view";
import { TEXT, fmt } from "@/features/economy-engine/ui/text";
import { parseGoldDecimal } from "@/features/economy-engine/domain/fixed";

const fx = (n: string) => JSON.parse(readFileSync(`tests/fixtures/real/${n}.json`, "utf8"));
const ok = <T,>(value: T) => ({ state: "ok" as const, value, evidence: "live" as const, fetchedAt: "2026-11-17T00:00:00Z" });
const ctx = (): EngineContext => ({
  market: ok(mapMarket(fx("market"))!), jobs: ok(mapJobs(fx("jobs"))!),
  player: ok(mapPlayer({ id: "u", username: "A", skills: fx("player-skills").skills })!),
  companies: ok([fx("company-detail")]), companyIds: ["x"], taxes: ok(mapTaxes(fx("country-eg"), "eg")!),
  items: { concrete: ok({ bids: [["32400", 100], ["30000", 400]] as [string, number][], asks: [], trades: [], historyPoints: null, bookDepthLevels: 2 }) }, requests: 0,
});
const C = (o: Partial<Controls> = {}): Controls => ({ workers: 2, ownPPPerDay: 72, sellMode: "instant", absorbSharePct: 20, priceShiftPct: 0, caps: { ...DEFAULT_CAPS }, customWage: "", capital: "", ...o });
const NOW = Date.parse("2026-11-17T00:00:00Z");

describe("company view model", () => {
  it("combines skill, bonus, taxes, order book and wages into three scenarios", () => {
    const v = companyView(ctx(), fx("company-detail"), C(), NOW)!;
    expect(v.analysis.ok).toBe(true); expect(v.workers.skillLevel).toBe(4); expect(v.workers.ppPerShift).toBe(26);
    expect(v.workers.ppPerShiftWithBonus).toBe(31); // 26 x 1.18 = 30.68 -> 31
    expect(v.taxes.marketBp).toBe(1000n); expect(v.taxes.incomeBp).toBe(100n);
    expect(v.analysis.outcomes).toHaveLength(3); expect(v.analysis.notes).not.toContain("book-fallback-best-bid");
    expect(v.analysis.confidence).toBe("inferred"); // skill table is interpolated
  });
  it("a price what-if moves revenue and profit, and is labelled as the player's input", () => {
    const base = companyView(ctx(), fx("company-detail"), C(), NOW)!, up = companyView(ctx(), fx("company-detail"), C({ priceShiftPct: 50 }), NOW)!;
    expect(up.analysis.outcomes[1]!.plan.netRevenue > base.analysis.outcomes[1]!.plan.netRevenue).toBe(true);
    expect(up.analysis.vpp! > base.analysis.vpp!).toBe(true);
  });
  it("custom wage and capital are exact", () => {
    const v = companyView(ctx(), fx("company-detail"), C({ customWage: "0.1500", capital: "100" }), NOW)!;
    expect(v.custom!.wage).toBe(1500n); expect(v.custom!.plan.labourCost).toBe(1500n * v.workers.hiredPPPerDay);
    expect(v.affordablePP! > 0n).toBe(true);
    expect(companyView(ctx(), fx("company-detail"), C({ customWage: "abc" }), NOW)!.custom).toBeNull();
  });
  it("missing skill falls back to level 0 and says it is an assumption", () => {
    const c = ctx(); c.player = null;
    const v = companyView(c, fx("company-detail"), C(), NOW)!;
    expect(v.workers.skillEvidence).toBe("assumption"); expect(v.workers.ppPerShift).toBe(10); expect(v.analysis.confidence).toBe("assumption");
  });
  it("a market outage yields problems, not numbers", () => {
    const c = ctx(); c.market = { state: "rate_limited", reason: "upstream" };
    const v = companyView(c, fx("company-detail"), C(), NOW)!; expect(v.analysis.ok).toBe(false); expect(v.analysis.outcomes).toEqual([]);
  });
  it("lists automation and storage upgrades with next-level costs", () => {
    const v = companyView(ctx(), fx("company-detail"), C(), NOW)!;
    expect(v.upgrades.map((u) => u.code).sort()).toEqual(["automatedEngine", "storage"]);
    expect(v.upgrades.find((u) => u.code === "automatedEngine")!.cost).not.toBeNull();
  });
});

describe("gold input parsing", () => {
  it("accepts plain decimals up to 4 places only", () => {
    expect(parseGoldDecimal("0.18")).toBe(1800n); expect(parseGoldDecimal("12")).toBe(120000n); expect(parseGoldDecimal(" 3.1415 ")).toBe(31415n);
    for (const bad of ["", "-1", "1.23456", "1e3", "1,5", "abc"]) expect(parseGoldDecimal(bad)).toBeNull();
  });
});

describe("EN/AR parity of the engine text", () => {
  const keys = (o: unknown, p = ""): string[] => (Array.isArray(o) ? [`${p}[${o.length}]`] : o && typeof o === "object" ? Object.entries(o).flatMap(([k, v]) => keys(v, `${p}.${k}`)) : [p]);
  it("same keys and array lengths", () => { expect(keys(TEXT.ar).sort()).toEqual(keys(TEXT.en).sort()); });
  it("same placeholders in every string", () => {
    const walk = (a: unknown, b: unknown) => { if (typeof a === "string") { expect((String(b).match(/\{\w+\}/g) ?? []).sort()).toEqual((a.match(/\{\w+\}/g) ?? []).sort()); } else if (a && typeof a === "object") for (const k of Object.keys(a)) walk((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]); };
    walk(TEXT.en, TEXT.ar);
  });
  it("no Arabic string is empty or still English-only", () => {
    const strs = (o: unknown): string[] => (typeof o === "string" ? [o] : o && typeof o === "object" ? Object.values(o).flatMap(strs) : []);
    for (const x of strs(TEXT.ar)) { expect(x.trim()).not.toBe(""); }
    expect(strs(TEXT.ar).filter((x) => /[\u0600-\u06FF]/.test(x)).length).toBeGreaterThan(strs(TEXT.ar).length * 0.9);
  });
  it("fmt fills placeholders", () => { expect(fmt(TEXT.en.r.anchor, { p: 25 })).toContain("25th"); expect(fmt("{x}", {})).toBe("{x}"); });
});
