import type { Election, ElectionSlot } from "@/lib/domain/world";

export type Phase = "candidacy" | "voting" | "closed";
const ms = (v: string | null | undefined) => (v ? Date.parse(v) : NaN);

/** Where an election is on its schedule right now, from the dates the API supplies (null when they are missing). */
export function phaseOf(e: Pick<Election, "candidacyOpensAt" | "votingOpensAt" | "closesAt">, nowMs: number): { phase: Phase; endsAtMs: number | null } | null {
  const c = ms(e.candidacyOpensAt), v = ms(e.votingOpensAt), x = ms(e.closesAt);
  if (!Number.isFinite(v) || !Number.isFinite(x)) return null;
  if (nowMs >= x) return { phase: "closed", endsAtMs: null };
  if (nowMs >= v) return { phase: "voting", endsAtMs: x };
  if (!Number.isFinite(c) || nowMs >= c) return { phase: "candidacy", endsAtMs: v };
  return { phase: "candidacy", endsAtMs: null }; // not opened yet
}

/** Scheduled elections that have not closed yet, soonest first, without duplicates of the same kind and period. */
export function upcoming(calendar: readonly ElectionSlot[], nowMs: number): ElectionSlot[] {
  const seen = new Set<string>();
  return calendar
    .filter((c) => ms(c.closesAt) > nowMs)
    .filter((c) => { const k = `${c.kind}|${c.periodKey ?? ""}`; return seen.has(k) ? false : (seen.add(k), true); })
    .sort((a, b) => ms(a.candidacyOpensAt) - ms(b.candidacyOpensAt));
}

export const initials = (name: string | null | undefined): string => (name ?? "?").trim().slice(0, 2).toUpperCase();
