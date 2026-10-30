import { describe, expect, it } from "vitest";
import { countByType, groupByDay } from "@/features/history/timeline";

const e = (type: string, at: string | null) => ({ type, at });
describe("groupByDay", () => {
  it("groups by UTC day, newest first, newest event first within a day", () => {
    const g = groupByDay([e("law", "2026-10-01T08:00:00Z"), e("battle", "2026-10-02T01:00:00Z"), e("treaty", "2026-10-01T20:00:00Z")]);
    expect(g.map((x) => x.day)).toEqual(["2026-10-02", "2026-10-01"]);
    expect(g[1]!.items.map((x) => x.type)).toEqual(["treaty", "law"]);
  });
  it("keeps missing / invalid dates in a trailing group instead of dropping them", () => {
    const g = groupByDay([e("law", null), e("battle", "not-a-date"), e("treaty", "2026-10-01T00:00:00Z")]);
    expect(g.map((x) => x.day)).toEqual(["2026-10-01", null]);
    expect(g[1]!.items).toHaveLength(2);
  });
  it("empty input", () => expect(groupByDay([])).toEqual([]));
});
describe("countByType", () => { it("counts", () => expect([...countByType([e("a", null), e("a", null), e("b", null)])]).toEqual([["a", 2], ["b", 1]])); });
