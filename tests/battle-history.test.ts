import { describe, expect, it } from "vitest";
import { parseRange, windowBattles } from "@/features/wars/history";

const NOW = Date.parse("2026-10-31T12:00:00Z");
const day = 86_400_000;
const b = (daysAgo: number) => ({ endedAt: new Date(NOW - daysAgo * day).toISOString(), startedAt: null });

describe("windowBattles", () => {
  it("keeps only battles inside the selected period", () => {
    const rows = [b(1), b(6), b(8), b(40), b(100)];
    expect(windowBattles(rows, "7", NOW, false).rows).toHaveLength(2);
    expect(windowBattles(rows, "30", NOW, false).rows).toHaveLength(3);
    expect(windowBattles(rows, "90", NOW, false).rows).toHaveLength(4);
  });
  it("is covered when the oldest returned battle is older than the cutoff", () => {
    expect(windowBattles([b(1), b(50)], "30", NOW, false).covered).toBe(true);
  });
  it("is NOT covered when a full page ends inside the period", () => {
    const w = windowBattles([b(1), b(10)], "30", NOW, false);
    expect(w.covered).toBe(false);
    expect(w.oldestMs).toBe(NOW - 10 * day);
  });
  it("is covered when the API simply had no more rows", () => {
    expect(windowBattles([b(1), b(10)], "90", NOW, true).covered).toBe(true);
  });
  it("falls back to 30 days for unknown ranges", () => {
    expect(parseRange("abc")).toBe("30");
    expect(parseRange("7")).toBe("7");
  });
});
