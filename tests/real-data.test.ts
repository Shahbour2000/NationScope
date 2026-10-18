/* eslint-disable @typescript-eslint/no-explicit-any -- fixtures are untyped captured JSON */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { allianceAggregate, companyUpgradeTotal, coreControl, floorMatrix, jobsSummary, marketView, median, statsWithShare, tradesByItem, warDurationMs } from "@/features/economy/analytics";
import { formatDateTime, formatDuration, formatMoney, humanizeCode, percent } from "@/lib/format";
import { companySchema, equipmentOfferSchema, floorRowSchema, jobOfferSchema, marketRowSchema, statsRowSchema, tradeSchema } from "@/lib/domain/economy";
import { regionName, countryName, toDirectoryForTest } from "./helpers/directory";
import { parseRows } from "@/lib/domain/parse";
import { allianceSchema, battleSchema, citizenSchema, countrySchema, historyItemSchema, profileSchema, rankingRowSchema, summarySchema, warSchema, articleSchema } from "@/lib/domain/world";
import { itemIconSrc, mediaSrc } from "@/lib/media";

// REAL fixtures captured from the production API on 2026-10-17 (tests/fixtures/real). Arrays truncated to 60 rows.
const fx = (name: string): any => JSON.parse(readFileSync(`tests/fixtures/real/${name}.json`, "utf8"));

describe("real-response parsing (no row skipped)", () => {
  const cases: [string, unknown, any][] = [
    ["countries", fx("countries").countries, countrySchema], ["wars", fx("wars"), warSchema], ["battles", fx("battles"), battleSchema],
    ["alliances", fx("alliances").alliances, allianceSchema], ["market", fx("market"), marketRowSchema], ["trades", fx("market-trades"), tradeSchema],
    ["equipment", fx("equipment-offers").offers, equipmentOfferSchema], ["floor", fx("equipment-floor"), floorRowSchema],
    ["companies", fx("companies").companies, companySchema], ["stats", fx("company-stats").byItem, statsRowSchema], ["jobs", fx("jobs").offers, jobOfferSchema],
    ["citizens", fx("citizens-eg").citizens, citizenSchema], ["ranking", fx("ranking-playerDamage").rows, rankingRowSchema],
    ["history", fx("history").items, historyItemSchema], ["articles", fx("articles").items, articleSchema],
  ];
  for (const [name, raw, schema] of cases) {
    it(`${name}`, () => {
      const r = parseRows(raw, schema);
      expect(r.skipped).toBe(0);
      expect(r.rows.length).toBeGreaterThan(0);
    });
  }
  it("country summary and profile", () => {
    const s = summarySchema.safeParse(fx("country-eg-summary"));
    expect(s.success).toBe(true);
    expect(profileSchema.safeParse(fx("country-eg")).success).toBe(true);
    if (s.success) {
      expect(s.data.profile.name).toBe("Egypt");
      expect(s.data.profile.treasury?.money).toBe("6644269");
      expect(s.data.profile.coreRegions?.length).toBe(7);
    }
  });
});

describe("market analytics (real market sample)", () => {
  const view = marketView(parseRows(fx("market"), marketRowSchema).rows);
  it("computes spreads in exact integer basis points", () => {
    const lime = view.find((v) => v.itemCode === "limestone")!;
    expect(lime.ask).toBe(3490n); expect(lime.bid).toBe(2500n);
    expect(lime.spreadBps).toBe(3960); // (3490-2500)/2500 = 39.6%
    expect(lime.askVsLastBps).toBe(6384); // (3490-2130)/2130 = 63.849...%, truncated to whole basis points
  });
  it("keeps missing sides as null, not zero", () => {
    const stock = view.find((v) => v.itemCode === "livestock")!;
    expect(stock.ask).toBeNull(); expect(stock.bid).toBeNull(); expect(stock.spreadBps).toBeNull(); expect(stock.askQty).toBe(0);
  });
  it("volume-weighted price is exact and rounded half up", () => {
    const t = tradesByItem([
      { id: "a", itemCode: "x", price: "100", qty: 1, createdAt: "2026-01-01T00:00:00Z" },
      { id: "b", itemCode: "x", price: "103", qty: 2, createdAt: "2026-01-01T00:01:00Z" },
    ] as any);
    expect(t[0]!.vwap).toBe(102n); // (100*1+103*2)/3 = 102
    expect(t[0]!.series.map((p) => p.price)).toEqual([100n, 103n]);
    expect(t[0]!.last).toBe(103n);
  });
  it("trade groups from the real sample cover every trade", () => {
    const trades = parseRows(fx("market-trades"), tradeSchema).rows;
    const groups = tradesByItem(trades);
    expect(groups.reduce((n, g) => n + g.trades, 0)).toBe(trades.length);
  });
});

describe("jobs, floor, companies (real samples)", () => {
  it("jobs summary ranks by net pay per point and finds the median exactly", () => {
    const offers = parseRows(fx("jobs").offers, jobOfferSchema).rows;
    const s = jobsSummary(offers);
    expect(s.count).toBe(offers.length);
    const nets = offers.map((o) => BigInt(o.netPerPoint!));
    expect(BigInt(s.bestNet!.netPerPoint!)).toBe(nets.reduce((a, b) => (b > a ? b : a)));
    expect(s.medianNet).toBe(median(nets));
  });
  it("median of even and odd lists", () => {
    expect(median([1n, 3n, 2n])).toBe(2n); expect(median([1n, 2n, 3n, 4n])).toBe(2n); expect(median([])).toBeNull();
  });
  it("floor matrix is ordered by slot and rarity", () => {
    const m = floorMatrix(parseRows(fx("equipment-floor"), floorRowSchema).rows);
    expect(m.slots).toEqual(["helmet", "chest", "gloves", "pants", "boots", "weapon"]);
    expect(m.rarities[0]).toBe("common");
    expect(m.cell.get("helmet|common")?.low).toBe("30000");
  });
  it("company stats share is calculated against the supplied total", () => {
    const stats = fx("company-stats");
    const rows = statsWithShare(parseRows(stats.byItem, statsRowSchema).rows, stats.totals.companies);
    expect(rows[0]!.sharePct).toBeCloseTo((rows[0]!.companies / stats.totals.companies) * 100, 0);
  });
  it("upgrade total sums the three levels", () => {
    expect(companyUpgradeTotal({ storageLevel: 2, engineLevel: 5, breakRoomLevel: 1 })).toBe(8);
    expect(companyUpgradeTotal({})).toBe(0);
  });
});

describe("country, war and alliance calculations (real samples)", () => {
  const countries = parseRows(fx("countries").countries, countrySchema).rows;
  it("core control is shown as held/total", () => {
    const eg = countries.find((c) => c.id === "eg")!;
    expect(coreControl(eg)).toEqual({ held: 7, total: 7, pct: 100 });
    expect(coreControl({ coreHeld: 0, coreRegions: 0 }).pct).toBeNull();
  });
  it("war duration: elapsed for active, total for ended, null when unknown", () => {
    expect(warDurationMs({ declaredAt: "2026-10-15T10:00:00Z", endedAt: null }, Date.parse("2026-10-17T12:30:00Z"))).toBe(((2 * 24 + 2) * 60 + 30) * 60000);
    expect(warDurationMs({ declaredAt: "2026-10-15T10:00:00Z", endedAt: "2026-10-15T11:00:00Z" }, 0)).toBe(3600000);
    expect(warDurationMs({ declaredAt: null, endedAt: null }, 0)).toBeNull();
  });
  it("alliance aggregate sums only member countries found in the directory", () => {
    const wars = parseRows(fx("wars"), warSchema).rows;
    const pact = parseRows(fx("alliances").alliances, allianceSchema).rows.find((a) => a.id === "aln_kzpir42ew01ab8b2")!;
    const agg = allianceAggregate(pact, countries, wars);
    expect(agg.members.length + agg.unresolved.length).toBe(pact.members!.length);
    expect(agg.citizens).toBe(agg.members.reduce((n, c) => n + (c.citizens ?? 0), 0));
  });
});

describe("formatting and entity helpers", () => {
  it("formats money exactly from 1/10,000 gold strings", () => {
    expect(formatMoney("12345")).toBe("1.2345");
    expect(formatMoney("30000")).toBe("3.00");
    expect(formatMoney("3490")).toBe("0.349");
    expect(formatMoney("6644269")).toBe("664.4269");
    expect(formatMoney("99999999999999999999")).toBe("9,999,999,999,999,999.9999");
    expect(formatMoney(null)).toBeNull(); expect(formatMoney("1.5")).toBeNull();
  });
  it("formats UTC timestamps and durations", () => {
    expect(formatDateTime("2026-10-17T12:48:40.689Z", "en-US")).toBe("Oct 17, 2026, 12:48 PM UTC");
    expect(formatDateTime("bad", "en-US")).toBeNull();
    expect(formatDuration(((2 * 24 + 5) * 60) * 60000, { d: "d", h: "h", m: "m" })).toBe("2d 5h");
    expect(formatDuration(75 * 60000, { d: "d", h: "h", m: "m" })).toBe("1h 15m");
  });
  it("humanizes codes and computes percentages", () => {
    expect(humanizeCode("lightAmmo")).toBe("Light ammo"); expect(humanizeCode("iq-mosul")).toBe("Iq mosul");
    expect(percent(1, 3)).toBe(33.3); expect(percent(1, 0)).toBeNull();
  });
  it("resolves country and region names, falling back to a humanized suffix", () => {
    const d = toDirectoryForTest(parseRows(fx("countries").countries, countrySchema).rows);
    expect(countryName("eg", d)).toBe("Egypt"); expect(countryName("zz", d)).toBe("ZZ");
    expect(regionName("iq-mosul", d)).toBe("Mosul"); expect(regionName("eg-center", { ...d, regionNames: { "eg-center": "Center" } })).toBe("Center");
  });
  it("only builds image URLs from safe official patterns", () => {
    expect(mediaSrc("/media/a.webp", "https://app.ageofnations.world")).toBe("https://app.ageofnations.world/media/a.webp");
    expect(mediaSrc("//evil.test/x", "https://h")).toBeNull(); expect(mediaSrc("/media/../x", "https://h")).toBeNull(); expect(mediaSrc(null, "https://h")).toBeNull();
    expect(itemIconSrc("lightAmmo")).toBe("https://ageofnations.world/items/lightAmmo.webp"); expect(itemIconSrc("../x")).toBeNull();
  });
});
