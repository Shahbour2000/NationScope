import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/errors";
import { PATH_TEMPLATES, PROBE_ENDPOINTS, endpoints, isKnownPath } from "@/lib/api/endpoints";

describe("endpoints", () => {
  it("builds documented paths and queries", () => {
    expect(endpoints.game()).toEqual({ path: "/game" });
    expect(endpoints.country("abc_1-2").path).toBe("/countries/abc_1-2");
    expect(endpoints.citizens("x", { limit: 100, offset: 10000 }).query).toMatchObject({ limit: 100, offset: 10000 });
    expect(endpoints.search("  ab ").query).toEqual({ q: "ab" });
  });
  it("rejects ids that do not match the spec pattern", () => {
    for (const bad of ["", "../x", "a/b", "a b", "x".repeat(81)]) {
      expect(() => endpoints.country(bad)).toThrow(ApiError);
    }
  });
  it("enforces documented query bounds", () => {
    expect(() => endpoints.citizens("x", { limit: 101 })).toThrow(ApiError);
    expect(() => endpoints.citizens("x", { offset: 10001 })).toThrow(ApiError);
    expect(() => endpoints.marketHistory("gold", { hours: 721 })).toThrow(ApiError);
    expect(() => endpoints.search("a")).toThrow(ApiError);
    expect(() => endpoints.search("x".repeat(61))).toThrow(ApiError);
    expect(() => endpoints.battles({ status: "bogus" as never })).toThrow(ApiError);
    expect(() => endpoints.equipment({ limit: 61 })).toThrow(ApiError);
  });
  it("builds the production-spec additions with documented bounds", () => {
    expect(endpoints.countrySummary("pl").path).toBe("/countries/pl/summary");
    expect(endpoints.governmentMembers("pl").path).toBe("/countries/pl/government/members");
    expect(endpoints.companies({ countryId: "pl", sort: "workers", limit: 100 }).query).toMatchObject({ countryId: "pl", sort: "workers", limit: 100 });
    expect(() => endpoints.companies({ limit: 101 })).toThrow(ApiError);
    expect(() => endpoints.companies({ sort: "bogus" as never })).toThrow(ApiError);
    expect(endpoints.players(["a", "b"]).query).toEqual({ ids: "a,b" });
    expect(() => endpoints.players([])).toThrow(ApiError);
    expect(() => endpoints.players(Array.from({ length: 26 }, (_, i) => `u${i}`))).toThrow(ApiError);
    expect(endpoints.playerByName("Bloody Valentine").path).toBe("/players/by-name/Bloody%20Valentine");
    expect(() => endpoints.playerByName("")).toThrow(ApiError);
    expect(() => endpoints.playerByName("x".repeat(41))).toThrow(ApiError);
    expect(endpoints.lawsCatalog().path).toBe("/laws");
  });
  it("knows the spec's path templates and rejects others", () => {
    expect(PATH_TEMPLATES).toHaveLength(65);
    expect(isKnownPath("/units")).toBe(true);
    expect(isKnownPath("/countries/EG_1/government/history")).toBe(true);
    expect(isKnownPath("/players/by-name/Bloody%20Valentine")).toBe(true);
    expect(isKnownPath("/players/by-name/a/b")).toBe(false);
    expect(isKnownPath("/admin")).toBe(false);
    expect(isKnownPath("/countries/../x")).toBe(false);
    expect(PROBE_ENDPOINTS.every((e) => isKnownPath(e.path))).toBe(true);
  });
});
