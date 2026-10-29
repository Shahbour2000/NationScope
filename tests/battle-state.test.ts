import { describe, expect, it } from "vitest";
import { isBattleOngoing, isWarOngoing, newestFirst, ongoingBattles } from "@/features/wars/state";

const live = { status: "active", endedAt: null, winner: null, round: { status: "active" } } as const;

describe("isBattleOngoing", () => {
  it("accepts a genuinely running battle, including rows without a round block", () => {
    expect(isBattleOngoing(live)).toBe(true);
    expect(isBattleOngoing({ status: "active" })).toBe(true);
  });
  it("rejects finished battles however the API shows it", () => {
    expect(isBattleOngoing({ ...live, status: "finished" })).toBe(false);
    expect(isBattleOngoing({ ...live, endedAt: "2026-10-21T08:00:00Z" })).toBe(false);
    expect(isBattleOngoing({ ...live, winner: "attacker" })).toBe(false);
    expect(isBattleOngoing({ ...live, round: { status: "finished" } })).toBe(false);
  });
  it("never treats unknown / missing status as active", () => {
    expect(isBattleOngoing({ status: "" })).toBe(false);
    expect(isBattleOngoing({ status: "pending" })).toBe(false);
    expect(isBattleOngoing({ status: "ACTIVE" })).toBe(false);
  });
});

describe("isWarOngoing / ongoingBattles / newestFirst", () => {
  it("wars need status active and no end timestamp", () => {
    expect(isWarOngoing({ status: "active", endedAt: null })).toBe(true);
    expect(isWarOngoing({ status: "active", endedAt: "2026-10-01T00:00:00Z" })).toBe(false);
    expect(isWarOngoing({ status: "ended", endedAt: null })).toBe(false);
  });
  it("filters a mixed list and sorts newest first (undated last)", () => {
    const rows = [{ id: "a", ...live, startedAt: "2026-10-01" }, { id: "b", status: "finished", startedAt: "2026-10-09" }, { id: "c", ...live, startedAt: "2026-10-05" }, { id: "d", ...live }];
    expect(newestFirst(ongoingBattles(rows)).map((x) => x.id)).toEqual(["c", "a", "d"]);
  });
});
