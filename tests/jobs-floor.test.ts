import { describe, expect, it } from "vitest";
import { NO_JOB_FILTERS, filterJobs, jobStats } from "@/features/economy/jobs";
import { floorGroups } from "@/features/economy/floor";
import { classifyKinds } from "@/features/builds/list";
import type { JobOffer } from "@/lib/domain/economy";
import type { BuildLoad } from "@/lib/data/players";
import { classifyBuild } from "@/features/builds/classify";

const job = (o: Partial<JobOffer> & { offerId: string; itemCode: string }): JobOffer => ({ ...o }) as JobOffer;
const offers = [
  job({ offerId: "1", itemCode: "iron", countryId: "eg", companyName: "Delta Iron", ownerName: "Ann", netPerPoint: "1000", currency: "money" }),
  job({ offerId: "2", itemCode: "iron", countryId: "eg", companyName: "Nile Co", ownerName: "Bob", netPerPoint: "200", currency: "money" }),
  job({ offerId: "3", itemCode: "steel", countryId: "us", companyName: "Steel Inc", ownerName: "Cy", netPerPoint: "600", currency: "money" }),
  job({ offerId: "4", itemCode: "steel", countryId: "us", companyName: "NoPay", currency: "money" }),
  job({ offerId: "5", itemCode: "steel", countryId: "us", companyName: "Other", netPerPoint: "50", currency: "gold" }),
];

describe("jobs", () => {
  it("filters on raw values and by text, country and product", () => {
    expect(filterJobs(offers, { ...NO_JOB_FILTERS, min: 500 }).map((o) => o.offerId)).toEqual(["1", "3"]);
    expect(filterJobs(offers, { ...NO_JOB_FILTERS, max: 300 }).map((o) => o.offerId)).toEqual(["2", "5"]);
    expect(filterJobs(offers, { ...NO_JOB_FILTERS, country: "us", item: "steel" }).map((o) => o.offerId)).toEqual(["3", "4", "5"]);
    expect(filterJobs(offers, { ...NO_JOB_FILTERS, q: "bob" }).map((o) => o.offerId)).toEqual(["2"]);
  });
  it("never mixes currencies and skips offers without a pay figure", () => {
    const st = jobStats(offers);
    expect(st.map((s) => s.currency)).toEqual(["money", "gold"]);
    const money = st[0]!;
    expect(money.offers).toBe(3);
    expect(money.avg).toBe(600);
    expect(money.highest).toBe(1000);
    expect(money.lowest).toBe(200);
    expect(money.median).toBe(600);
    expect(money.byCountry[0]).toMatchObject({ key: "eg", avg: 600, offers: 2 });
    expect(st[1]).toMatchObject({ currency: "gold", offers: 1, avg: 50 });
  });
  it("handles an empty list", () => { expect(jobStats([])).toEqual([]); });
});

describe("equipment floor", () => {
  const rows = [
    { slot: "helmet", rarity: "common", low: "30000", offers: 7 },
    { slot: "helmet", rarity: "mythic", low: "9000000", offers: 1 },
    { slot: "helmet", rarity: "weird", low: "5", offers: 1 },
    { slot: "boots", rarity: "rare", low: "100", offers: 2 },
  ];
  it("lists all six rarities per slot, marks missing ones empty and the lowest price", () => {
    const g = floorGroups(rows as never);
    const h = g.find((x) => x.slot === "helmet")!;
    expect(h.cells.slice(0, 6).map((c) => c.rarity)).toEqual(["common", "uncommon", "rare", "epic", "legendary", "mythic"]);
    expect(h.cells[1]).toMatchObject({ empty: true });
    expect(h.cells.find((c) => c.rarity === "weird")).toBeTruthy();
    const lowest = h.cells.filter((c) => "lowest" in c && c.lowest).map((c) => c.rarity);
    expect(lowest).toEqual(["weird"]);
  });
  it("filters by slot and rarity", () => {
    expect(floorGroups(rows as never, { slot: "boots" }).map((x) => x.slot)).toEqual(["boots"]);
    expect(floorGroups(rows as never, { rarity: "mythic" })[0]!.cells).toHaveLength(1);
  });
});

describe("member lists", () => {
  const skills = (war: number, eco: number) => [
    ...["attack", "criticalChance", "criticalDamages", "armor", "precision", "dodge", "health", "lootChance"].map((code) => ({ code, level: war, maxLevel: 10 })),
    ...["production", "entrepreneurship", "companies", "management"].map((code) => ({ code, level: eco, maxLevel: 10 })),
  ];
  const mk = (id: string, war: number, eco: number) => ({ id, r: classifyBuild(skills(war, eco)) });
  const players = [mk("a", 9, 1), mk("b", 1, 9), mk("c", 5, 5), mk("d", 8, 1)];
  const load: BuildLoad = {
    results: new Map([...players.map((p) => [p.id, p.r] as const), ["x", null]]),
    info: new Map(players.map((p) => [p.id, { id: p.id, name: p.id.toUpperCase(), avatar: null, level: 5, countryId: "eg" }] as const)),
    fetched: 0, pending: 0, failed: 1,
  };
  it("lists exactly the members behind each count, using the existing classifier", () => {
    const ids = ["a", "b", "c", "d", "x", "never-loaded"];
    const war = classifyKinds(ids, load, "war");
    expect(war.rows.map((r) => r.id).sort()).toEqual(["a", "d"]);
    expect(war.counts).toMatchObject({ war: 2, eco: 1, hybrid: 1, unavailable: 1, pending: 1, total: 6 });
    expect(classifyKinds(ids, load, "eco").rows.map((r) => r.id)).toEqual(["b"]);
    expect(classifyKinds(ids, load, "hybrid").rows.map((r) => r.id)).toEqual(["c"]);
  });
  it("counts each player once even if listed twice", () => {
    expect(classifyKinds(["a", "a", "a"], load, "war").rows).toHaveLength(1);
  });
});

import { ApiError } from "@/lib/api/errors";
import { _resetBuildCache, loadBuilds } from "@/lib/data/players";

describe("loadBuilds under rate limiting", () => {
  it("leaves rate-limited players pending instead of caching them as unavailable", async () => {
    _resetBuildCache();
    let calls = 0;
    const throttled = async () => { calls++; throw new ApiError("rate_limited", "budget", { retryAfterMs: 1000 }); };
    const a = await loadBuilds(["p1", "p2", "p3"], { concurrency: 1 }, throttled as never);
    expect(a.failed).toBe(0);
    expect(a.pending).toBe(3);
    expect(a.results.size).toBe(0);
    expect(calls).toBe(1);
    // Not cached: a later call asks again.
    await loadBuilds(["p1"], { concurrency: 1 }, throttled as never);
    expect(calls).toBe(2);
    _resetBuildCache();
  });
});
