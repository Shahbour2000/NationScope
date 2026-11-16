import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Display } from "@/features/entities/display";
import { ArchiveAsReturned, ArchiveView } from "@/features/rankings/ArchiveView";
import { StatsView } from "@/features/players/StatsView";
import { getMessages, numberLocale } from "@/i18n";
import { EMPTY_DIRECTORY } from "@/lib/domain/directory";
import { PERIOD_ORDER, parsePlayerStats, readGroup } from "@/lib/domain/player-stats";
import { groupArchive, periodOfKey, readArchive } from "@/lib/domain/ranking-archive";

const display = (locale: "en" | "ar"): Display => { const m = getMessages(locale); return { locale, nl: numberLocale(locale), mediaOrigin: "", dir: EMPTY_DIRECTORY, m: { t: m.t, items: m.items, time: m.time, ui: m.ui } }; };
const clean = (h: string) => { for (const bad of ["undefined", "NaN", "[object", "Infinity"]) expect(h).not.toContain(bad); };

// SYNTHETIC: neither response has ever been captured. These cases test the readers' conventions and fallbacks only.
describe("ranking archive reader (SYNTHETIC shapes)", () => {
  it("infers the period of a key only from the three known key formats", () => {
    expect(periodOfKey("2026-11-10")).toBe("daily"); expect(periodOfKey("2026-W45")).toBe("weekly"); expect(periodOfKey("2026-10")).toBe("monthly"); expect(periodOfKey("whatever")).toBe("other");
  });
  it("reads string keys, objects, and wrapped lists; newest first", () => {
    const a = readArchive({ periods: [{ periodKey: "2026-10", archivedAt: "2026-11-01T00:00:00Z" }, "2026-11-09", { period: "weekly", periodKey: "x-1" }, { bad: 1 }] })!;
    expect(a.entries.map((e) => e.periodKey)).toEqual(["x-1", "2026-11-09", "2026-10"]); expect(a.skipped).toBe(1);
    expect(a.entries.find((e) => e.periodKey === "x-1")!.period).toBe("weekly");
    expect(groupArchive(a.entries).monthly).toHaveLength(1);
  });
  it("distinguishes empty from unrecognised", () => {
    expect(readArchive([])).toEqual({ entries: [], skipped: 0 }); expect(readArchive({ foo: 1 })).toBeNull(); expect(readArchive([{ bad: 1 }])).toBeNull(); expect(readArchive("x")).toBeNull();
  });
  it.each(["en", "ar"] as const)("renders grouped links to frozen results (%s)", (loc) => {
    const m = getMessages(loc);
    const a = readArchive(["2026-10", "2026-11-09", "weird"])!;
    const html = renderToStaticMarkup(createElement(ArchiveView, { board: "playerDamage", entries: a.entries, skipped: 0, d: display(loc), m })); clean(html);
    expect(html).toContain('href="/rankings/playerDamage?period=monthly&amp;periodKey=2026-10"');
    expect(html).toContain('href="/rankings/playerDamage?period=daily&amp;periodKey=2026-11-09"');
    expect(html).not.toContain("periodKey=weird"); // an unknown period type has no link: the board page cannot open it
    expect(renderToStaticMarkup(createElement(ArchiveView, { board: "b", entries: [], skipped: 0, d: display(loc), m }))).toContain(m.rankingArchive.empty);
    expect(renderToStaticMarkup(createElement(ArchiveAsReturned, { data: { x: "shape" }, d: display(loc), m }))).toContain(m.rankingArchive.unrecognised);
  });
});

describe("player stats reader (SYNTHETIC nested shapes; top-level keys are from the real capture)", () => {
  const raw = { id: "usr_1", username: "Kiral", countryId: "uk", level: 31, xp: 7175, prestige: 0, rank: "Veteran", joinedAt: "2026-01-01T00:00:00Z",
    damage: { total: "2222507", day: "1000", week: "5000", month: "90000" }, work: { allTime: 120, today: 3, thisWeek: 20, thisMonth: 80, shifts: 5 },
    trade: { all: { bought: "10", sold: "20" } }, companies: { count: 4, invested: "123456789012345678901" } };
  const s = parsePlayerStats(raw)!;
  it("maps period aliases and keeps other numbers as labelled values", () => {
    expect(s.groups.map((g) => g.key)).toEqual(["damage", "work", "trade", "companies"]);
    expect(readGroup("damage", raw.damage)!.periods).toEqual({ all: "2222507", day: "1000", week: "5000", month: "90000" });
    expect(readGroup("work", raw.work)!.periods).toEqual({ all: 120, day: 3, week: 20, month: 80 }); expect(readGroup("work", raw.work)!.values).toEqual([{ key: "shifts", value: 5 }]);
    expect(readGroup("trade", raw.trade)!.values).toEqual([{ key: "all.bought", value: "10" }, { key: "all.sold", value: "20" }]);
    expect(PERIOD_ORDER).toEqual(["all", "month", "week", "day"]);
  });
  it("rejects non-stats bodies and reports unreadable groups", () => {
    expect(parsePlayerStats({ nope: 1 })).toBeNull(); expect(parsePlayerStats([])).toBeNull();
    expect(parsePlayerStats({ id: "u", damage: { foo: "bar" }, work: 5 })!.unreadGroups).toEqual(["damage"]);
    expect(readGroup("x", null)).toBeNull(); expect(readGroup("x", [])).toBeNull();
  });
  it.each(["en", "ar"] as const)("renders exact big numbers without float rounding (%s)", (loc) => {
    const m = getMessages(loc);
    const html = renderToStaticMarkup(createElement(StatsView, { stats: s, d: display(loc), m })); clean(html);
    expect(html).toContain(new Intl.NumberFormat(numberLocale(loc)).format(2222507n));
    expect(html).toContain(new Intl.NumberFormat(numberLocale(loc)).format(123456789012345678901n)); // BigInt-exact
    expect(html).toContain(m.playerStats.periodMonth); expect(html).toContain(m.playerStats.unitsNote);
  });
});
