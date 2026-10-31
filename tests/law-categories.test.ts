import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { categoryOf, groupLaws } from "@/features/laws/categories";

const laws = (JSON.parse(readFileSync("tests/fixtures/real/laws-catalog.json", "utf8")) as { laws: { code: string; scope: string }[] }).laws;
describe("law categories", () => {
  it("puts the war laws together and every law in exactly one group", () => {
    expect(categoryOf({ code: "declare_war", scope: "country" })).toBe("war");
    const groups = groupLaws(laws);
    expect(groups.flatMap((g) => g.laws)).toHaveLength(laws.length);
    expect(groups[0]!.category).toBe("war");
  });
  it("keeps unknown future laws visible", () => {
    expect(categoryOf({ code: "brand_new_law", scope: "country" })).toBe("other");
    expect(categoryOf({ code: "alliance_new", scope: "alliance" })).toBe("admin");
  });
  it("classifies every currently known law outside 'other'", () => {
    expect(laws.filter((l) => categoryOf(l) === "other")).toEqual([]);
  });
});
