import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/errors";

const mocks = vi.hoisted(() => ({ get: vi.fn(), getTournaments: vi.fn() }));
vi.mock("@/lib/api/instance", () => ({ getApiClient: () => ({ get: mocks.get }) }));
vi.mock("@/lib/data/world", () => ({ getTournaments: mocks.getTournaments }));

import { getEditionBattles, getTournamentDetail, parseEdition } from "@/lib/data/tournaments";

beforeEach(() => { mocks.get.mockReset(); mocks.getTournaments.mockReset(); });

const edition = { id: "ted_1", kind: "mu", name: "Unit Tournament", status: "running", startsAt: "2026-10-16T18:00:00.000Z", totalRounds: 3, registrations: [{ id: "r1", entrantId: "mu_a", seed: 1, name: "Alpha" }, { id: "r2", entrantId: "mu_b", seed: 2, name: "Beta" }] };

describe("getTournamentDetail error handling", () => {
  it("reports a rate limit as an error, not as a missing tournament", async () => {
    mocks.get.mockRejectedValue(new ApiError("rate_limited", "budget", { retryAfterMs: 1000 }));
    mocks.getTournaments.mockRejectedValue(new ApiError("rate_limited", "budget", { retryAfterMs: 1000 }));
    const r = await getTournamentDetail("ted_1");
    expect(r.edition).toBeNull();
    expect(r.error).toBeInstanceOf(ApiError);
    expect((r.error as ApiError).kind).toBe("rate_limited");
  });
  it("a genuine 404 on detail with no match in the list is 'not found' (error is the 404)", async () => {
    mocks.get.mockRejectedValue(new ApiError("http", "nf", { status: 404 }));
    mocks.getTournaments.mockResolvedValue({ current: null, history: [], meta: {} });
    const r = await getTournamentDetail("ted_x");
    expect(r.edition).toBeNull();
    expect((r.error as ApiError).status).toBe(404);
  });
  it("falls back to the list edition when the detail endpoint fails, and says so", async () => {
    mocks.get.mockRejectedValue(new ApiError("http", "nf", { status: 404 }));
    mocks.getTournaments.mockResolvedValue({ current: { ...edition, entrants: [] }, history: [], meta: {} });
    const r = await getTournamentDetail("ted_1");
    expect(r.source).toBe("list");
    expect(r.edition?.entrants.map((e) => e.entrantId)).toEqual(["mu_a", "mu_b"]);
    expect(r.error).toBeNull();
  });
  it("uses the detail endpoint when it returns a recognised edition (also when wrapped)", async () => {
    mocks.get.mockResolvedValue({ data: { edition }, meta: {} });
    const r = await getTournamentDetail("ted_1");
    expect(r.source).toBe("detail");
    expect(r.edition?.totalRounds).toBe(3);
  });
  it("parseEdition rejects an unrecognised body instead of guessing", () => { expect(parseEdition({ nope: 1 })).toBeNull(); });
});

describe("derived tournament battles (inferred association)", () => {
  const ed = parseEdition(edition)!;
  const battle = (id: string, a: string, b: string, startedAt: string, type = "tournament") => ({ id, type, attackerMuId: a, defenderMuId: b, startedAt, status: "finished" });
  it("keeps only tournament battles between two entrants that started inside the window; flags a full page as possibly truncated", async () => {
    const rows = [battle("b1", "mu_a", "mu_b", "2026-10-17T00:00:00Z"), battle("b2", "mu_a", "mu_z", "2026-10-17T00:00:00Z"), battle("b3", "mu_a", "mu_b", "2026-10-01T00:00:00Z"), battle("b4", "mu_a", "mu_b", "2026-10-17T00:00:00Z", "regional")];
    mocks.get.mockResolvedValue({ data: { battles: rows }, meta: {} });
    const r = await getEditionBattles(ed);
    expect(r.battles.map((b) => b.id)).toEqual(["b1"]);
    expect(r.derived).toBe(true);
    expect(r.truncated).toBe(false);
    const full = Array.from({ length: 100 }, (_, i) => battle(`x${i}`, "mu_a", "mu_b", "2026-10-17T00:00:00Z"));
    mocks.get.mockResolvedValue({ data: { battles: full }, meta: {} });
    expect((await getEditionBattles(ed)).truncated).toBe(true);
  });
  it("returns nothing when there are no entrants (no battle can be attributed)", async () => {
    const r = await getEditionBattles({ ...ed, entrants: [] });
    expect(r.battles).toEqual([]);
    expect(mocks.get).not.toHaveBeenCalled();
  });
});
