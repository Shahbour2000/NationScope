import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseBattleDetail, pointsPercent, splitPercent } from "@/lib/domain/battle-detail";

const raw = JSON.parse(readFileSync("tests/fixtures/real/battle-detail.json", "utf8"));
const b = parseBattleDetail(raw, "https://app.example")!;

describe("parseBattleDetail (real response)", () => {
  it("parses sides, score, rules and totals", () => {
    expect(b).toMatchObject({ status: "active", attackerCountryId: "de", defenderCountryId: "uk", attackerRounds: 1, defenderRounds: 0, currentRound: 2, roundsToWin: 2, pointsToWinRound: 250, winner: null });
    expect(b.totals.attacker).toEqual({ damage: "227337", fighters: 10 });
    expect(b.totals.defender).toEqual({ damage: "0", fighters: 0 });
  });
  it("parses rounds in order with winners and exact damage", () => {
    expect(b.rounds.map((r) => [r.number, r.status, r.winner])).toEqual([[1, "finished", "attacker"], [2, "active", null]]);
    expect(b.rounds[0]!.attackerDamage).toBe("218260");
  });
  it("parses fighters and drops unsafe avatar paths", () => {
    expect(b.fighters.attacker[0]).toMatchObject({ name: "ETHEREAL", countryId: "eg", damage: "78315", hits: 71 });
    expect(b.fighters.attacker[0]!.avatar).toBe("https://app.example/media/67a8ea6163f55b2d6b9fa016.webp");
    expect(b.fighters.attacker[3]!.avatar).toBeNull();
    expect(b.fighters.defender).toEqual([]);
    expect(parseBattleDetail({ ...raw, leaderboards: { attacker: [{ userId: "u", username: "x", avatarUrl: "//evil/x.png" }] } }, "https://a")!.fighters.attacker[0]!.avatar).toBeNull();
  });
  it("rejects malformed bodies and tolerates missing optional blocks", () => {
    expect(parseBattleDetail({ nope: 1 }, "https://a")).toBeNull();
    const min = parseBattleDetail({ id: "btl_1", status: "finished", winner: "defender" }, "https://a")!;
    expect(min.rounds).toEqual([]);
    expect(min.winner).toBe("defender");
    expect(min.totals.attacker.damage).toBeNull();
  });
});

describe("calculations", () => {
  it("damage split is exact and null when there is nothing to compare", () => {
    expect(splitPercent("227337", "0")).toBe(100);
    expect(splitPercent("1", "3")).toBe(25);
    expect(splitPercent("0", "0")).toBeNull();
    expect(splitPercent(null, "5")).toBeNull();
  });
  it("points progress is clamped and null without a target", () => {
    expect(pointsPercent(30, 250)).toBe(12);
    expect(pointsPercent(252, 250)).toBe(100);
    expect(pointsPercent(10, null)).toBeNull();
    expect(pointsPercent(null, 250)).toBeNull();
  });
});
