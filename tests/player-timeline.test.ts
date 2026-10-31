import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildTimeline } from "@/features/players/timeline";
import { governmentHistorySchema } from "@/lib/domain/world";

const rows = (JSON.parse(readFileSync("tests/fixtures/real/government-history-eg.json", "utf8")) as unknown[]).map((r) => governmentHistorySchema.parse(r));
const row = (o: Record<string, unknown>) => governmentHistorySchema.parse({ id: "x", role: "president", ...o });

describe("buildTimeline", () => {
  it("keeps only the player's own offices, one event per term", () => {
    const t = buildTimeline({ userId: "usr_r9s8exrd8arivqrq", joinedAt: null, countryId: "eg", history: rows });
    expect(t.length).toBeGreaterThan(0);
    expect(t.every((e) => e.kind === "political")).toBe(true);
    const mine = rows.filter((r) => r.userId === "usr_r9s8exrd8arivqrq" && r.startedAt);
    expect(t).toHaveLength(mine.length);
  });
  it("lists repeated appointments to the same role separately", () => {
    const t = buildTimeline({ userId: "u", joinedAt: null, countryId: "eg", history: [
      row({ id: "a", userId: "u", role: "vicePresident", startedAt: "2026-10-01T00:00:00Z", endedAt: "2026-10-03T00:00:00Z" }),
      row({ id: "b", userId: "u", role: "vicePresident", startedAt: "2026-10-05T00:00:00Z", endedAt: null }),
    ] });
    expect(t.map((e) => e.id)).toEqual(["office-a", "office-b"]);
    expect(t[1]!.endedAt).toBeNull();
  });
  it("sorts oldest first and puts account creation first when it is earliest", () => {
    const t = buildTimeline({ userId: "u", joinedAt: "2026-09-01T00:00:00Z", countryId: "eg", history: [row({ id: "late", userId: "u", startedAt: "2026-10-09T00:00:00Z" }), row({ id: "early", userId: "u", startedAt: "2026-10-02T00:00:00Z" })] });
    expect(t.map((e) => e.id)).toEqual(["account-joined", "office-early", "office-late"]);
  });
  it("never invents events: other players, missing or invalid dates are skipped", () => {
    const t = buildTimeline({ userId: "u", joinedAt: "nope", countryId: null, history: [row({ id: "o", userId: "other", startedAt: "2026-10-01T00:00:00Z" }), row({ id: "n", userId: "u" }), row({ id: "bad", userId: "u", startedAt: "garbage" })] });
    expect(t).toEqual([]);
  });
});
