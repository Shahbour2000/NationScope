import { beforeEach, describe, expect, it } from "vitest";
import { BUILD_RULES } from "@/features/builds/classify";
import { _resetBuildCache, loadBuilds } from "@/lib/data/players";
import { parsePlayer, type PlayerProfile } from "@/lib/domain/player";

const warSkills = [...BUILD_RULES.war.map((code) => ({ code, level: 9, maxLevel: 10 })), ...BUILD_RULES.eco.map((code) => ({ code, level: 1, maxLevel: 10 }))];
const profile = (id: string, skills: unknown[] | null): { player: PlayerProfile | null } => ({ player: parsePlayer({ id, username: id, skills }, "https://a") });

describe("parsePlayer", () => {
  it("reads verified fields, normalises numeric damage and drops unsafe media", () => {
    const p = parsePlayer({ id: "usr_1", username: "Bob", avatarUrl: "/media/a.webp", countryId: "eg", level: 20, damage: { total: 2549826, day: "10", week: "77", month: "5" }, skills: warSkills, presence: { online: true, lastActiveAt: "2026-10-22T00:00:00Z" }, unit: { id: "mu_1", name: "U", role: "member" }, party: { id: "pty_1", name: "P" } }, "https://app.example")!;
    expect(p).toMatchObject({ name: "Bob", avatar: "https://app.example/media/a.webp", level: 20, online: true, hasSkills: true });
    expect(p.damage).toEqual({ total: "2549826", day: "10", week: "77", month: "5" });
    expect(p.unit).toEqual({ id: "mu_1", name: "U", role: "member" });
    expect(parsePlayer({ id: "u", username: "x", avatarUrl: "//evil/x.png" }, "https://a")!.avatar).toBeNull();
  });
  it("survives missing blocks and rejects non-players", () => {
    const p = parsePlayer({ id: "u", username: "x" }, "https://a")!;
    expect(p).toMatchObject({ hasSkills: false, skills: [], unit: null, party: null, damage: { total: null } });
    expect(parsePlayer({ nope: 1 }, "https://a")).toBeNull();
  });
});

describe("loadBuilds", () => {
  beforeEach(() => _resetBuildCache());
  it("classifies unique ids, reuses the cache and respects the per-call request cap", async () => {
    let calls = 0;
    const f = async (id: string) => { calls++; return profile(id, warSkills); };
    const ids = ["a", "b", "c", "a", "d"];
    const first = await loadBuilds(ids, { maxFetch: 2 }, f);
    expect(calls).toBe(2);
    expect([first.fetched, first.pending, first.failed]).toEqual([2, 2, 0]);
    expect(first.results.size).toBe(2);
    const second = await loadBuilds(ids, { maxFetch: 2 }, f); // a,b cached; c,d fetched
    expect(calls).toBe(4);
    expect(second.results.size).toBe(4);
    expect(second.pending).toBe(0);
  });
  it("counts failed requests and players without skills as failed, not as classified", async () => {
    const f = async (id: string) => { if (id === "x") throw new Error("boom"); return profile(id, id === "n" ? null : warSkills); };
    const r = await loadBuilds(["x", "n", "ok"], {}, f);
    expect(r.failed).toBe(2);
    expect([...r.results.keys()]).toEqual(["ok"]);
    const again = await loadBuilds(["x"], {}, async () => { throw new Error("should be cached"); });
    expect(again.failed).toBe(1); // failure cached briefly, no re-request
  });
});
