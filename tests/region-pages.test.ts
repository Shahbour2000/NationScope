import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Display } from "@/features/entities/display";
import { CampaignView } from "@/features/regions/CampaignView";
import { RegionCompaniesView } from "@/features/regions/RegionCompaniesView";
import { RegionOverview } from "@/features/regions/RegionOverview";
import { BattleContractsView } from "@/features/wars/BattleContractsView";
import { BountyCard } from "@/features/wars/BountyCard";
import { getMessages, numberLocale } from "@/i18n";
import { bountyTotals, parseBattleContracts, remainingPercent, sortBounties } from "@/lib/domain/contracts";
import { EMPTY_DIRECTORY } from "@/lib/domain/directory";
import {
  battleIdOf, campaignSummary, companyTotals, facilitiesOf, fillPercent, filterSortCompanies, looseEvent, parseCampaign, parseCompanySort,
  parseRegionCompanies, parseRegionDetail,
} from "@/lib/domain/region-detail";

// Saved samples (API/samples, original captures) and the real fixtures (tests/fixtures/real). SYNTHETIC cases are labelled as such.
const sample = (p: string): unknown => JSON.parse(readFileSync(`API/samples/${p}`, "utf8"));
const real = (p: string): unknown => JSON.parse(readFileSync(`tests/fixtures/real/${p}`, "utf8"));
const display = (locale: "en" | "ar"): Display => {
  const m = getMessages(locale);
  return { locale, nl: numberLocale(locale), mediaOrigin: "", dir: EMPTY_DIRECTORY, m: { t: m.t, items: m.items, time: m.time, ui: m.ui } };
};
const clean = (html: string) => { expect(html).not.toContain("undefined"); expect(html).not.toContain("NaN"); expect(html).not.toContain("[object"); };

describe("region detail (saved sample)", () => {
  const region = parseRegionDetail(sample("regions/Region details.txt"))!;
  it("parses the captured region", () => {
    expect(region.id).toBe("eg-western-desert");
    expect(region.neighbors).toHaveLength(7);
    expect(region.companies).toBe(2);
    expect(region.deposit ?? null).toBeNull();
  });
  it("rejects a body that is not a region", () => { expect(parseRegionDetail({ error: "x" })).toBeNull(); expect(parseRegionDetail([])).toBeNull(); });
  it("reads facilities with a code and skips anything else", () => {
    expect(facilitiesOf([{ code: "farmland", level: 2, status: "active" }, { foo: 1 }, "x", { code: "industrialZone", level: 1, maxLevel: 5, status: "pending" }])).toEqual([
      { code: "farmland", level: 2, maxLevel: null, status: "active" }, { code: "industrialZone", level: 1, maxLevel: 5, status: "pending" },
    ]);
    expect(facilitiesOf(null)).toEqual([]);
  });
  it("finds a battle id only when one is present", () => { expect(battleIdOf({ id: "btl_1" })).toBe("btl_1"); expect(battleIdOf(null)).toBeNull(); expect(battleIdOf({})).toBeNull(); });
  it.each(["en", "ar"] as const)("renders the overview (%s)", (loc) => {
    const m = getMessages(loc), d = display(loc);
    const html = renderToStaticMarkup(createElement(RegionOverview, { region, d, m, nowMs: Date.parse("2026-11-11T00:00:00Z") }));
    clean(html);
    expect(html).toContain('href="/regions/eg-alexandria"');
    expect(html).toContain(m.regionPage.depositNone);
    expect(html).toContain(m.regionPage.noBattle);
    expect(html).toContain(m.regionPage.resistanceNone); // not occupied: resistance does not apply
  });
  it("SYNTHETIC: occupied region with deposit, buildings and battle", () => {
    const r = parseRegionDetail({ ...(sample("regions/Region details.txt") as object), occupied: true, resistance: 50, resistanceMax: 200, deposit: { type: "iron", bonusPercent: 21, endsAt: "2026-11-11T05:00:00Z" }, upgrades: [{ code: "farmland", level: 1, status: "pending" }, { weird: true }], battle: { id: "btl_x" } })!;
    const m = getMessages("en");
    const html = renderToStaticMarkup(createElement(RegionOverview, { region: r, d: display("en"), m, nowMs: Date.parse("2026-11-11T00:00:00Z") }));
    clean(html);
    expect(html).toContain("+21%");
    expect(html).toContain('href="/battles/btl_x"');
    expect(html).toContain(m.regionPage.facility.farmland);
    expect(html).toContain(m.regionPage.underConstruction);
    expect(html).toContain("1 entries"); // one unreadable building row is reported, not hidden
    expect(html).toContain('aria-label="25%"');
  });
});

describe("regional companies (saved sample)", () => {
  const { rows, skipped } = parseRegionCompanies(sample("regions/Regional companies.txt"));
  it("parses the bare array", () => { expect(rows).toHaveLength(2); expect(skipped).toBe(0); expect(rows[0]!.itemCode).toBe("iron"); });
  it("also accepts a wrapped list and skips malformed rows", () => {
    const r = parseRegionCompanies({ companies: [rows[0], { nope: 1 }] });
    expect(r.rows).toHaveLength(1); expect(r.skipped).toBe(1);
    expect(parseRegionCompanies("x").rows).toEqual([]);
  });
  it("computes storage fill without float overflow", () => {
    expect(fillPercent("1434329", "2000000")).toBe(71.7);
    expect(fillPercent("99999999999999999999", "99999999999999999999")).toBe(100);
    expect(fillPercent("5", "0")).toBeNull(); expect(fillPercent(null, "10")).toBeNull(); expect(fillPercent("x", "10")).toBeNull();
  });
  it("totals and sorts", () => {
    const t = companyTotals(rows);
    expect(t).toMatchObject({ companies: 2, workers: 0, hiring: 0 });
    expect(filterSortCompanies(rows, null, "storage").map((c) => c.itemCode)).toEqual(["steel", "iron"]);
    expect(filterSortCompanies(rows, "iron", "storage")).toHaveLength(1);
    expect(filterSortCompanies(rows, null, "name").map((c) => c.name)).toEqual([...rows.map((c) => c.name)].sort((a, b) => a.localeCompare(b)));
    expect(parseCompanySort("bogus")).toBe("storage"); expect(parseCompanySort("workers")).toBe("workers");
  });
  it.each(["en", "ar"] as const)("renders cards, filters and sorting (%s)", (loc) => {
    const m = getMessages(loc);
    const html = renderToStaticMarkup(createElement(RegionCompaniesView, { rows, skipped: 0, item: null, sort: "storage", basePath: "/regions/eg-center/companies", d: display(loc), m }));
    clean(html);
    expect(html.match(/<li class="[^"]*card/g)).toHaveLength(2);
    expect(html).toContain('href="/companies/cmp_738h84h2mdzw9066"');
    expect(html).toContain('href="/regions/eg-center/companies?item=iron"');
    expect(html).toContain('href="/regions/eg-center/companies?sort=workers"');
    expect(html).toContain("72%");
  });
  it("shows an honest empty state and a no-match state", () => {
    const m = getMessages("en");
    expect(renderToStaticMarkup(createElement(RegionCompaniesView, { rows: [], skipped: 0, item: null, sort: "storage", basePath: "/x", d: display("en"), m }))).toContain(m.regionPage.c.empty);
    expect(renderToStaticMarkup(createElement(RegionCompaniesView, { rows, skipped: 3, item: "wood", sort: "storage", basePath: "/x", d: display("en"), m }))).toContain(m.regionPage.c.noMatch);
  });
  it("SYNTHETIC: a full, hiring company is flagged", () => {
    const r = parseRegionCompanies([{ id: "c1", name: "N", itemCode: "iron", points: "10", capacity: "10", workers: 4, offer: { any: 1 } }]).rows;
    const html = renderToStaticMarkup(createElement(RegionCompaniesView, { rows: r, skipped: 0, item: null, sort: "storage", basePath: "/x", d: display("en"), m: getMessages("en") }));
    expect(html).toContain("Hiring"); expect(html).toContain("Storage full");
  });
});

describe("regional campaign (saved sample)", () => {
  const camp = parseCampaign(sample("regions/Regional campaign battles.txt"));
  it("parses battles and keeps the undocumented lists untyped", () => {
    expect(camp.shapeOk).toBe(true); expect(camp.battles).toHaveLength(1); expect(camp.ownership).toEqual([]); expect(camp.launched).toEqual([]);
    expect(campaignSummary(camp.battles)).toEqual({ total: 1, active: 1, heldByAttacker: 0, heldByDefender: 0, undecided: 0 });
  });
  it("flags a body without a battle list", () => { expect(parseCampaign({ x: 1 }).shapeOk).toBe(false); });
  it("reads loose events without inventing fields", () => {
    expect(looseEvent({ changedAt: "2026-10-01T00:00:00Z", fromCountryId: "eg", toCountryId: "ly", battleId: "btl_1", note: "x" })).toEqual({ at: "2026-10-01T00:00:00Z", countryIds: ["eg", "ly"], regionIds: [], battleId: "btl_1", recognised: true });
    expect(looseEvent({ a: 1 }).recognised).toBe(false); expect(looseEvent(null).recognised).toBe(false);
  });
  it.each(["en", "ar"] as const)("renders (%s)", (loc) => {
    const m = getMessages(loc);
    const html = renderToStaticMarkup(createElement(CampaignView, { campaign: camp, regionId: "uk-london", d: display(loc), m }));
    clean(html);
    expect(html).toContain('href="/battles/btl_ta72c39dwcrczcdq"');
    expect(html).toContain(m.regionPage.b.noOwnership);
    expect(html).toContain(m.regionPage.b.running);
  });
  it("SYNTHETIC: unreadable ownership rows are counted, not dropped silently", () => {
    const c = { ...camp, ownership: [{ foo: 1 }, { at: "x" }], launched: [{ bar: 2 }] };
    const html = renderToStaticMarkup(createElement(CampaignView, { campaign: c, regionId: "uk-london", d: display("en"), m: getMessages("en") }));
    expect(html).toContain("3 entries");
  });
});

describe("battle contracts", () => {
  const empty = parseBattleContracts(sample("battles/Battle contracts.txt"));
  const globalContracts = real("contracts.json") as { bounties: unknown[] };
  const populated = parseBattleContracts({ enabled: true, bounties: globalContracts.bounties, auctions: [], myContract: null });
  it("parses the captured empty response", () => { expect(empty).toMatchObject({ enabled: true, bounties: [], auctions: [], myContract: null, shapeOk: true }); });
  it("rejects an unrelated body", () => { expect(parseBattleContracts({ foo: 1 }).shapeOk).toBe(false); expect(parseBattleContracts(null).shapeOk).toBe(false); });
  it("parses the real bounty shape and totals money exactly", () => {
    expect(populated.bounties).toHaveLength(1);
    const t = bountyTotals(populated.bounties);
    expect(t).toEqual({ open: 1, pool: 494880n, best: 5000n });
    expect(remainingPercent(populated.bounties[0]!)).toBe(98.9);
    expect(remainingPercent({ budget: "0", remaining: "0" })).toBeNull(); expect(remainingPercent({})).toBeNull();
  });
  it("sorts open first, best pay first", () => {
    const rows = parseBattleContracts({ bounties: [{ id: "a", status: "cancelled", perK: "9" }, { id: "b", status: "active", perK: "1" }, { id: "c", status: "active", perK: "5" }] }).bounties;
    expect(sortBounties(rows).map((b) => b.id)).toEqual(["c", "b", "a"]);
  });
  it.each(["en", "ar"] as const)("renders the empty and the disabled states (%s)", (loc) => {
    const m = getMessages(loc);
    const e = renderToStaticMarkup(createElement(BattleContractsView, { battleId: "btl_1", contracts: empty, battle: null, d: display(loc), m }));
    clean(e); expect(e).toContain(m.battleContracts.none); expect(e).toContain(m.battleContracts.unavailable); expect(e).toContain('href="/battles/btl_1"');
    const off = renderToStaticMarkup(createElement(BattleContractsView, { battleId: "btl_1", contracts: { ...empty, enabled: false }, battle: null, d: display(loc), m }));
    expect(off).toContain(m.battleContracts.disabled);
  });
  it("renders bounties using the battle's sides when the bounty carries none", () => {
    const m = getMessages("en");
    const noBattle = populated.bounties.map((x) => { const { battle, ...rest } = x as Record<string, unknown>; void battle; return rest; }) as never;
    const html = renderToStaticMarkup(createElement(BattleContractsView, { battleId: "btl_bc0kqw9hz8g1gctv", contracts: { ...populated, bounties: noBattle }, battle: { type: "territorial", status: "active", regionId: "bf-west", attackerCountryId: "lr", defenderCountryId: "dz" }, d: display("en"), m }));
    clean(html);
    expect(html).toContain(m.contractsPage.forSide);
    expect(html).toContain("<article");
    expect(html).not.toContain('class="' + "cover"); // no self-link on the battle's own page
  });
  it("BountyCard on the global page still links to its battle", () => {
    const html = renderToStaticMarkup(createElement(BountyCard, { b: populated.bounties[0]!, d: display("en"), t: getMessages("en").contractsPage }));
    expect(html).toContain('href="/battles/btl_bc0kqw9hz8g1gctv"');
  });
  it("SYNTHETIC: auctions are shown as returned, with a note that the format is undocumented", () => {
    const m = getMessages("en");
    const c = { ...empty, auctions: [{ id: "auc_1", status: "open" }] };
    const html = renderToStaticMarkup(createElement(BattleContractsView, { battleId: "b", contracts: c, battle: null, d: display("en"), m }));
    expect(html).toContain(m.mercenary.note); expect(html).toContain("Open"); // the generic table hides technical ids
  });
});
