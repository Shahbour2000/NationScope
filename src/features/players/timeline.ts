import type { GovernmentHistoryRow } from "@/lib/domain/world";

/**
 * Player timeline events. Only events backed by an API record are produced:
 *  - political: one event per office held (GET /countries/{id}/government/history), repeated terms stay separate;
 *  - account: the `joinedAt` timestamp of GET /players/{id}, when present.
 * Combat and economy milestones are NOT produced: the API exposes no per-player battle, daily-damage or
 * economic history (see docs/api-gaps-phase-4.md).
 */
export type TimelineKind = "account" | "political";
export interface TimelineEvent {
  id: string;
  kind: TimelineKind;
  /** Role code for political events (translated by the UI); "joined" for the account event. */
  code: string;
  /** Fallback English label from the API when the role has no translation. */
  label: string | null;
  startedAt: string;
  endedAt: string | null;
  endReason: string | null;
  source: string | null;
  /** Country the office belongs to. */
  countryId: string | null;
}

const validTime = (v: string | null | undefined): v is string => typeof v === "string" && Number.isFinite(Date.parse(v));

export function buildTimeline(input: { userId: string; joinedAt: string | null; countryId: string | null; history: readonly GovernmentHistoryRow[] }): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  if (validTime(input.joinedAt)) {
    events.push({ id: "account-joined", kind: "account", code: "joined", label: null, startedAt: input.joinedAt, endedAt: null, endReason: null, source: null, countryId: null });
  }
  for (const h of input.history) {
    if (h.userId !== input.userId || !validTime(h.startedAt)) continue;
    events.push({
      id: `office-${h.id}`, kind: "political", code: h.role, label: h.label ?? null, startedAt: h.startedAt,
      endedAt: validTime(h.endedAt) ? h.endedAt : null, endReason: h.endReason ?? null, source: h.source ?? null, countryId: input.countryId,
    });
  }
  // Oldest first: the timeline reads from account creation to the present. Ties keep a stable id order.
  return events.sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt) || a.id.localeCompare(b.id));
}
