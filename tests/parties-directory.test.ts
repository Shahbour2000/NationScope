import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PARTY_FETCH_CAP, _resetPartyCache, getWorldParties } from "@/lib/data/world";

const meta = { fetchedAt: "2026-11-10T00:00:00Z" } as never;
const country = (id: string, citizens: number | null) => ({ id, name: id, citizens }) as never;
const party = (id: string) => ({ id, name: `Party ${id}`, ethics: [], members: 1 }) as never;

describe("parties directory coverage", () => {
  beforeEach(() => _resetPartyCache());
  afterEach(() => vi.useRealTimers());

  it("queries only countries that have citizens, tags rows with their country, and reports full coverage", async () => {
    const countries = [country("a", 10), country("b", 5), country("empty", 0), country("unknown", null)];
    const fetcher = vi.fn(async (id: string) => ({ parties: [party(`${id}1`), party(`${id}2`)] }));
    const r = await getWorldParties(fetcher as never, async () => ({ countries, meta }));
    expect(fetcher.mock.calls.map((c) => c[0]).sort()).toEqual(["a", "b"]);
    expect(r.total).toBe(2);
    expect(r.covered).toBe(2);
    expect(r.missing).toEqual([]);
    expect(r.rows.map((p) => `${p.countryId}:${p.id}`).sort()).toEqual(["a:a1", "a:a2", "b:b1", "b:b2"]);
  });

  it("reports a country whose request failed as missing (partial), never as an empty country", async () => {
    const countries = [country("a", 10), country("b", 5)];
    const fetcher = vi.fn(async (id: string) => { if (id === "b") throw new Error("rate limited"); return { parties: [party("a1")] }; });
    const r = await getWorldParties(fetcher as never, async () => ({ countries, meta }));
    expect(r.covered).toBe(1);
    expect(r.total).toBe(2);
    expect(r.missing).toEqual(["b"]);
    expect(r.failed).toBe(1);
  });

  it("caps requests per render, then completes on the next visits without refetching cached countries", async () => {
    const countries = Array.from({ length: PARTY_FETCH_CAP + 10 }, (_, i) => country(`c${String(i).padStart(2, "0")}`, 1000 - i));
    const fetcher = vi.fn(async (id: string) => ({ parties: [party(id)] }));
    const load = async () => ({ countries, meta });
    const first = await getWorldParties(fetcher as never, load);
    expect(fetcher).toHaveBeenCalledTimes(PARTY_FETCH_CAP);
    expect(first.covered).toBe(PARTY_FETCH_CAP);
    expect(first.missing).toHaveLength(10);
    const second = await getWorldParties(fetcher as never, load);
    expect(fetcher).toHaveBeenCalledTimes(PARTY_FETCH_CAP + 10);
    expect(second.missing).toEqual([]);
    const third = await getWorldParties(fetcher as never, load);
    expect(fetcher).toHaveBeenCalledTimes(PARTY_FETCH_CAP + 10);
    expect(third.rows).toHaveLength(PARTY_FETCH_CAP + 10);
  });

  it("refreshes a country after the cache lifetime and keeps its old rows if the refresh fails", async () => {
    vi.useFakeTimers();
    const countries = [country("a", 1)];
    let fail = false;
    const fetcher = vi.fn(async () => { if (fail) throw new Error("down"); return { parties: [party("a1")] }; });
    const load = async () => ({ countries, meta });
    await getWorldParties(fetcher as never, load);
    vi.advanceTimersByTime(31 * 60_000);
    fail = true;
    const r = await getWorldParties(fetcher as never, load);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(r.rows).toHaveLength(1);
    expect(r.covered).toBe(1);
  });
});
