/** Battle-history windowing and coverage. Kept pure so the "is this period fully covered?" decision can be tested. */
export const RANGE_DAYS = { "7": 7, "30": 30, "90": 90 } as const;
export type RangeKey = keyof typeof RANGE_DAYS;

interface Stamped { endedAt?: string | null; startedAt?: string | null }
export const stampMs = (b: Stamped): number => Date.parse(b.endedAt ?? b.startedAt ?? "");

export function parseRange(v: string | undefined): RangeKey {
  return v !== undefined && v in RANGE_DAYS ? (v as RangeKey) : "30";
}

/**
 * Rows inside the window plus whether the window is fully covered. The list endpoint has no date filter or cursor, so the
 * period is covered only if the API ran out of rows (`exhausted`) or the oldest row it returned is already older than the cutoff.
 */
export function windowBattles<T extends Stamped>(rows: readonly T[], range: RangeKey, nowMs: number, exhausted: boolean) {
  const cutoff = nowMs - RANGE_DAYS[range] * 86_400_000;
  const inside = rows.filter((b) => stampMs(b) >= cutoff);
  const oldest = rows.reduce((min, b) => Math.min(min, stampMs(b)), Infinity);
  return { rows: inside, covered: exhausted || oldest <= cutoff, oldestMs: Number.isFinite(oldest) ? oldest : null };
}
