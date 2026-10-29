/**
 * Pure helpers that decide whether a battle / war is genuinely in progress.
 * The API `status` field alone is not trusted: a row only counts as ongoing when nothing in the row contradicts it.
 * Evidence used (all verified fields of GET /battles): status, endedAt, winner, round.status.
 */
import type { Battle, War } from "@/lib/domain/world";

type BattleLike = Pick<Battle, "status" | "endedAt" | "winner" | "round">;
type WarLike = Pick<War, "status" | "endedAt">;

/** True only when status is "active" AND there is no end timestamp, no winner and the current round is not finished. Missing data is NOT treated as a contradiction, but a missing/unknown status is never ongoing. */
export function isBattleOngoing(b: BattleLike): boolean {
  if (b.status !== "active") return false;
  if (b.endedAt) return false;
  if (b.winner) return false;
  if (b.round?.status === "finished") return false;
  return true;
}

/** Same rule for wars: "active" with no end timestamp. */
export function isWarOngoing(w: WarLike): boolean {
  return w.status === "active" && !w.endedAt;
}

export const ongoingBattles = <T extends BattleLike>(rows: readonly T[]): T[] => rows.filter(isBattleOngoing);

/** Newest first by startedAt (rows without a date go last). */
export const newestFirst = <T extends { startedAt?: string | null }>(rows: readonly T[]): T[] =>
  [...rows].sort((a, b) => (b.startedAt ?? "").localeCompare(a.startedAt ?? ""));
