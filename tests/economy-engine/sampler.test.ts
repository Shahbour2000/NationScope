import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { anonymize, itemCodesOf, request, sample } from "../../scripts/aon-sample-core.mjs";

const fx = (n: string) => JSON.parse(readFileSync(`tests/fixtures/real/${n}.json`, "utf8"));
type Res = { status: number; ok: boolean; headers: { get: (k: string) => string | null }; json: () => Promise<unknown> };
const res = (status: number, body: unknown = {}, headers: Record<string, string> = {}): Res => ({ status, ok: status >= 200 && status < 300, headers: { get: (k) => headers[k.toLowerCase()] ?? null }, json: async () => body });
const noSleep = async () => {};

describe("request(): failures are never 'missing'", () => {
  it("only HTTP 404 is missing", async () => { expect((await request(async () => res(404), "u", { sleep: noSleep })).kind).toBe("missing"); });
  it("429 retries after Retry-After and succeeds", async () => {
    let n = 0; const waits: number[] = [];
    const r = await request(async () => (n++ < 2 ? res(429, {}, { "retry-after": "7" }) : res(200, { a: 1 })), "u", { sleep: async (ms: number) => { waits.push(ms); } });
    expect(r).toMatchObject({ kind: "ok", data: { a: 1 } }); expect(waits).toEqual([7000, 7000]);
  });
  it("a 429 that never clears is rate_limited, not missing", async () => { expect((await request(async () => res(429), "u", { sleep: noSleep, retries: 2 })).kind).toBe("rate_limited"); });
  it("timeouts and network errors are reported as such after retries", async () => {
    const abort = Object.assign(new Error("x"), { name: "AbortError" });
    expect((await request(async () => { throw abort; }, "u", { sleep: noSleep, retries: 1 })).kind).toBe("timeout");
    expect((await request(async () => { throw new Error("ECONNRESET"); }, "u", { sleep: noSleep, retries: 1 })).kind).toBe("network");
  });
  it("5xx is retried and then reported as http, other 4xx is http, bad JSON is bad_json", async () => {
    expect((await request(async () => res(503), "u", { sleep: noSleep, retries: 1 }))).toMatchObject({ kind: "http", status: 503 });
    expect((await request(async () => res(403), "u", { sleep: noSleep }))).toMatchObject({ kind: "http", status: 403 });
    expect((await request(async () => ({ ...res(200), json: async () => { throw new Error("x"); } }), "u", { sleep: noSleep })).kind).toBe("bad_json");
  });
});

describe("anonymize()", () => {
  it("replaces the name and ids everywhere and drops private-looking keys", () => {
    const out = JSON.stringify(anonymize({ id: "usr_123", username: "Alice", email: "a@b.c", note: "hi alice!", nested: { discordId: "9", regionId: "r1", token: "t" } }, { username: "Alice", ids: ["usr_123", "r1"] }));
    expect(out).not.toMatch(/Alice|alice|usr_123|r1|a@b|discord|token/); expect(out).toContain("Player");
  });
});

/** A fake game: serves the repo's real captured responses plus a synthetic by-name profile. */
function fakeGame(over: Record<string, () => Res> = {}) {
  const calls: string[] = [];
  const profile = { id: "usr_a", username: "Alice", regionId: "eg-center", countryId: "eg", skills: fx("player-skills").skills };
  const routes: [RegExp, () => Res][] = [
    [/\/api\/v1\/market$/, () => res(200, fx("market"))], [/\/jobs$/, () => res(200, fx("jobs"))], [/\/market\/trades\?/, () => res(200, fx("market-trades"))],
    [/\/players\/by-name\//, () => res(200, profile)], [/\/players\/usr_a$/, () => res(200, profile)], [/\/players\/usr_a\/companies/, () => res(200, { companies: [{ id: "cmp_1" }, { id: "cmp_2" }] })],
    [/\/companies\//, () => res(200, fx("company-detail"))], [/\/regions\//, () => res(200, { countryId: "eg" })], [/\/countries\//, () => res(200, fx("country-eg"))],
    [/\/orders$/, () => res(200, { buys: [], sells: [] })], [/\/history/, () => res(200, { points: [] })], [/\/market\/[^/]+\/trades/, () => res(200, { trades: [] })],
  ];
  const fetchFn = async (url: string) => { calls.push(url); for (const [k, v] of Object.entries(over)) if (new RegExp(k).test(url)) return v(); for (const [re, fn] of routes) if (re.test(url)) return fn(); return res(404); };
  return { fetchFn, calls };
}

describe("sample(): discovers ids from a player name", () => {
  it("market, jobs, trades, player, companies, region, country, then orders/history/trades for the company item", async () => {
    const g = fakeGame(); const files: Record<string, unknown> = {};
    const m = await sample({ fetchFn: g.fetchFn as never, base: "https://x", player: "Alice", maxCompanies: 2, write: (n, d) => { files[n] = d; }, sleep: noSleep, minGapMs: 0 });
    expect(m.problems).toEqual([]); expect(m.skillsFound).toBe(true); expect(m.items).toEqual(["concrete"]);
    expect(Object.keys(files)).toEqual(expect.arrayContaining(["market.json", "jobs.json", "all-trades.json", "by-name.json", "player-companies.json", "company-1.json", "company-2.json", "region.json", "country.json", "orders-concrete.json", "history-concrete.json", "trades-concrete.json"]));
    expect(g.calls.some((c) => c.includes("/players/by-name/Alice"))).toBe(true); expect(g.calls.length).toBeLessThanOrEqual(25);
  });
  it("requests the profile by id when by-name has no skills", async () => {
    const g = fakeGame({ "/players/by-name/": () => res(200, { id: "usr_a", username: "Alice", regionId: "eg-center" }) }); const files: string[] = [];
    const m = await sample({ fetchFn: g.fetchFn as never, base: "https://x", player: "Alice", write: (n) => { files.push(n); }, sleep: noSleep, minGapMs: 0 });
    expect(files).toContain("profile.json"); expect(m.skillsFound).toBe(true);
  });
  it("a missing player stops with player-not-found; a rate limit stops as a connection problem", async () => {
    const a = await sample({ fetchFn: fakeGame({ "/players/by-name/": () => res(404) }).fetchFn as never, base: "https://x", player: "Nobody", write: () => {}, sleep: noSleep, minGapMs: 0 });
    expect(a.stopped).toBe("player-not-found");
    const b = await sample({ fetchFn: fakeGame({ "/players/by-name/": () => res(429) }).fetchFn as never, base: "https://x", player: "Alice", write: () => {}, sleep: noSleep, minGapMs: 0 });
    expect(b.stopped).toBe("player-lookup-rate_limited"); expect(b.problems.join()).toContain("rate_limited");
  });
  it("anonymizes what it writes", async () => {
    const files: Record<string, string> = {};
    await sample({ fetchFn: fakeGame().fetchFn as never, base: "https://x", player: "Alice", anonymizeOut: true, write: (n, d) => { files[n] = JSON.stringify(d); }, sleep: noSleep, minGapMs: 0 });
    expect(files["by-name.json"]).not.toMatch(/Alice|usr_a/); expect(files["by-name.json"]).toContain("Player");
  });
  it("itemCodesOf reads the real market fixture", () => { expect(itemCodesOf(fx("market"))).toContain("concrete"); });
});
