import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ethicLabel } from "@/features/politics/ethics";
import { phaseOf, upcoming } from "@/features/politics/elections";
import { electionCalendarSchema } from "@/lib/domain/world";

const fx = JSON.parse(readFileSync("tests/fixtures/real/elections-eg.json", "utf8")) as { calendar: unknown[] };
const t = (s: string) => Date.parse(s);
const e = { candidacyOpensAt: "2026-10-10T00:00:00Z", votingOpensAt: "2026-10-12T00:00:00Z", closesAt: "2026-10-13T00:00:00Z" };

describe("phaseOf", () => {
  it("follows the schedule", () => {
    expect(phaseOf(e, t("2026-10-11T00:00:00Z"))).toEqual({ phase: "candidacy", endsAtMs: t("2026-10-12T00:00:00Z") });
    expect(phaseOf(e, t("2026-10-12T12:00:00Z"))).toEqual({ phase: "voting", endsAtMs: t("2026-10-13T00:00:00Z") });
    expect(phaseOf(e, t("2026-10-14T00:00:00Z"))).toEqual({ phase: "closed", endsAtMs: null });
  });
  it("returns null instead of guessing when dates are missing", () => {
    expect(phaseOf({ candidacyOpensAt: null, votingOpensAt: null, closesAt: null }, 0)).toBeNull();
  });
});
describe("upcoming", () => {
  it("drops closed slots, de-duplicates and sorts soonest first", () => {
    const cal = fx.calendar.map((c) => electionCalendarSchema.parse(c));
    const out = upcoming([...cal, ...cal], t("2026-10-17T12:00:00Z"));
    expect(new Set(out.map((c) => `${c.kind}|${c.periodKey}`)).size).toBe(out.length);
    expect(out.every((c) => Date.parse(c.closesAt ?? "") > t("2026-10-17T12:00:00Z"))).toBe(true);
    for (let i = 1; i < out.length; i++) expect(Date.parse(out[i - 1]!.candidacyOpensAt ?? "")).toBeLessThanOrEqual(Date.parse(out[i]!.candidacyOpensAt ?? ""));
  });
});
describe("ethicLabel", () => {
  const dict = { industrial: "Industrial", fanatic: "Fanatic" };
  const hum = (c: string) => `H(${c})`;
  it("combines base and tier and falls back for unknown codes", () => {
    expect(ethicLabel("industrial:fanatic", dict, hum)).toBe("Industrial · Fanatic");
    expect(ethicLabel("weird", dict, hum)).toBe("H(weird)");
  });
});
