import { asRecord } from "./parse";

/**
 * GET /players/{id}/stats ("level, rank, damage, work and trade (all time, today, this week, this month) and what their companies are
 * worth"). Only the top-level keys were captured (id, username, countryId, level, xp, prestige, rank, damage, work, trade, companies,
 * joinedAt, serverTime); the nested shapes never were. Groups are therefore read by convention: an object whose keys look like periods
 * becomes a period table, any other scalar becomes a labelled value, nested objects are flattened one level. Nothing is invented.
 */
export type PeriodKey = "all" | "day" | "week" | "month";
export const PERIOD_ORDER: readonly PeriodKey[] = ["all", "month", "week", "day"];
const PERIOD_ALIASES: Record<string, PeriodKey> = {
  all: "all", total: "all", allTime: "all", lifetime: "all", day: "day", today: "day", daily: "day", week: "week", weekly: "week", thisWeek: "week", month: "month", monthly: "month", thisMonth: "month",
};
const DIGITS = /^\d+$/;
export type Scalar = string | number;
const scalar = (v: unknown): Scalar | null => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && DIGITS.test(v) ? v : null);

export interface MetricGroup { key: string; periods: Partial<Record<PeriodKey, Scalar>>; values: { key: string; value: Scalar }[] }

/** Reads one group. Returns null when it holds no readable number at all. */
export function readGroup(key: string, raw: unknown): MetricGroup | null {
  const direct = scalar(raw);
  if (direct !== null) return { key, periods: {}, values: [{ key, value: direct }] };
  const o = asRecord(raw);
  const periods: MetricGroup["periods"] = {}; const values: MetricGroup["values"] = [];
  for (const [k, v] of Object.entries(o)) {
    const p = PERIOD_ALIASES[k], sc = scalar(v);
    if (p && sc !== null) periods[p] = sc;
    else if (sc !== null) values.push({ key: k, value: sc });
    else if (v && typeof v === "object" && !Array.isArray(v)) {
      for (const [k2, v2] of Object.entries(v as Record<string, unknown>)) { const s2 = scalar(v2); if (s2 !== null) values.push({ key: `${k}.${k2}`, value: s2 }); }
    }
  }
  return Object.keys(periods).length === 0 && values.length === 0 ? null : { key, periods, values };
}

export interface PlayerStats {
  id: string; username: string | null; countryId: string | null; level: number | null; xp: number | null; prestige: number | null; rank: Scalar | null; joinedAt: string | null;
  groups: MetricGroup[]; unreadGroups: string[];
}
const GROUP_KEYS = ["damage", "work", "trade", "companies"] as const;

export function parsePlayerStats(raw: unknown): PlayerStats | null {
  const o = asRecord(raw);
  if (typeof o.id !== "string" || !o.id) return null;
  const groups: MetricGroup[] = []; const unreadGroups: string[] = [];
  for (const k of GROUP_KEYS) {
    if (o[k] === undefined) continue;
    const g = readGroup(k, o[k]);
    if (g) groups.push(g); else unreadGroups.push(k);
  }
  const rank = o.rank;
  return {
    id: o.id, username: typeof o.username === "string" ? o.username : null, countryId: typeof o.countryId === "string" ? o.countryId : null,
    level: typeof o.level === "number" ? o.level : null, xp: typeof o.xp === "number" ? o.xp : null, prestige: typeof o.prestige === "number" ? o.prestige : null,
    rank: scalar(rank) ?? (typeof asRecord(rank).name === "string" ? (asRecord(rank).name as string) : typeof rank === "string" ? rank : null),
    joinedAt: typeof o.joinedAt === "string" ? o.joinedAt : null, groups, unreadGroups,
  };
}
