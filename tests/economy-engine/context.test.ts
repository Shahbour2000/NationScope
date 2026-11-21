import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { ApiError } from "@/lib/api/errors";
import type { Endpoint } from "@/lib/api/endpoints";
import { loadEngineContext, mapJobs, mapMarket, mapPlayer, mapTaxes, type Get } from "@/features/economy-engine/data/context";
import { levelOf } from "@/features/economy-engine/domain/skills";

const fx = (n: string) => JSON.parse(readFileSync(`tests/fixtures/real/${n}.json`, "utf8"));
const meta = { source: "live" as const, fetchedAt: "2026-11-17T10:00:00.000Z" };
/** SYNTHETIC profile: shape taken from API/PLAYER_DATA_AUDIT.md (skills = [{code, level, maxLevel}]); levels from the hand-transcribed player-skills fixture. */
const profile = { id: "usr_a", username: "Alice", level: 22, countryId: "eg", regionId: "eg-center", skills: fx("player-skills").skills };
const company = fx("company-detail");

function fake(over: Record<string, () => unknown> = {}) {
  const calls: string[] = [];
  const routes: [RegExp, () => unknown][] = [
    [/^\/market$/, () => fx("market")], [/^\/jobs$/, () => fx("jobs")],
    [/^\/players\/by-name\//, () => profile], [/^\/players\/usr_a$/, () => profile], [/^\/players\/usr_a\/companies$/, () => ({ companies: [{ id: company.id }] })],
    [/^\/companies\//, () => company], [/^\/regions\//, () => ({ id: "eg-center", countryId: "eg" })],
    [/^\/countries\//, () => fx("country-eg")], [/^\/market\/[^/]+\/orders$/, () => ({ buys: [{ price: "32000", qty: 10 }], sells: [{ price: "41900", qty: 5 }] })],
    [/^\/market\/[^/]+\/trades$/, () => ({ trades: [] })], [/^\/market\/trades$/, () => fx("market-trades")],
    [/^\/market\/[^/]+\/history$/, () => ({ points: [{ time: "2026-11-10T00:00:00Z", price: "32000", volume: 10 }, { time: "2026-11-11T00:00:00Z", price: "33000", volume: 12 }] })],
  ];
  const get: Get = async (e: Endpoint) => {
    calls.push(e.path);
    for (const [re, fn] of routes) if (re.test(e.path)) { const key = [...Object.keys(over)].find((k) => new RegExp(k).test(e.path)); const out = (key ? over[key]! : fn)(); return { data: out, meta }; }
    throw new ApiError("http", "no route", { status: 404 });
  };
  return { get, calls };
}

describe("automatic discovery chain (no manual ids)", () => {
  it("name -> player id -> companies -> details -> region -> country taxes -> order books", async () => {
    const f = fake(); const ctx = await loadEngineContext({ player: "Alice", get: f.get });
    expect(f.calls).toEqual(expect.arrayContaining(["/players/by-name/Alice", "/players/usr_a/companies", `/companies/${company.id}`, "/regions/eg-center", "/countries/eg", "/market/concrete/orders", "/market/concrete/trades"]));
    expect(ctx.player?.state).toBe("ok");
    if (ctx.player?.state === "ok") expect(levelOf(ctx.player.value.skills, "production")).toBe(4);
    expect(ctx.companies?.state).toBe("ok"); expect(ctx.taxes?.state).toBe("ok");
    expect(ctx.requests).toBe(f.calls.length); expect(f.calls.length).toBeLessThanOrEqual(11);
  });
  it("without a player name it only loads market, jobs and the all-items trade sample (3 requests)", async () => {
    const f = fake(); const ctx = await loadEngineContext({ get: f.get });
    expect(f.calls).toHaveLength(3); expect(ctx.player).toBeNull(); expect(ctx.market.state).toBe("ok");
  });
  it("requests the profile by id when the by-name body has no skills", async () => {
    const f = fake({ "^/players/by-name/": () => ({ id: "usr_a", username: "Alice" }), "^/players/usr_a$": () => profile });
    const ctx = await loadEngineContext({ player: "Alice", get: f.get });
    expect(f.calls).toContain("/players/usr_a");
    if (ctx.player?.state === "ok") expect(ctx.player.value.skills.length).toBeGreaterThan(5);
  });
  it("caps company details to the budget", async () => {
    const many = Array.from({ length: 12 }, (_, k) => ({ id: `cmp_${k}` }));
    const f = fake({ "^/players/usr_a/companies$": () => ({ companies: many }) });
    await loadEngineContext({ player: "Alice", maxCompanies: 4, get: f.get });
    expect(f.calls.filter((c) => c.startsWith("/companies/"))).toHaveLength(4);
  });
});

describe("failures are not 'does not exist'", () => {
  it("a rate limit stays rate_limited, a 404 is missing, a timeout is error", async () => {
    const rl: Get = async () => { throw new ApiError("rate_limited", "x", { local: true }); };
    expect((await loadEngineContext({ get: rl })).market).toEqual({ state: "rate_limited", reason: "local-budget" });
    const nf: Get = async () => { throw new ApiError("http", "x", { status: 404 }); };
    expect((await loadEngineContext({ get: nf })).market).toEqual({ state: "missing", reason: "404" });
    const to: Get = async () => { throw new ApiError("timeout", "x"); };
    expect((await loadEngineContext({ get: to })).market).toEqual({ state: "error", reason: "timeout" });
  });
  it("an unknown player is reported as missing and nothing else is requested for them", async () => {
    const f = fake({ "^/players/by-name/": () => { throw new ApiError("http", "x", { status: 404 }); } });
    const ctx = await loadEngineContext({ player: "Nobody", get: f.get });
    expect(ctx.player).toEqual({ state: "missing", reason: "404" });
    expect(f.calls.some((c) => c.includes("/companies"))).toBe(false);
  });
  it("one rate-limited company detail does not hide the others", async () => {
    let n = 0;
    const f = fake({ "^/players/usr_a/companies$": () => ({ companies: [{ id: "cmp_1" }, { id: "cmp_2" }] }), "^/companies/": () => { if (n++ === 0) throw new ApiError("rate_limited", "x"); return company; } });
    const ctx = await loadEngineContext({ player: "Alice", get: f.get });
    expect(ctx.companies?.state).toBe("ok"); if (ctx.companies?.state === "ok") expect(ctx.companies.value).toHaveLength(1);
  });
  it("a player with no companies is a valid empty result", async () => {
    const f = fake({ "^/players/usr_a/companies$": () => ({ companies: [] }) });
    const ctx = await loadEngineContext({ player: "Alice", get: f.get });
    expect(ctx.companies).toMatchObject({ state: "ok", value: [] });
  });
});

describe("parsers", () => {
  it("market rows keep missing prices as null", () => { const r = mapMarket(fx("market"))!; expect(r.find((x) => x.itemCode === "cookedFish")!.bestAsk).toBeNull(); expect(mapMarket({ nope: 1 })).toBeNull(); });
  it("jobs: skips own/blocked offers, keeps the legal wage band", () => {
    const j = mapJobs({ allowedWage: { min: "264", max: "2400", median: "800" }, offers: [{ netPerPoint: "1000" }, { netPerPoint: "9", own: true }, { netPerPoint: "8", blocked: "x" }, { netPerPoint: "7", moneyAvailable: false }, { netPerPoint: "0" }] })!;
    expect(j.offersNet).toEqual(["1000"]); expect(j.offerCount).toBe(5); expect(j.allowed).toEqual({ min: "264", max: "2400", median: "800" });
    expect(mapJobs({ allowedWage: null, offers: [] })!.allowed).toBeNull();
  });
  it("player and taxes", () => { expect(mapPlayer({ id: "u", username: "n", skills: [{ code: "production", level: 2, maxLevel: 10 }] })!.skills).toHaveLength(1); expect(mapPlayer({})).toBeNull(); expect(mapTaxes(fx("country-eg"), "eg")!.marketPct).toBe(10); expect(mapTaxes({}, "eg")).toBeNull(); });
});

describe("request budget", () => {
  it("never exceeds 3 + 3 (player) + companies + 2 (tax) + 3 per item, and shares one fetch per entity", async () => {
    const many = Array.from({ length: 12 }, (_, k) => ({ id: `cmp_${k}` }));
    const f = fake({ "^/players/usr_a/companies$": () => ({ companies: many }) });
    const ctx = await loadEngineContext({ player: "Alice", maxCompanies: 6, get: f.get });
    expect(ctx.requests).toBeLessThanOrEqual(3 + 3 + 6 + 2 + 3 * 1); // every company here is the same item -> one book + one trade list
    expect(new Set(f.calls).size).toBe(Object.keys(ctx.items).length * 3 + new Set(f.calls.filter((c) => !/^\/market\/[^/]+\/(orders|trades|history)$/.test(c))).size);
  });
});
