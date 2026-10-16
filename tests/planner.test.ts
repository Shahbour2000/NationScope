import { describe, expect, it } from "vitest";
import { selectEquipment, scorePerGold, type Item } from "@/features/planner/equipment";
import { PlannerInputError, allocateSkills, type SkillDef } from "@/features/planner/skills";

// SYNTHETIC test models. They are NOT Age of Nations rules and never appear in the product.
const linear = (id: string, max: number, per = 1): SkillDef => ({ id, maxLevel: max, cumulativeCost: (l) => l * per });

describe("allocateSkills", () => {
  it("finds the exhaustive optimum for a model with a known answer", () => {
    // score = 3a + 2b, cost 1 per level, 4 points, a<=2, b<=5  -> a=2,b=2 => 10
    const r = allocateSkills({ skills: [linear("a", 2), linear("b", 5)], points: 4, objective: (l) => 3 * l.a! + 2 * l.b! });
    expect(r.exhaustive).toBe(true);
    expect(r.best).toMatchObject({ levels: { a: 2, b: 2 }, score: 10, spent: 4 });
  });
  it("never exceeds the point budget or level caps (all ranked results)", () => {
    const r = allocateSkills({ skills: [linear("a", 3, 2), linear("b", 3, 3)], points: 9, top: 20, objective: (l) => l.a! + l.b! });
    for (const a of r.ranked) {
      expect(a.spent).toBeLessThanOrEqual(9);
      expect(a.levels.a).toBeLessThanOrEqual(3);
      expect(a.levels.b).toBeLessThanOrEqual(3);
    }
  });
  it("keeps already-invested levels as a floor", () => {
    const r = allocateSkills({ skills: [linear("a", 5), linear("b", 5)], points: 5, floor: { a: 3 }, objective: (l) => l.b! });
    expect(r.best!.levels.a).toBe(3);
    expect(r.best!.levels.b).toBe(2);
  });
  it("supports non-linear costs and non-additive objectives", () => {
    const quad: SkillDef = { id: "q", maxLevel: 4, cumulativeCost: (l) => l * l };
    const r = allocateSkills({ skills: [quad, linear("b", 4)], points: 8, objective: (l) => l.q! * l.b! });
    expect(r.best!.score).toBe(8); // q=2 (cost 4) * b=4 (cost 4)
  });
  it("ranks alternatives and prefers fewer points on ties", () => {
    const r = allocateSkills({ skills: [linear("a", 3)], points: 3, objective: () => 1, top: 3 });
    expect(r.ranked.map((x) => x.spent)).toEqual([0, 1, 2]);
  });
  it("reports non-exhaustive search when the evaluation cap is hit", () => {
    const r = allocateSkills({ skills: [linear("a", 9), linear("b", 9)], points: 18, objective: (l) => l.a! + l.b!, maxEvaluations: 5 });
    expect(r.exhaustive).toBe(false);
    expect(r.evaluated).toBe(5);
  });
  it("handles zero points, zero skills and exact fits", () => {
    expect(allocateSkills({ skills: [linear("a", 3)], points: 0, objective: (l) => l.a! }).best!.levels.a).toBe(0);
    expect(allocateSkills({ skills: [], points: 5, objective: () => 7 }).best).toMatchObject({ score: 7, levels: {} });
    expect(allocateSkills({ skills: [linear("a", 3)], points: 3, objective: (l) => l.a! }).best!.spent).toBe(3);
  });
  it("rejects invalid input", () => {
    const s = [linear("a", 3)];
    expect(() => allocateSkills({ skills: s, points: -1, objective: () => 0 })).toThrow(PlannerInputError);
    expect(() => allocateSkills({ skills: s, points: 1.5, objective: () => 0 })).toThrow(PlannerInputError);
    expect(() => allocateSkills({ skills: s, points: 1, floor: { a: 2 }, objective: () => 0 })).toThrow(/cost more/);
    expect(() => allocateSkills({ skills: s, points: 5, floor: { zz: 1 }, objective: () => 0 })).toThrow(/Unknown skill/);
    expect(() => allocateSkills({ skills: [linear("a", 1), linear("a", 1)], points: 1, objective: () => 0 })).toThrow(/unique/);
    expect(() => allocateSkills({ skills: s, points: 1, objective: () => NaN })).toThrow(/non-finite/);
    expect(() => allocateSkills({ skills: [{ id: "d", maxLevel: 2, cumulativeCost: (l) => 5 - l }], points: 9, objective: () => 0 })).toThrow();
  });
});

const item = (id: string, slot: string, cost: number, score: number, owned = false): Item => ({ id, slot, cost: BigInt(cost), score, owned });

describe("selectEquipment", () => {
  const items = [
    item("w1", "weapon", 10_000, 10), item("w2", "weapon", 50_000, 30), item("w3", "weapon", 200_000, 35),
    item("a1", "armor", 20_000, 5), item("a2", "armor", 80_000, 20),
  ];
  it("maximum performance picks the best loadout within budget (exact)", () => {
    const r = selectEquipment({ items, budget: 130_000n });
    expect(r.exact).toBe(true);
    expect(r.maxPerformance).toMatchObject({ score: 50, cost: 130_000n });
    expect(r.maxPerformance!.picks.weapon!.id).toBe("w2");
    expect(r.maxPerformance!.picks.armor!.id).toBe("a2");
  });
  it("uses the whole budget only when it helps; ties resolve to lower cost", () => {
    const r = selectEquipment({ items: [item("x", "s", 5, 10), item("y", "s", 9, 10)] });
    expect(r.maxPerformance!.picks.s!.id).toBe("x");
  });
  it("never exceeds the budget, and an unaffordable slot is left empty", () => {
    const r = selectEquipment({ items, budget: 9_999n });
    expect(r.maxPerformance).toMatchObject({ score: 0, cost: 0n });
    expect(r.maxPerformance!.picks.weapon).toBeNull();
  });
  it("frontier is cost-ascending with strictly increasing score (no dominated entries)", () => {
    const f = selectEquipment({ items }).frontier;
    for (let i = 1; i < f.length; i++) {
      expect(f[i]!.cost).toBeGreaterThan(f[i - 1]!.cost);
      expect(f[i]!.score).toBeGreaterThan(f[i - 1]!.score);
    }
  });
  it("best value is not simply the cheapest item", () => {
    const r = selectEquipment({ items, minPerformanceShare: 0.8 });
    const max = r.maxPerformance!;
    expect(r.bestValue!.score).toBeGreaterThanOrEqual(max.score * 0.8);
    expect(r.bestValue!.cost).toBeLessThanOrEqual(max.cost);
    expect(r.bestValue!.cost).toBeGreaterThan(0n);
  });
  it("best value with share 0 and a free option prefers the highest-scoring free loadout", () => {
    const r = selectEquipment({ items: [item("own", "w", 999, 7, true), item("buy", "w", 10, 9)], minPerformanceShare: 0 });
    expect(r.bestValue!.picks.w!.id).toBe("own");
  });
  it("owned-only and owned-is-free modes", () => {
    const set = [item("own", "w", 100_000, 10, true), item("buy", "w", 1_000, 12)];
    expect(selectEquipment({ items: set, ownedOnly: true }).maxPerformance!.picks.w!.id).toBe("own");
    const free = selectEquipment({ items: set, budget: 0n });
    expect(free.maxPerformance!.picks.w!.id).toBe("own");
    expect(free.maxPerformance!.cost).toBe(0n);
    const paid = selectEquipment({ items: set, budget: 0n, ownedFree: false });
    expect(paid.maxPerformance!.score).toBe(0);
  });
  it("keeps money exact for values beyond float precision", () => {
    const big = 9_007_199_254_740_993n; // 2^53 + 1
    const r = selectEquipment({ items: [{ id: "g", slot: "s", cost: big, score: 1 }, { id: "h", slot: "t", cost: 1n, score: 1 }] });
    expect(r.maxPerformance!.cost).toBe(big + 1n);
  });
  it("flags inexact search when the frontier cap thins results", () => {
    const many = Array.from({ length: 60 }, (_, i) => item(`i${i}`, i % 2 ? "a" : "b", i + 1, i + 1));
    expect(selectEquipment({ items: many, maxFrontier: 3 }).exact).toBe(false);
  });
  it("handles empty input and rejects invalid items", () => {
    expect(selectEquipment({ items: [] }).maxPerformance).toMatchObject({ score: 0, cost: 0n });
    expect(() => selectEquipment({ items: [item("n", "s", -1, 1)] })).toThrow(PlannerInputError);
    expect(() => selectEquipment({ items: [{ id: "n", slot: "s", cost: 1n, score: NaN }] })).toThrow(PlannerInputError);
    expect(() => selectEquipment({ items, budget: -1n })).toThrow(PlannerInputError);
    expect(() => selectEquipment({ items, minPerformanceShare: 2 })).toThrow(PlannerInputError);
  });
  it("scorePerGold uses gold units and is null for free loadouts", () => {
    expect(scorePerGold({ picks: {}, cost: 20_000n, score: 10 })).toBe(5);
    expect(scorePerGold({ picks: {}, cost: 0n, score: 10 })).toBeNull();
  });
});
