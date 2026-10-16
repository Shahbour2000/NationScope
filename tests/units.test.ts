import { describe, expect, it } from "vitest";
import sample from "./fixtures/main/units.sample.json";
import { filterUnits, sortUnits, summarize } from "@/features/units/logic";
import { parseUnits } from "@/lib/domain/units";

const ORIGIN = "https://app.ageofnations.world";

describe("parseUnits (real Main sample)", () => {
  const { units, skipped } = parseUnits(sample, ORIGIN);
  it("parses every observed row", () => {
    expect(skipped).toBe(0);
    expect(units).toHaveLength(3);
    expect(units[0]).toMatchObject({ id: "mu_xk3dx9x6bhf6s47c", members: 5, capacity: 5, damage: "1912959" });
  });
  it("builds media URLs only for /media/ paths and keeps null logos null", () => {
    expect(units[0]!.logoSrc).toBe(`${ORIGIN}/media/11e4a37efca14ff251af24f9.webp`);
    expect(units[1]!.logoSrc).toBeNull();
    const evil = parseUnits([{ id: "a", name: "x", logoUrl: "//evil.test/x.png" }, { id: "b", name: "y", logoUrl: "/media/../../x" }], ORIGIN);
    expect(evil.units.map((u) => u.logoSrc)).toEqual([null, null]);
  });
  it("skips malformed rows instead of failing the list, and tolerates missing optional fields", () => {
    const r = parseUnits([{ id: "a", name: "ok" }, { name: "no id" }, { id: "c", name: "bad", damage: "12.5" }, 7, null], ORIGIN);
    expect(r.units.map((u) => u.id)).toEqual(["a"]);
    expect(r.skipped).toBe(4);
  });
});

describe("units table logic", () => {
  const { units } = parseUnits(sample, ORIGIN);
  it("filters by text, policy and country", () => {
    expect(filterUnits(units, { query: "arctic", policy: "all", country: "all" })).toHaveLength(1);
    expect(filterUnits(units, { query: "yurin", policy: "open", country: "all" })).toHaveLength(1);
    expect(filterUnits(units, { query: "", policy: "all", country: "uk" })).toHaveLength(1);
    expect(filterUnits(units, { query: "zzz", policy: "all", country: "all" })).toHaveLength(0);
  });
  it("sorts damage numerically (BigInt), not lexically, with nulls last in both directions", () => {
    const rows = [...units, { ...units[0]!, id: "n", damage: null }, { ...units[0]!, id: "big", damage: "99999999999999999999" }];
    expect(sortUnits(rows, "damage", "desc").map((r) => r.id)).toEqual(["big", "mu_xk3dx9x6bhf6s47c", "mu_kubd9zbrp49fyzd6", "mu_ak16bbmx4tfsw5te", "n"]);
    expect(sortUnits(rows, "damage", "asc").at(-1)!.id).toBe("n");
  });
  it("sums damage exactly", () => {
    expect(summarize(units)).toEqual({ count: 3, members: 10, damage: 2097963n });
  });
});
