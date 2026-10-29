import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BUILD_RULES, classifyBuild, summarizeBuilds, type BuildResult } from "@/features/builds/classify";
import { groupSkills } from "@/features/builds/skills";

const WAR = BUILD_RULES.war, ECO = BUILD_RULES.eco;
const lv = (codes: readonly string[], level: number, max = 10) => codes.map((code) => ({ code, level, maxLevel: max }));
/** Every war skill at `w`, every eco skill at `e` (max 10), neutral skills at 5. */
const sk = (w: number, e: number, max = 10) => [...lv(WAR, w, max), ...lv(ECO, e, max), ...lv(BUILD_RULES.shared, 5)];

describe("classifyBuild - percentage share of relevant investment", () => {
  it("War / Eco / Hybrid by dominance", () => {
    expect(classifyBuild(sk(9, 1)).kind).toBe("war");
    expect(classifyBuild(sk(1, 9)).kind).toBe("eco");
    expect(classifyBuild(sk(6, 6)).kind).toBe("hybrid");
  });
  it("shares add up to 100 and describe the capacity-normalised investment", () => {
    const r = classifyBuild(sk(9, 1));
    expect(r.warFill).toBe(90); expect(r.ecoFill).toBe(10);
    expect(r.warShare).toBe(90); expect(r.ecoShare).toBe(10);
    const h = classifyBuild(sk(4, 2));
    expect(h.warShare! + h.ecoShare!).toBeCloseTo(100, 5);
    expect(h.warShare).toBe(66.67);
  });
  it("has exactly three kinds: no result is ever 'unclassified'", () => {
    for (const [w, e] of [[0, 1], [1, 0], [5, 5], [3, 4], [10, 10], [2, 7], [7, 2]] as const) expect(["war", "eco", "hybrid"]).toContain(classifyBuild(sk(w, e)).kind);
  });
  it("a fully maxed player is an exact 50/50 Hybrid (category sizes do not bias the result)", () => {
    const r = classifyBuild(sk(10, 10));
    expect(r).toMatchObject({ kind: "hybrid", warShare: 50, ecoShare: 50 });
  });
  it("threshold boundary: exactly 70% is War / Eco (inclusive), just under is Hybrid", () => {
    // war fill 70% vs eco fill 30% -> share exactly 70
    expect(classifyBuild(sk(7, 3))).toMatchObject({ kind: "war", warShare: 70 });
    expect(classifyBuild(sk(3, 7))).toMatchObject({ kind: "eco", ecoShare: 70 });
    // war 7 vs eco 3.01 -> share just under 70
    const under = classifyBuild([...lv(WAR, 7), ...lv(ECO, 3.01)]);
    expect(under.kind).toBe("hybrid");
    expect(under.warShare).toBeLessThan(70);
    // just over
    expect(classifyBuild([...lv(WAR, 7), ...lv(ECO, 2.99)]).kind).toBe("war");
  });
  it("a rounded display value of 70.00 cannot flip a below-threshold player to War", () => {
    // share = 69.998...% (rounds to 70 for display) but is below the threshold
    const r = classifyBuild([...lv(WAR, 7, 10000), ...lv(ECO, 3.0003, 10000)]);
    expect(r.warShare).toBe(70);
    expect(r.kind).toBe("hybrid");
  });
  it("neutral skills never influence the result", () => {
    const a = classifyBuild(sk(9, 1));
    const b = classifyBuild([...lv(WAR, 9), ...lv(ECO, 1), ...lv(BUILD_RULES.shared, 10)]);
    expect(b).toEqual(a);
  });
  it("works for low-level and high-level players alike (scale-free)", () => {
    expect(classifyBuild(sk(1, 0)).kind).toBe("war"); // very low level
    expect(classifyBuild(sk(0, 1)).kind).toBe("eco");
    expect(classifyBuild(sk(9, 3)).kind).toBe("war"); // high level, 75% war share
    expect(classifyBuild(sk(9, 7)).kind).toBe("hybrid");
    // a high-level eco player: eco capacity is 40, so a raw-point share could never reach 70%; the capacity-normalised share can
    expect(classifyBuild(sk(3, 9)).kind).toBe("eco");
  });
  it("unusual skill maximums are weighted by their own capacity", () => {
    const mix = [...WAR.map((code, i) => ({ code, level: i < 4 ? 5 : 3, maxLevel: i < 4 ? 5 : 3 })), ...ECO.map((code) => ({ code, level: 0, maxLevel: 4 }))];
    expect(classifyBuild(mix)).toMatchObject({ kind: "war", warFill: 100, ecoFill: 0, warShare: 100, ecoShare: 0 });
    const odd = [...lv(WAR, 20, 40), ...lv(ECO, 1, 2)]; // both 50% filled with very different maxima -> 50/50
    expect(classifyBuild(odd)).toMatchObject({ kind: "hybrid", warShare: 50 });
  });
});

describe("classifyBuild - missing / unusable data is a data state, not a category", () => {
  it("no invested points -> no kind, availability no_investment", () => {
    const r = classifyBuild(sk(0, 0));
    expect(r).toMatchObject({ kind: null, availability: "no_investment", warShare: null, ecoShare: null });
  });
  it("ignores invalid entries and never divides by zero", () => {
    const r = classifyBuild([{ code: "attack", level: 3, maxLevel: 0 }, { code: "armor", level: -1, maxLevel: 10 }, { code: "dodge", level: 11, maxLevel: 10 }, { code: "precision", level: Number.NaN, maxLevel: 10 }, { code: "health", level: 5, maxLevel: 10 }, { code: "health", level: 10, maxLevel: 10 }]);
    expect(r.warEligible).toBe(1);
    expect(r.warLevels).toBe(5); // first entry per code wins
    expect(r).toMatchObject({ kind: null, availability: "incomplete" });
  });
  it("missing skills / invalid responses are incomplete, never guessed", () => {
    for (const bad of [undefined, null, "x", 5, {}, [], [null, 1, "a"], [{ code: 1, level: 1, maxLevel: 1 }]]) expect(classifyBuild(bad)).toMatchObject({ kind: null, availability: "incomplete" });
    const onlyWar = classifyBuild(lv(WAR, 9));
    expect(onlyWar).toMatchObject({ kind: null, availability: "incomplete", warFill: 90, ecoFill: null, warShare: null });
  });
  it("needs at least half of each category's skills", () => {
    const few = [...lv(WAR.slice(0, 3), 9), ...lv(ECO, 1)];
    expect(classifyBuild(few).kind).toBeNull();
    expect(classifyBuild([...lv(WAR.slice(0, 4), 9), ...lv(ECO.slice(0, 2), 1)]).kind).toBe("war");
  });
  it("hand-transcribed level-22 player (maxLevel assumed 10, see fixture note): war-leaning -> War at 70%", () => {
    const player = JSON.parse(readFileSync("tests/fixtures/real/player-skills.json", "utf8"));
    const r = classifyBuild(player.skills);
    expect(r.warFill).toBe(45);
    expect(r.ecoFill).toBe(12.5);
    expect(r.warShare).toBe(78.26);
    expect(r.kind).toBe("war");
  });
});

describe("summarizeBuilds - classified / pending / unavailable", () => {
  const res = new Map<string, BuildResult | null>([
    ["a", classifyBuild(sk(9, 1))], ["b", classifyBuild(sk(1, 9))], ["c", classifyBuild(sk(6, 6))], ["d", classifyBuild(sk(0, 0))], ["e", classifyBuild([])], ["f", null],
  ]);
  it("counts classified, unavailable (failed, no investment, incomplete) and pending (absent) separately", () => {
    expect(summarizeBuilds(["a", "b", "c", "d", "e", "f", "g"], res)).toEqual({ total: 7, war: 1, eco: 1, hybrid: 1, classified: 3, pending: 1, unavailable: 3 });
  });
  it("counts unique players only", () => expect(summarizeBuilds(["a", "a", "a", "b"], res)).toMatchObject({ total: 2, war: 1, eco: 1 }));
  it("empty membership", () => expect(summarizeBuilds([], res)).toMatchObject({ total: 0, classified: 0 }));
  it("total always equals classified + pending + unavailable", () => {
    const c = summarizeBuilds(["a", "b", "c", "d", "e", "f", "g", "h"], res);
    expect(c.total).toBe(c.classified + c.pending + c.unavailable);
    expect(c.classified).toBe(c.war + c.eco + c.hybrid);
  });
});

describe("groupSkills", () => {
  it("groups by combat / economy / neutral, sorted by fill, skipping invalid entries and duplicates", () => {
    const g = groupSkills([...sk(5, 2), { code: "attack", level: 99, maxLevel: 10 }, { code: "mystery", level: 1, maxLevel: 5 }, { code: "bad", level: 1, maxLevel: 0 }]);
    expect(g.map((x) => x.key)).toEqual(["war", "eco", "shared", "other"]);
    expect(g[0]!.levels).toBe(40); expect(g[0]!.capacity).toBe(80);
    expect(g[3]!.skills.map((s) => s.code)).toEqual(["mystery"]);
  });
  it("omits empty groups", () => expect(groupSkills(lv(ECO, 1)).map((x) => x.key)).toEqual(["eco"]));
});

describe("no 'Unclassified' build category remains", () => {
  it("is absent from the classifier source, messages and styles", () => {
    for (const f of ["src/features/builds/classify.ts", "src/i18n/messages.ts", "src/app/globals.css", "src/features/builds/BuildViews.tsx"]) {
      expect(readFileSync(f, "utf8").toLowerCase()).not.toMatch(/unclassified|غير مصنّف/);
    }
  });
});
