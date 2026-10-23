import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { barPercent, maxWeekly, sortMembers, summarizeMembers } from "@/features/units/profile";
import { parseUnitDetail } from "@/lib/domain/unit-detail";

const raw = JSON.parse(readFileSync("tests/fixtures/real/unit-detail.json", "utf8"));
const unit = parseUnitDetail(raw, "https://app.example")!;

describe("parseUnitDetail (real response)", () => {
  it("parses identity, upgrades and stats", () => {
    expect(unit.name).toBe("Arthur Reign");
    expect(unit.countryId).toBe("uk");
    expect(unit.capacity).toBe(10);
    expect(unit.hq).toEqual({ level: 1, max: 4, attackBonus: 5, nextAttackBonus: 10 });
    expect(unit.dorm).toEqual({ level: 2, max: 5, capacity: 10, nextCapacity: 15 });
    expect(unit.stats).toEqual({ totalDamage: "6435341", weeklyDamage: "2027018", tournamentWins: 0 });
    expect(unit.logoSrc).toBe("https://app.example/media/11e4a37efca14ff251af24f9.webp");
  });
  it("parses all 8 members with exact damage strings and no skipped rows", () => {
    expect(unit.members).toHaveLength(8);
    expect(unit.skippedMembers).toBe(0);
    expect(unit.members[1]).toMatchObject({ name: "Kiral", role: "commander", level: 23, countryId: "uk", totalDamage: "3690362", weeklyDamage: "914168", online: true });
  });
  it("parses tournaments relative to this unit", () => {
    expect(unit.tournaments).toHaveLength(1);
    expect(unit.tournaments[0]).toMatchObject({ won: false, runnerUp: false, result: "eliminated" });
  });
  it("rejects unsafe media paths and malformed responses", () => {
    expect(parseUnitDetail({ ...raw, logoUrl: "/media/../x.png" }, "https://a")!.logoSrc).toBeNull();
    expect(parseUnitDetail({ ...raw, logoUrl: "https://evil.test/x.png" }, "https://a")!.logoSrc).toBeNull();
    expect(parseUnitDetail({ nope: 1 }, "https://a")).toBeNull();
    const bad = parseUnitDetail({ ...raw, members: [...raw.members, { nope: true }, { userId: "u", totalDamage: "12.5" }] }, "https://a")!;
    expect(bad.members).toHaveLength(8);
    expect(bad.skippedMembers).toBe(2);
  });
  it("still works when optional blocks are missing", () => {
    const min = parseUnitDetail({ id: "mu_1", name: "Min" }, "https://a")!;
    expect(min.members).toEqual([]);
    expect(min.stats).toBeNull();
    expect(min.hq.level).toBeNull();
  });
});

describe("summarizeMembers", () => {
  const s = summarizeMembers(unit.members);
  it("counts members, roles, presence and countries", () => {
    expect(s.count).toBe(8);
    expect(s.online).toBe(1);
    expect(s.onlineKnown).toBe(8);
    expect(s.roles).toEqual({ owner: 1, commander: 1, member: 6 });
    expect(s.byCountry).toEqual([{ countryId: "uk", count: 3 }, { countryId: "rs", count: 2 }, { countryId: "fr", count: 1 }, { countryId: "kp", count: 1 }, { countryId: "ma", count: 1 }]);
  });
  it("sums exactly with BigInt and does not equal the unit's reported totals (documented)", () => {
    expect(s.combinedLifetime).toBe(7442863n);
    expect(s.combinedWeekly).toBe(2245787n);
    expect(s.combinedLifetime).not.toBe(BigInt(unit.stats!.totalDamage!));
    expect(s.combinedWeekly).not.toBe(BigInt(unit.stats!.weeklyDamage!));
  });
  it("average level", () => expect(s.averageLevel).toBe(17.5));
  it("empty list is safe", () => {
    const e = summarizeMembers([]);
    expect(e).toMatchObject({ count: 0, online: 0, averageLevel: null, combinedWeekly: 0n });
  });
});

describe("sortMembers and bars", () => {
  it("sorts by weekly damage descending without mutating the input", () => {
    const before = unit.members.map((m) => m.id);
    const out = sortMembers(unit.members, "weekly", -1);
    expect(out[0]!.name).toBe("Kiral");
    expect(out.at(-1)!.name).toBe("Zoki");
    expect(unit.members.map((m) => m.id)).toEqual(before);
  });
  it("sorts roles owner -> commander -> member and compares large numbers numerically", () => {
    expect(sortMembers(unit.members, "role", 1).slice(0, 2).map((m) => m.role)).toEqual(["owner", "commander"]);
    expect(sortMembers(unit.members, "lifetime", -1)[0]!.name).toBe("Kiral");
  });
  it("missing damage is not treated as zero", () => {
    const a = { ...unit.members[0]!, weeklyDamage: null, name: "A" };
    const b = { ...unit.members[1]!, weeklyDamage: "0", name: "B" };
    expect(sortMembers([b, a], "weekly", 1).map((m) => m.name)).toEqual(["A", "B"]);
    expect(barPercent(null, 100n)).toBeNull();
    expect(barPercent("0", 100n)).toBe(0);
  });
  it("bar percent relative to the largest value", () => {
    const max = maxWeekly(unit.members);
    expect(max).toBe(914168n);
    expect(barPercent("914168", max)).toBe(100);
    expect(barPercent("457084", max)).toBe(50);
    expect(barPercent("1", 0n)).toBeNull();
  });
});
