import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isKnownPath } from "@/lib/api/endpoints";
import { countryScopedSources, discoverIds, DISCOVERY_SOURCES, idProbes, type Sources } from "@/lib/diagnostics/discover";

const real = (f: string): unknown => JSON.parse(readFileSync(`tests/fixtures/real/${f}.json`, "utf8"));
// Real captured list responses (tests/fixtures/real); nothing here is hand-written.
const sources: Sources = {
  countries: real("countries"), regions: real("regions"), battles: real("battles"), market: real("market"), game: real("game"),
  ranking: real("ranking-playerDamage"), companies: real("companies"), units: real("units"), alliances: real("alliances"), articles: real("articles"),
  tournaments: real("tournaments"), contracts: real("contracts"), countryParties: real("parties-eg"), countryLaws: real("laws-eg"), countryElections: real("elections-eg"),
};

describe("automatic id discovery (real list fixtures)", () => {
  const d = discoverIds(sources);
  it("finds an id for every entity type that has data", () => {
    for (const k of ["country", "region", "battle", "item", "board", "player", "company", "unit", "alliance", "party", "law", "election", "article", "newspaper", "tournament"] as const) {
      expect(d.ids[k].length, k).toBeGreaterThan(0);
      expect(d.from[k], k).toBeTruthy();
    }
  });
  it("reports an honest gap instead of inventing an id (the fixture has no auctions)", () => {
    expect(d.ids.auction).toEqual([]);
    const p = idProbes(d).find((x) => x.label === "auction")!;
    expect(p.endpoint).toBeNull();
    expect(p.skipped).toContain("GET /contracts");
  });
  it("picks the most developed country first and takes player ids from the ranking", () => {
    const devs = (real("countries") as { countries: { id: string; development: number }[] }).countries;
    const top = [...devs].sort((a, b) => b.development - a.development)[0]!.id;
    expect(d.ids.country[0]).toBe(top);
    expect(d.ids.player[0]).toMatch(/^usr_/);
    expect(d.playerName).toBeTruthy();
  });
  it("builds only documented paths, with no empty segments", () => {
    const probes = idProbes(d).filter((p) => p.endpoint);
    expect(probes.length).toBeGreaterThanOrEqual(40);
    for (const p of probes) {
      expect(isKnownPath(p.endpoint!.path), p.endpoint!.path).toBe(true);
      expect(p.endpoint!.path).not.toMatch(/undefined|\/\/|\/$/);
    }
    const paths = probes.map((p) => p.endpoint!.path);
    for (const needle of ["/market/", "/orders", "/history", "/trades", "/archive", "/stats", "/contracts"]) expect(paths.some((x) => x.includes(needle)), needle).toBe(true);
  });
  it("country-scoped lists use the discovered country", () => {
    expect(countryScopedSources("eg").map(([k]) => k)).toEqual(["countryParties", "countryLaws", "countryElections"]);
    expect(DISCOVERY_SOURCES.map(([k]) => k)).toContain("ranking");
  });
  it("survives missing, failed or malformed sources", () => {
    const e = discoverIds({});
    expect(Object.values(e.ids).every((v) => v.length === 0)).toBe(true);
    expect(idProbes(e).every((p) => p.endpoint === null)).toBe(true);
    expect(() => discoverIds({ countries: "x", regions: null, battles: 5, market: {}, ranking: [] })).not.toThrow();
  });
  it("ignores ids that do not match the API's id pattern", () => {
    expect(discoverIds({ units: [{ id: "bad id!" }, { id: "ok_1" }] }).ids.unit).toEqual(["ok_1"]);
  });
});

import { ApiError, describeError, isApiError } from "@/lib/api/errors";
describe("ApiError detection survives duplicated modules", () => {
  it("recognises a real ApiError and a look-alike from another module instance", () => {
    const real = new ApiError("http", "HTTP 404", { status: 404 });
    const lookalike = Object.assign(new Error("HTTP 404"), { name: "ApiError", kind: "http", status: 404 });
    for (const e of [real, lookalike]) { expect(isApiError(e)).toBe(true); expect(describeError(e).title).toBe("Not found"); }
  });
  it("still treats other errors as unexpected", () => {
    for (const e of [new Error("x"), "x", null, { name: "ApiError" }]) { expect(isApiError(e)).toBe(false); expect(describeError(e).title).toBe("Something went wrong"); }
  });
});
