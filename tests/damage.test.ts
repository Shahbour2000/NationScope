import { describe, expect, it } from "vitest";
import { DAMAGE_STAGES, runDamagePipeline, unverifiedStage, type Stage, type StageId } from "@/features/planner/damage";
import { PlannerInputError } from "@/features/planner/skills";

// SYNTHETIC stages (pure arithmetic placeholders). They are NOT Age of Nations formulas.
type S = { value: number };
const add = (id: StageId, n: number): Stage<S, null> => ({ id, run: (s) => ({ status: "verified", state: { value: s.value + n }, source: `test:${id}` }) });
const verifiedAll = (): Stage<S, null>[] => DAMAGE_STAGES.map((id, i) => add(id, i + 1));

describe("runDamagePipeline", () => {
  it("runs the stages in the developer-confirmed order and reports exact only when all are verified", () => {
    const order: StageId[] = [];
    const stages = DAMAGE_STAGES.map((id): Stage<S, null> => ({ id, run: (s) => { order.push(id); return { status: "verified", state: s, source: "t" }; } }));
    const r = runDamagePipeline(stages, { value: 0 }, null);
    expect(r.status).toBe("exact");
    expect(order).toEqual([...DAMAGE_STAGES]);
  });
  it("threads state through stages and records each source", () => {
    const r = runDamagePipeline(verifiedAll(), { value: 0 }, null);
    expect(r).toMatchObject({ status: "exact", state: { value: 28 } });
    if (r.status === "exact") expect(r.sources.critical).toBe("test:critical");
  });
  it("never reports exact when a stage is unverified; it names the blocker and what was not evaluated", () => {
    const stages = verifiedAll();
    stages[3] = unverifiedStage("critical", ["critical chance formula", "critical multiplier"]);
    const r = runDamagePipeline(stages, { value: 0 }, null);
    expect(r.status).toBe("incomplete");
    if (r.status === "incomplete") {
      expect(r.blocked).toEqual({ stage: "critical", missing: ["critical chance formula", "critical multiplier"] });
      expect(r.verifiedStages).toEqual(["attack", "personalBoosts", "precisionGraze"]);
      expect(r.notEvaluated).toEqual(["luckSpread", "battleBonuses", "bonusCaps"]);
      expect(r.partial).toEqual({ value: 6 });
    }
  });
  it("rejects missing, extra, duplicated or reordered stages", () => {
    const ok = verifiedAll();
    expect(() => runDamagePipeline(ok.slice(1), { value: 0 }, null)).toThrow(PlannerInputError);
    expect(() => runDamagePipeline([...ok, ok[0]!], { value: 0 }, null)).toThrow(PlannerInputError);
    const swapped = [...ok];
    [swapped[0], swapped[1]] = [swapped[1]!, swapped[0]!];
    expect(() => runDamagePipeline(swapped, { value: 0 }, null)).toThrow(/in order/);
  });
});
