import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const calls: { path: string; query?: Record<string, unknown> }[] = [];
let body: unknown = {};
vi.mock("@/lib/api/instance", () => ({
  getApiClient: () => ({
    get: async (path: string, o: { query?: Record<string, unknown> }) => { calls.push({ path, query: o.query }); return { data: body, meta: { source: "live", fetchedAt: 0 } }; },
  }),
}));

import { getPlayerCompaniesAll } from "@/lib/data/economy";

const fixture = JSON.parse(readFileSync("tests/fixtures/real/companies.json", "utf8")) as { companies: unknown[]; total: number };

describe("players/[id]/companies data", () => {
  beforeEach(() => { calls.length = 0; });
  it("requests the documented endpoint with a limit that covers every company a player can own", async () => {
    body = { total: 2, limit: 100, offset: 0, companies: fixture.companies.slice(0, 2) };
    const r = await getPlayerCompaniesAll("usr_abc", { sort: "workers" });
    expect(calls).toEqual([{ path: "/players/usr_abc/companies", query: { sort: "workers", limit: 100 } }]);
    expect(r.rows).toHaveLength(2); expect(r.total).toBe(2); expect(r.skipped).toBe(0);
  });
  it("keeps 'no companies' (empty page) distinct from unreadable rows", async () => {
    body = { total: 0, limit: 100, offset: 0, companies: [] };
    const empty = await getPlayerCompaniesAll("usr_abc");
    expect(empty).toMatchObject({ rows: [], skipped: 0, total: 0 });
    body = { total: 2, companies: [fixture.companies[0], { broken: true }] };
    const mixed = await getPlayerCompaniesAll("usr_abc");
    expect(mixed.rows).toHaveLength(1); expect(mixed.skipped).toBe(1);
  });
  it("rejects an invalid player id before any request", async () => {
    await expect(getPlayerCompaniesAll("bad id!")).rejects.toThrow();
    expect(calls).toHaveLength(0);
  });
});
