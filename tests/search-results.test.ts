import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { hrefFor, parseSearch } from "@/features/search/results";

describe("parseSearch", () => {
  it("reads the recorded player result", () => {
    const r = parseSearch(JSON.parse(readFileSync("tests/fixtures/real/search.json", "utf8")));
    expect(r.total).toBe(1);
    expect(r.groups).toHaveLength(1);
    expect(r.groups[0]).toMatchObject({ key: "players", hits: [{ id: "usr_r9s8exrd8arivqrq", label: "AbuDujana", countryId: "eg", level: 20 }] });
  });
  it("keeps rows with a label from name/title and drops rows without id or text", () => {
    const r = parseSearch({ units: [{ id: "u1", name: "Wolves" }, { name: "no id" }, { id: "u2" }], articles: [{ id: "a1", title: "Hello" }] });
    expect(r.groups.map((g) => g.key)).toEqual(["units", "articles"]);
    expect(r.total).toBe(2);
  });
  it("handles garbage", () => {
    expect(parseSearch(null)).toEqual({ total: 0, groups: [] });
    expect(parseSearch({ players: "x" }).total).toBe(0);
  });
  it("builds safe detail links", () => {
    expect(hrefFor("alliances", "a b")).toBe("/alliances/a%20b");
  });
});
