import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { endpoints, type Endpoint } from "@/lib/api/endpoints";

/**
 * Every endpoint the Phase 1 pages request must exist in the API Reference (OpenAPI) with exactly the documented query parameters.
 * This checks REQUEST construction against the reference. It cannot check response shapes: the reference has none (every 200 body is an open object).
 */
interface Param { name: string; in: string; required?: boolean; schema?: { minimum?: number; maximum?: number; enum?: string[] } }
const spec = JSON.parse(readFileSync("API/references/AgeOfNations_API_Reference.txt", "utf8")) as { paths: Record<string, { get: { parameters?: Param[] } }> };
const API = "/api/v1";
const templateOf = (path: string) => Object.keys(spec.paths).find((tpl) => new RegExp("^" + (API + tpl.replace(API, "")).replace(/\{[^}]+\}/g, "[^/]+") + "$").test(API + path) || new RegExp("^" + tpl.replace(/\{[^}]+\}/g, "[^/]+") + "$").test(API + path));

const cases: [string, Endpoint][] = [
  ["region", endpoints.region("r1")], ["regionCompanies", endpoints.regionCompanies("r1")], ["regionCampaign", endpoints.regionCampaign("r1")], ["battleContracts", endpoints.battleContracts("b1")],
  ["marketOrders", endpoints.marketOrders("iron")], ["marketHistory", endpoints.marketHistory("iron", { hours: 168 })], ["marketTrades", endpoints.marketTrades("iron", { limit: 50 })],
  ["playerStats", endpoints.playerStats("u1")], ["playerCompanies", endpoints.playerCompanies("u1", { sort: "workers", limit: 100 })], ["company", endpoints.company("c1")],
  ["rankingArchive", endpoints.rankingArchive("playerDamage")], ["ranking(periodKey)", endpoints.ranking("playerDamage", { period: "daily", periodKey: "2026-11-10", limit: 100 })],
  ["law", endpoints.law("l1")], ["election", endpoints.election("e1")], ["article", endpoints.article("a1")], ["newspaper", endpoints.newspaper("n1")], ["game", endpoints.game()], ["contracts", endpoints.contracts()],
];

describe("requests match the API Reference", () => {
  it.each(cases)("%s", (_name, e) => {
    const tpl = templateOf(e.path);
    expect(tpl, `${e.path} is not in the API Reference`).toBeTruthy();
    const params = spec.paths[tpl!]!.get.parameters ?? [];
    const queryNames = params.filter((p) => p.in === "query").map((p) => p.name);
    for (const [k, v] of Object.entries(e.query ?? {})) {
      if (v === undefined) continue;
      expect(queryNames, `${e.path}: query parameter ${k} is not documented`).toContain(k);
      const p = params.find((x) => x.name === k)!;
      if (typeof v === "number" && p.schema?.maximum !== undefined) expect(v, `${k} above documented maximum`).toBeLessThanOrEqual(p.schema.maximum);
      if (typeof v === "number" && p.schema?.minimum !== undefined) expect(v, `${k} below documented minimum`).toBeGreaterThanOrEqual(p.schema.minimum);
      if (typeof v === "string" && p.schema?.enum) expect(p.schema.enum, `${k}=${v} not in documented enum`).toContain(v);
    }
    for (const p of params.filter((x) => x.in === "query" && x.required)) expect(e.query?.[p.name], `${e.path}: required ${p.name} missing`).toBeDefined();
  });
});
