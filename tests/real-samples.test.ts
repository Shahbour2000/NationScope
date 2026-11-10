import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseLawResponse, parsePartyDetail } from "@/lib/data/world";
import { parseRows } from "@/lib/domain/parse";
import { filterJobs, jobStats, NO_JOB_FILTERS } from "@/features/economy/jobs";
import { jobOfferSchema } from "@/lib/domain/economy";

// These tests read the REAL captured API responses in API/samples (not hand-written fixtures).
const sample = (rel: string) => JSON.parse(fs.readFileSync(path.join(process.cwd(), "API", "samples", rel), "utf8")) as Record<string, unknown>;

describe("real sample: party details", () => {
  const r = parsePartyDetail(sample("parties/Party details.txt"));
  it("parses the party and all members with role, level, joined date and avatar", () => {
    expect(r.party?.name).toBe("Ummah Caliphate Party");
    expect(r.party?.countryId).toBe("eg");
    expect(r.party?.ruling).toBe(true);
    expect(r.members).toHaveLength(12);
    expect(r.members.find((m) => m.role === "leader")?.name).toBe("AbuDujana");
    expect(new Set(r.members.map((m) => m.role))).toEqual(new Set(["leader", "treasurer", "officer", "member"]));
    expect(r.members.every((m) => !!m.joinedAt)).toBe(true);
    // two real members have no avatar: it must stay null (UI shows initials), never a guessed URL
    expect(r.members.filter((m) => m.avatarUrl === null)).toHaveLength(2);
    expect(r.members.filter((m) => m.avatarUrl !== null).every((m) => m.avatarUrl!.startsWith("/media/"))).toBe(true);
    expect(r.party?.leaderName).toBe("AbuDujana");
    expect(r.party?.ethics).toEqual(["imperialist", "industrial:fanatic", "militarist:fanatic"]);
  });
  it("parses ethics choices, effects, council and next election; unknown item shapes are not modelled", () => {
    expect(r.extras.ethics?.choices.map((c) => `${c.axis}:${c.code}:${c.level}:${c.fanatic}`).sort()).toEqual(["borders:imperialist:1:false", "economy:industrial:2:true", "posture:militarist:2:true"]);
    expect(r.extras.ethics?.effects).toMatchObject({ damagePercent: 8, productProductionPercent: 10, attackOutsideCorePercent: 5, resistanceGrowthPercent: 10 });
    expect(r.extras.ethics?.cooldownDays).toBe(7);
    expect(r.extras.councilSeats).toBe(3);
    expect(r.extras.treasury).toBe("0");
    expect(r.extras.nextElection?.votingOpensAt).toBe("2026-10-26T12:00:00.000Z");
  });
  it("returns nulls, not invented values, for an empty or unrecognised body", () => {
    const e = parsePartyDetail({});
    expect(e.party).toBeNull();
    expect(e.members).toEqual([]);
    expect(e.extras.ethics).toBeNull();
    expect(e.extras.nextElection).toBeNull();
  });
});

describe("real sample: open job offers", () => {
  const raw = sample("jobs/Open job offers.txt");
  const rows = parseRows(raw.offers, jobOfferSchema).rows;
  it("parses every real offer and keeps currency", () => {
    expect(rows.length).toBe((raw.offers as unknown[]).length);
    expect(rows.every((o) => typeof o.currency === "string")).toBe(true);
  });
  it("filters and statistics agree with a direct computation on the raw numbers", () => {
    const nets = (raw.offers as { netPerPoint: string }[]).map((o) => Number(o.netPerPoint)).sort((a, b) => a - b);
    const st = jobStats(rows);
    const total = st.reduce((n, s) => n + s.offers, 0);
    expect(total).toBe(nets.length);
    const money = st.find((s) => s.currency === "money")!;
    expect(money.highest).toBe(nets[nets.length - 1]);
    expect(money.lowest).toBe(nets[0]);
    expect(money.avg).toBe(Math.round(nets.reduce((a, b) => a + b, 0) / nets.length));
    const median = nets.length % 2 ? nets[nets.length >> 1]! : Math.round((nets[nets.length / 2 - 1]! + nets[nets.length / 2]!) / 2);
    expect(money.median).toBe(median);
    const above = filterJobs(rows, { ...NO_JOB_FILTERS, min: money.avg });
    expect(above.every((o) => Number(o.netPerPoint) >= money.avg)).toBe(true);
  });
});

describe("real sample: alliance laws vs country laws", () => {
  const al = parseLawResponse(sample("alliances/Alliance laws.txt"));
  const co = parseLawResponse(sample("politics/Country laws.txt"));
  it("the alliance response has the same envelope as the country response (verified, not assumed)", () => {
    expect(al.recognised).toBe(true);
    expect(co.recognised).toBe(true);
    expect(al.skipped).toBe(0);
    expect(co.skipped).toBe(0);
    expect(al.proposals).toHaveLength(13);
    expect(al.hasMore).toBe(false);
    expect(co.hasMore).toBe(true);
  });
  it("alliance proposals use alliance scope and country params", () => {
    expect(new Set(al.proposals.map((p) => p.lawCode))).toEqual(new Set(["alliance_admit", "alliance_expel"]));
    expect(al.proposals.every((p) => typeof (p.params as { country?: unknown })?.country === "string")).toBe(true);
    expect(al.proposals.every((p) => (p as { scope?: string }).scope === "alliance")).toBe(true);
  });
  it("keeps the failure reason of failed proposals", () => {
    const failed = al.proposals.filter((p) => p.status === "failed");
    expect(failed.length).toBeGreaterThan(0);
    expect(failed.every((p) => !!p.failureReason)).toBe(true);
  });
  it("an unrecognised body is reported as such, not as an empty success", () => {
    expect(parseLawResponse({ message: "nope" })).toMatchObject({ recognised: false, proposals: [] });
  });
});

import { eventTargets } from "@/features/history/timeline";
describe("real sample: country world events", () => {
  const items = (sample("countries/Country history.txt").items as { key: string; type: string; link?: string; regionId?: string | null; countryIds?: string[] }[]);
  it("derives battle/law targets only from real key/link patterns", () => {
    const battle = items.find((e) => e.type === "battle")!;
    expect(eventTargets(battle).battleId).toBe(battle.key.split(":")[1]);
    const law = items.find((e) => e.type === "law")!;
    expect(eventTargets(law).lawId).toBe(law.key.split(":")[1]);
    const own = items.find((e) => e.type === "ownership")!;
    expect(eventTargets(own).battleId).toMatch(/^btl_/);
    const treaty = items.find((e) => e.type === "treaty")!;
    expect(eventTargets(treaty)).toMatchObject({ battleId: null, lawId: null });
  });
  it("never links an unsafe id", () => {
    expect(eventTargets({ key: "battle:../../x", type: "battle", countryIds: ["eg", "a b"], regionId: "x/y" })).toEqual({ battleId: null, lawId: null, regionId: null, countryIds: ["eg"] });
  });
});

import { parseAnnouncements } from "@/lib/data/announcements";
describe("real sample: announcements", () => {
  it("parses the top-level array (numeric strings for views are accepted)", () => {
    const raw = JSON.parse(fs.readFileSync(path.join(process.cwd(), "API", "samples", "countries", "Announcements.txt"), "utf8"));
    const r = parseAnnouncements(raw);
    expect(r.recognised).toBe(true);
    expect(r.skipped).toBe(0);
    expect(r.rows).toHaveLength(raw.length);
    expect(r.rows[0]).toMatchObject({ authorName: "AbuDujana", countryId: "eg" });
  });
  it("flags an unrecognised body", () => { expect(parseAnnouncements({ error: 1 }).recognised).toBe(false); });
});
