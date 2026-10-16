import { describe, expect, it } from "vitest";
import { assessFormula, controlledPairs, marginalEffect, rankFormulas, type CandidateFormula, type Observation } from "@/features/planner/evidence";

// SYNTHETIC. These are invented models used only to test the evidence gate, not Age of Nations rules.
const truth = (i: Readonly<Record<string, number>>) => Math.round(10 * (1 + 0.1 * i.lvl!) * (1 + i.gear! / 100));
const grid: Observation[] = [];
for (const lvl of [1, 2, 3, 4, 5]) for (const gear of [0, 10, 20, 30]) grid.push({ inputs: { lvl, gear }, observed: truth({ lvl, gear }) });

const correct: CandidateFormula = { id: "correct", description: "model A", predict: truth };
const wrong: CandidateFormula = { id: "wrong", description: "ignores gear", predict: (i) => Math.round(10 * (1 + 0.1 * i.lvl!)) };
const near: CandidateFormula = { id: "near", description: "slightly off", predict: (i) => truth(i) * 1.02 };

describe("assessFormula", () => {
  it("verifies a formula only when it reproduces every varied observation", () => {
    const a = assessFormula(correct, grid, { minSamples: 20 });
    expect(a).toMatchObject({ confidence: "verified", matches: 20, samples: 20 });
  });
  it("does not verify a plausible formula with too few samples", () => {
    const a = assessFormula(correct, grid.slice(0, 6), { minSamples: 20 });
    expect(a.confidence).not.toBe("verified");
    expect(a.reasons.join(" ")).toMatch(/Only 6 samples/);
  });
  it("does not verify when an input was never varied (uncontrolled sample)", () => {
    const flat = grid.filter((x) => x.inputs.gear === 0);
    const a = assessFormula(correct, flat, { minSamples: 5 });
    expect(a.confidence).not.toBe("verified");
    expect(a.reasons.join(" ")).toMatch(/gear/);
  });
  it("rejects a formula that misses observations", () => {
    const a = assessFormula(wrong, grid, { minSamples: 20 });
    expect(a.confidence).not.toBe("verified");
    expect(a.matches).toBeLessThan(a.samples);
  });
  it("labels a close but inexact formula as an estimate, never verified", () => {
    const a = assessFormula(near, grid, { minSamples: 20, tolerance: 0 });
    expect(a.confidence).toBe("estimate");
  });
  it("treats empty or tiny samples as unsupported and handles non-finite predictions", () => {
    expect(assessFormula(correct, []).confidence).toBe("unsupported");
    expect(assessFormula(correct, grid.slice(0, 2)).confidence).toBe("unsupported");
    const bad: CandidateFormula = { id: "nan", description: "", predict: () => NaN };
    expect(assessFormula(bad, grid, { minSamples: 20 }).confidence).not.toBe("verified");
  });
});

describe("rankFormulas", () => {
  it("puts the verified formula first", () => {
    const r = rankFormulas([wrong, near, correct], grid, { minSamples: 20 });
    expect(r.map((x) => x.id)[0]).toBe("correct");
    expect(r[0]!.confidence).toBe("verified");
  });
});

describe("controlled comparisons", () => {
  it("pairs observations that differ only in the isolated input", () => {
    const pairs = controlledPairs(grid, "lvl");
    expect(pairs.length).toBe(16); // 4 gear values x 4 adjacent level steps
    for (const p of pairs) {
      expect(p.from.inputs.gear).toBe(p.to.inputs.gear);
      expect(p.deltaInput).toBe(1);
    }
  });
  it("detects a constant (linear) marginal effect, and a non-constant one", () => {
    const lin: Observation[] = [1, 2, 3, 4].map((x) => ({ inputs: { x, k: 0 }, observed: 5 * x }));
    expect(marginalEffect(lin, "x")).toMatchObject({ constant: true, perUnit: [5, 5, 5] });
    const quad: Observation[] = [1, 2, 3, 4].map((x) => ({ inputs: { x, k: 0 }, observed: x * x }));
    expect(marginalEffect(quad, "x").constant).toBe(false);
    expect(marginalEffect([], "x")).toEqual({ pairs: 0, perUnit: [], constant: false });
  });
});
