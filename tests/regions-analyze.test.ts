import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { summarize } from "@/features/regions/analyze";

const fx = JSON.parse(readFileSync("tests/fixtures/real/regions.json", "utf8")) as { regions: Parameters<typeof summarize>[0]; battles: Parameters<typeof summarize>[1] };
describe("summarize regions", () => {
  const now = Date.parse("2026-10-17T12:49:00Z");
  const s = summarize(fx.regions, fx.battles, now);
  it("counts occupied regions as owner != core owner", () => {
    expect(s.occupied.every((r) => r.countryId !== r.coreCountryId)).toBe(true);
    expect(s.occupied.length).toBe(fx.regions.filter((r) => r.countryId !== r.coreCountryId).length);
  });
  it("lists only unexpired deposits, strongest first", () => {
    expect(s.deposits.length).toBeGreaterThan(0);
    for (let i = 1; i < s.deposits.length; i++) expect(s.deposits[i - 1]!.deposit!.bonusPercent!).toBeGreaterThanOrEqual(s.deposits[i]!.deposit!.bonusPercent!);
    expect(summarize(fx.regions, [], Date.parse("2030-01-01T00:00:00Z")).deposits).toHaveLength(0);
  });
  it("control counts add up to the number of owned regions", () => {
    expect(s.byCountry.reduce((n, [, c]) => n + c, 0)).toBe(fx.regions.filter((r) => r.countryId).length);
    expect(s.underAttack).toBe(new Set(fx.battles.map((b) => b.regionId)).size);
  });
});
