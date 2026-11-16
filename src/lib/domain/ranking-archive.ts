import { asRecord } from "./parse";

/**
 * GET /rankings/{board}/archive: "finished periods of a leaderboard" (OpenAPI summary). No response has ever been captured, so this reads a
 * list of period entries by convention: each entry is a period key string, or an object with `periodKey` (and optionally `period` and a
 * timestamp). Unrecognised responses return null and the page shows them as returned.
 */
export type ArchivePeriod = "daily" | "weekly" | "monthly" | "other";
export interface ArchiveEntry { periodKey: string; period: ArchivePeriod; at: string | null }
const KEY = /^[A-Za-z0-9-]{1,20}$/;
const TS_KEYS = ["archivedAt", "finishedAt", "endedAt", "closedAt", "endsAt"];

/** The period type a key looks like; only the three formats the API's own keys follow are inferred, otherwise "other". */
export function periodOfKey(key: string): ArchivePeriod {
  if (/^\d{4}-\d{2}-\d{2}$/.test(key)) return "daily";
  if (/^\d{4}-W\d{2}$/i.test(key)) return "weekly";
  if (/^\d{4}-\d{2}$/.test(key)) return "monthly";
  return "other";
}

export function readArchive(raw: unknown): { entries: ArchiveEntry[]; skipped: number } | null {
  const o = asRecord(raw);
  const list = Array.isArray(raw) ? raw : ["periods", "items", "archive", "rows", "data"].map((k) => o[k]).find(Array.isArray);
  if (!Array.isArray(list)) return null;
  const entries: ArchiveEntry[] = []; let skipped = 0;
  for (const x of list) {
    const e = asRecord(x);
    const key = typeof x === "string" ? x : typeof e.periodKey === "string" ? e.periodKey : typeof e.key === "string" ? e.key : null;
    if (!key || !KEY.test(key)) { skipped++; continue; }
    const declared = typeof e.period === "string" && ["daily", "weekly", "monthly"].includes(e.period) ? (e.period as ArchivePeriod) : null;
    const tk = TS_KEYS.find((k) => typeof e[k] === "string" && !Number.isNaN(Date.parse(e[k] as string)));
    entries.push({ periodKey: key, period: declared ?? periodOfKey(key), at: tk ? (e[tk] as string) : null });
  }
  if (entries.length === 0 && skipped > 0) return null;
  entries.sort((a, b) => b.periodKey.localeCompare(a.periodKey));
  return { entries, skipped };
}

export function groupArchive(entries: readonly ArchiveEntry[]): Record<ArchivePeriod, ArchiveEntry[]> {
  const g: Record<ArchivePeriod, ArchiveEntry[]> = { monthly: [], weekly: [], daily: [], other: [] };
  for (const e of entries) g[e.period].push(e);
  return g;
}
