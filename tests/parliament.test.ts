import { describe, expect, it } from "vitest";
import { groupByParty, layoutParliament } from "@/features/government/parliament";

describe("layoutParliament", () => {
  it("places exactly n seats for every size, inside the unit half-disc", () => {
    for (const n of [0, 1, 2, 7, 10, 15, 25, 41, 60, 99, 150]) {
      const { seats } = layoutParliament(n);
      expect(seats).toHaveLength(n);
      for (const s of seats) { expect(s.y).toBeGreaterThanOrEqual(-1e-9); expect(Math.hypot(s.x, s.y)).toBeLessThanOrEqual(1.0001); }
    }
  });
  it("seats do not overlap (distance at least ~0.8 of the seat size)", () => {
    for (const n of [10, 25, 60, 120]) {
      const { seats, seatSize } = layoutParliament(n);
      let min = Infinity;
      for (let i = 0; i < seats.length; i++) for (let j = i + 1; j < seats.length; j++) min = Math.min(min, Math.hypot(seats[i]!.x - seats[j]!.x, seats[i]!.y - seats[j]!.y));
      expect(min).toBeGreaterThanOrEqual(seatSize * 0.8);
    }
  });
  it("orders seats left to right so parties form wedges", () => {
    const { seats } = layoutParliament(30);
    for (let i = 1; i < seats.length; i++) expect(seats[i]!.angle).toBeLessThanOrEqual(seats[i - 1]!.angle + 1e-9);
  });
  it("rejects invalid counts", () => {
    expect(() => layoutParliament(-1)).toThrow();
    expect(() => layoutParliament(2.5)).toThrow();
  });
});

describe("groupByParty", () => {
  const m = (id: string | null, n: string) => ({ n, party: id ? { id, name: `P-${id}` } : null });
  it("puts the ruling party first, then larger parties, and no-party members last", () => {
    const g = groupByParty([m("a", "1"), m("b", "2"), m("b", "3"), m(null, "4"), m("c", "5"), m("c", "6"), m("c", "7")], "a");
    expect(g.map((x) => x.key)).toEqual(["a", "c", "b", "__none__"]);
    expect(g.reduce((s, x) => s + x.members.length, 0)).toBe(7);
  });
  it("without a ruling party, orders by size", () => {
    expect(groupByParty([m("a", "1"), m("b", "2"), m("b", "3")]).map((x) => x.key)).toEqual(["b", "a"]);
  });
});
