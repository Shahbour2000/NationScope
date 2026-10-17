import { isScalar, type Row } from "./shape";

const RANK: Record<string, number> = { name: 0, title: 1, id: 2 };

/** Picks readable table columns from what rows actually contain (scalar fields only), name/title/id first. */
export function pickColumns(rows: readonly Row[], max = 8): string[] {
  const order: string[] = [];
  const seen = new Set<string>();
  for (const r of rows.slice(0, 100)) {
    for (const [k, v] of Object.entries(r)) {
      if (isScalar(v) && !seen.has(k)) { seen.add(k); order.push(k); }
    }
  }
  return order
    .map((k, i) => ({ k, i }))
    .sort((a, b) => (RANK[a.k] ?? 3) - (RANK[b.k] ?? 3) || a.i - b.i)
    .slice(0, max)
    .map((x) => x.k);
}
