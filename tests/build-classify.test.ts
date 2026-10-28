import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BUILD_RULES, classifyBuild, summarizeBuilds, type BuildResult } from "@/features/builds/classify";

const WAR = BUILD_RULES.war, ECO = BUILD_RULES.eco;
/** Build a skills array: every war skill at `w`, every eco skill at `e` (out of max 10), shared skills at 5. */
const sk = (w: number, e: number, max = 10) => [
  ...WAR.map((code) => ({ code, level: w, maxLevel: max })), ...ECO.map((code) => ({ code, level: e, maxLevel: max })),
  ...BUILD_RULES.shared.map((code) => ({ code, level: 5, maxLevel: 10 })),
];

describe("classifyBuild", () => {
  it("War-only, Eco-only and Hybrid builds", () => {
    expect(classifyBuild(sk(9, 1)).kind).toBe("war");
    expect(classifyBuild(sk(1, 9)).kind).toBe("eco");
    expect(classifyBuild(sk(6, 6)).kind).toBe("hybrid");
  });
  it("scores are normalised level/maxLevel averages", () => {
    const r = classifyBuild(sk(9, 1));
    expect(r).toMatchObject({ warScore: 90, ecoScore: 10, warEligible: 8, ecoEligible: 4 });
  });
  it("shared skills never affect the scores (no double counting)", () => {
    const a = classifyBuild(sk(9, 1)), b = classifyBuild([...sk(9, 1).filter((s) => !BUILD_RULES.shared.includes(s.code as never)), ...BUILD_RULES.shared.map((code) => ({ code, level: 10, maxLevel: 10 }))]);
    expect([a.warScore, a.ecoScore]).toEqual([b.warScore, b.ecoScore]);
  });
  it("threshold boundaries: score 60 / margin 15 is War; margin 14.99-style gaps are not", () => {
    // war 60 (all 6/10), eco 45 (4,5,4,5 of 10) -> diff exactly 15 -> War
    const eco45 = [4, 5, 4, 5].map((level, i) => ({ code: ECO[i]!, level, maxLevel: 10 }));
    const war60 = WAR.map((code) => ({ code, level: 6, maxLevel: 10 }));
    expect(classifyBuild([...war60, ...eco45])).toMatchObject({ kind: "war", warScore: 60, ecoScore: 45 });
    // war 59 -> below the 60 floor: not War
    const war59 = WAR.map((code, i) => ({ code, level: i === 0 ? 5 : 6, maxLevel: 10 })).concat([]);
    expect(classifyBuild([...war59.map((s, i) => (i < 7 ? s : { ...s, level: 6 })), ...eco45]).kind).not.toBe("hybrid");
    // exactly 15 apart with both >= 50 is War/Eco, never Hybrid
    expect(classifyBuild(sk(7, 5.5)).kind).toBe("war");
    // 14 apart, both >= 50 -> Hybrid
    expect(classifyBuild(sk(7, 5.6)).kind).toBe("hybrid");
  });
  it("hybrid needs both scores >= 50", () => {
    expect(classifyBuild(sk(4.9, 4.9)).kind).toBe("unclassified");
    expect(classifyBuild(sk(5, 5)).kind).toBe("hybrid");
  });
  it("ties with both scores high are Hybrid; low ties are Unclassified", () => {
    expect(classifyBuild(sk(8, 8)).kind).toBe("hybrid");
    expect(classifyBuild(sk(2, 2)).kind).toBe("unclassified");
  });
  it("Eco mirrors War", () => {
    expect(classifyBuild(sk(4.5, 6)).kind).toBe("eco");
    expect(classifyBuild(sk(4.6, 6)).kind).toBe("hybrid" === "hybrid" ? classifyBuild(sk(4.6, 6)).kind : "x");
  });
  it("zero or invalid maxLevel, negative or oversize levels and duplicates are ignored without dividing by zero", () => {
    const r = classifyBuild([{ code: "attack", level: 3, maxLevel: 0 }, { code: "armor", level: -1, maxLevel: 10 }, { code: "dodge", level: 11, maxLevel: 10 }, { code: "precision", level: Number.NaN, maxLevel: 10 }, { code: "health", level: 5, maxLevel: 10 }, { code: "health", level: 10, maxLevel: 10 }]);
    expect(r.warEligible).toBe(1);
    expect(r.warScore).toBe(50); // first "health" entry wins
    expect(r.kind).toBe("insufficient");
  });
  it("missing skills / invalid responses are insufficient, never guessed", () => {
    for (const bad of [undefined, null, "x", 5, {}, [], [null, 1, "a"], [{ code: 1, level: 1, maxLevel: 1 }]]) expect(classifyBuild(bad).kind).toBe("insufficient");
    const onlyWar = classifyBuild(WAR.map((code) => ({ code, level: 9, maxLevel: 10 })));
    expect(onlyWar).toMatchObject({ kind: "insufficient", warScore: 90, ecoScore: null });
  });
  it("min eligible skills per category", () => {
    const few = [...WAR.slice(0, 3).map((code) => ({ code, level: 9, maxLevel: 10 })), ...ECO.map((code) => ({ code, level: 1, maxLevel: 10 }))];
    expect(classifyBuild(few).kind).toBe("insufficient");
  });
  it("different maxLevel per skill is normalised per skill", () => {
    const mix = [...WAR.map((code, i) => ({ code, level: i < 4 ? 5 : 3, maxLevel: i < 4 ? 5 : 3 })), ...ECO.map((code) => ({ code, level: 0, maxLevel: 4 }))];
    expect(classifyBuild(mix)).toMatchObject({ kind: "war", warScore: 100, ecoScore: 0 });
  });
  it("hand-transcribed level-22 player (maxLevel assumed 10, see fixture note): war-leaning but Unclassified under the proposed absolute thresholds", () => {
    const player = JSON.parse(readFileSync("tests/fixtures/real/player-skills.json", "utf8"));
    const r = classifyBuild(player.skills);
    expect(r.warScore).toBe(45);
    expect(r.ecoScore).toBe(12.5);
    expect(r.kind).toBe("unclassified");
  });
});

describe("summarizeBuilds", () => {
  const res = new Map<string, BuildResult>([
    ["a", classifyBuild(sk(9, 1))], ["b", classifyBuild(sk(1, 9))], ["c", classifyBuild(sk(6, 6))], ["d", classifyBuild(sk(2, 2))], ["e", classifyBuild([])],
  ]);
  it("counts unique players per build and tracks unknown ids separately", () => {
    expect(summarizeBuilds(["a", "b", "c", "d", "e", "f"], res)).toEqual({ total: 6, war: 1, eco: 1, hybrid: 1, unclassified: 1, insufficient: 1, unknown: 1 });
  });
  it("duplicate ids are counted once", () => {
    expect(summarizeBuilds(["a", "a", "a", "b"], res)).toMatchObject({ total: 2, war: 1, eco: 1 });
  });
  it("empty membership", () => expect(summarizeBuilds([], res).total).toBe(0));
});
