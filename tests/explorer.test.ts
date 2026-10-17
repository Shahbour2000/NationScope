import { describe, expect, it } from "vitest";
import { SECTIONS, parseOffset } from "@/features/explorer/catalog";
import { pickColumns } from "@/features/explorer/columns";
import { linkFor, rowHref } from "@/features/explorer/links";
import { countItems, listOf, objectRows } from "@/features/explorer/shape";
import { isKnownPath } from "@/lib/api/endpoints";

describe("listOf / countItems", () => {
  it("recognises a top-level array and a single-array wrapper, and nothing else", () => {
    expect(countItems([1, 2, 3])).toBe(3);
    expect(listOf({ serverTime: "x", countries: [{}, {}] })).toMatchObject({ wrappedKey: "countries", rest: { serverTime: "x" } });
    expect(countItems({ countries: [{}, {}] })).toBe(2);
    expect(countItems({ a: [1], b: [2] })).toBeNull();
    expect(countItems({ a: 1 })).toBeNull();
    expect(countItems("x")).toBeNull();
    expect(countItems([])).toBe(0); // a genuine empty list is zero, not "unknown"
  });
  it("objectRows only accepts all-object lists", () => {
    expect(objectRows([{ a: 1 }, { b: 2 }])).toHaveLength(2);
    expect(objectRows([{ a: 1 }, 2])).toBeNull();
    expect(objectRows([])).toBeNull();
  });
});

describe("pickColumns", () => {
  it("uses scalar fields only, name/title/id first, capped", () => {
    const rows = [{ z: 1, id: "a", nested: { x: 1 }, name: "N", list: [1] }, { y: 2, extra: null }];
    expect(pickColumns(rows)).toEqual(["name", "id", "z", "y", "extra"]);
    const wide = [Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`k${i}`, i]))];
    expect(pickColumns(wide, 5)).toHaveLength(5);
    expect(pickColumns([{ a: { b: 1 } }])).toEqual([]);
  });
});

describe("linkFor / rowHref", () => {
  it("links observed ID prefixes and inferred key names, and rejects unsafe values", () => {
    expect(linkFor("ownerId", "usr_w6np9esu52k84j3j")).toBe("/players/usr_w6np9esu52k84j3j");
    expect(linkFor("anything", "mu_xk3dx9x6bhf6s47c")).toBe("/units/mu_xk3dx9x6bhf6s47c");
    expect(linkFor("attackerCountryId", "uk")).toBe("/countries/uk");
    expect(linkFor("name", "uk")).toBeNull();
    expect(linkFor("countryId", "../x")).toBeNull();
    expect(linkFor("countryId", 5)).toBeNull();
    expect(rowHref("alliances", { id: "al_1" })).toBe("/alliances/al_1");
    expect(rowHref("alliances", { id: "a/b" })).toBeNull();
    expect(rowHref("alliances", {})).toBeNull();
  });
});

describe("catalog", () => {
  it("every registered endpoint is a path from the published spec", () => {
    const p = { limit: 10, offset: 0 };
    for (const s of Object.values(SECTIONS)) {
      const eps = [s.list?.(p), s.detail?.("abc"), ...(s.subs ?? []).map((x) => x.endpoint("abc", p))].filter(Boolean);
      for (const e of eps) expect(isKnownPath(e!.path)).toBe(true);
    }
  });
  it("paged sections respect documented limits and parseOffset clamps input", () => {
    expect(() => SECTIONS.equipment!.list!({ limit: 24, offset: 0 })).not.toThrow();
    expect(parseOffset("20")).toBe(20);
    for (const bad of [undefined, "-1", "1.5", "99999", "abc"]) expect(parseOffset(bad)).toBe(0);
  });
});

import { sortRows } from "@/features/explorer/sort";

describe("sortRows", () => {
  it("sorts numerically, compares digit strings as BigInt, keeps nulls last both ways", () => {
    const rows = [{ v: "9" }, { v: "10" }, { v: null }, { v: "99999999999999999999" }];
    expect(sortRows(rows, "v", "asc").map((r) => r.v)).toEqual(["9", "10", "99999999999999999999", null]);
    expect(sortRows(rows, "v", "desc").map((r) => r.v)).toEqual(["99999999999999999999", "10", "9", null]);
    expect(sortRows([{ v: 2 }, { v: 10 }, { v: 1 }], "v", "asc").map((r) => r.v)).toEqual([1, 2, 10]);
    expect(sortRows([{ v: "b" }, { v: "a" }], "v", "asc").map((r) => r.v)).toEqual(["a", "b"]);
  });
});
