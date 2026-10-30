/** Pure helpers for the world-events timeline. Days are UTC calendar days of the event timestamp; events without a valid date are kept in their own trailing group, never dropped. */
export interface Dated { at?: string | null; type: string }
export interface DayGroup<T> { day: string | null; items: T[] }

const dayOf = (at: string | null | undefined): string | null => (at && !Number.isNaN(Date.parse(at)) ? new Date(at).toISOString().slice(0, 10) : null);

/** Newest day first; inside a day, newest event first. Undated events go last in input order. */
export function groupByDay<T extends Dated>(rows: readonly T[]): DayGroup<T>[] {
  const dated = new Map<string, T[]>();
  const undated: T[] = [];
  for (const r of rows) { const k = dayOf(r.at); if (k) (dated.get(k) ?? dated.set(k, []).get(k)!).push(r); else undated.push(r); }
  const out: DayGroup<T>[] = [...dated].sort((a, b) => b[0].localeCompare(a[0])).map(([day, items]) => ({ day, items: [...items].sort((a, b) => Date.parse(b.at!) - Date.parse(a.at!)) }));
  if (undated.length) out.push({ day: null, items: undated });
  return out;
}

export function countByType(rows: readonly Dated[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) m.set(r.type, (m.get(r.type) ?? 0) + 1);
  return m;
}
