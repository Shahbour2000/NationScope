import { beforeEach, describe, expect, it, vi } from "vitest";

const world = vi.hoisted(() => ({
  getCitizens: vi.fn(), getAlliances: vi.fn(), getCountries: vi.fn(), getPartyDetail: vi.fn(), getWars: vi.fn(),
}));
const units = vi.hoisted(() => ({ getUnitDetail: vi.fn() }));
vi.mock("@/lib/data/world", () => world);
vi.mock("@/lib/data/units", () => units);
vi.mock("@/features/economy/analytics", () => ({ allianceAggregate: (a: { memberIds: string[] }) => ({ members: a.memberIds.map((id) => ({ id })), unresolved: [], activeCitizens: 7 }) }));

import { getCountryCitizenIds, getMixMembers, entityHref, mixHref } from "@/features/builds/members";

const page = (ids: string[], inactive: string[] = [], hasMore = false, total: number | null = null) => ({ rows: ids.map((id) => ({ id, active: !inactive.includes(id) })), hasMore, total });

beforeEach(() => { Object.values(world).forEach((f) => f.mockReset()); units.getUnitDetail.mockReset(); });

describe("country members", () => {
  it("pages 100 at a time, keeps only ACTIVE citizens and is complete when the API has no more", async () => {
    world.getCitizens.mockResolvedValueOnce(page(Array.from({ length: 100 }, (_, i) => `p${i}`), ["p0"], true, 130)).mockResolvedValueOnce(page(["q1", "q2"], [], false, 130));
    const r = await getCountryCitizenIds("eg", 5);
    expect(world.getCitizens).toHaveBeenCalledTimes(2);
    expect(world.getCitizens.mock.calls[1]![1]).toEqual({ offset: 100, limit: 100 });
    expect(r.ids).toHaveLength(99 + 2);
    expect(r.ids).not.toContain("p0");
    expect(r.truncated).toBe(false);
    expect(r.total).toBe(130);
  });
  it("flags truncation when the page cap is reached and the API still reports more", async () => {
    world.getCitizens.mockImplementation(async (_c: string, o: { offset: number }) => page(Array.from({ length: 100 }, (_, i) => `p${o.offset + i}`), [], true, 9999));
    const r = await getCountryCitizenIds("eg", 5);
    expect(world.getCitizens).toHaveBeenCalledTimes(5);
    expect(r.ids).toHaveLength(500);
    expect(r.truncated).toBe(true);
  });
  it("getMixMembers(country) returns the name, ids and reported total; unknown country -> null", async () => {
    world.getCountries.mockResolvedValue({ countries: [{ id: "eg", name: "Egypt" }] });
    world.getCitizens.mockResolvedValue(page(["a", "b"], ["b"], false, 2));
    expect(await getMixMembers("country", "eg")).toEqual({ name: "Egypt", ids: ["a"], truncated: false, reportedTotal: 2 });
    expect(await getMixMembers("country", "zz")).toBeNull();
  });
});

describe("unit and party members", () => {
  it("unit: every listed member", async () => {
    units.getUnitDetail.mockResolvedValue({ unit: { name: "Black Flags", members: [{ id: "u1" }, { id: "u2" }] } });
    expect(await getMixMembers("unit", "mu1")).toEqual({ name: "Black Flags", ids: ["u1", "u2"], truncated: false, reportedTotal: 2 });
    units.getUnitDetail.mockResolvedValue({ unit: null });
    expect(await getMixMembers("unit", "nope")).toBeNull();
  });
  it("party: member list, and truncated when the party reports more members than returned", async () => {
    world.getPartyDetail.mockResolvedValue({ party: { name: "P", members: 12 }, members: [{ id: "a" }, { id: "b" }] });
    expect(await getMixMembers("party", "p1")).toEqual({ name: "P", ids: ["a", "b"], truncated: true, reportedTotal: 12 });
    world.getPartyDetail.mockResolvedValue({ party: { name: "P", members: 2 }, members: [{ id: "a" }, { id: "b" }] });
    expect((await getMixMembers("party", "p1"))?.truncated).toBe(false);
    world.getPartyDetail.mockResolvedValue({ party: null, members: [] });
    expect(await getMixMembers("party", "x")).toBeNull();
  });
});

describe("alliance members", () => {
  it("collects the active citizens of every member country (one page each) and flags a failed country", async () => {
    world.getAlliances.mockResolvedValue({ rows: [{ id: "aln1", name: "Pact", memberIds: ["c1", "c2"] }] });
    world.getCountries.mockResolvedValue({ countries: [] });
    world.getWars.mockResolvedValue({ rows: [] });
    world.getCitizens.mockImplementation(async (c: string) => { if (c === "c2") throw new Error("down"); return page(["x1", "x2"], [], false, 2); });
    const r = await getMixMembers("alliance", "aln1");
    expect(r).toMatchObject({ name: "Pact", ids: ["x1", "x2"], truncated: true });
    world.getCitizens.mockImplementation(async () => page(["y1"], [], false, 1));
    expect((await getMixMembers("alliance", "aln1"))?.truncated).toBe(false);
    expect(await getMixMembers("alliance", "missing")).toBeNull();
  });
});

describe("routes", () => {
  it("builds the overview and list routes", () => {
    expect(entityHref("party", "p 1")).toBe("/parties/p%201");
    expect(mixHref("alliance", "a1", "hybrid")).toBe("/builds/alliance/a1/hybrid");
  });
});
