/** Chart helpers (floating point is fine: these only draw pictures; money results never come from here). */
export interface SeriesPoint { at: number; price: number }
/** Reduces a series to at most `max` evenly spaced time buckets, keeping the last price in each bucket. */
export function bucketSeries(points: readonly SeriesPoint[], max = 40): SeriesPoint[] {
  const ps = [...points].filter((p) => Number.isFinite(p.at) && Number.isFinite(p.price)).sort((a, b) => a.at - b.at);
  if (ps.length <= max) return ps;
  const t0 = ps[0]!.at, t1 = ps[ps.length - 1]!.at, span = Math.max(1, t1 - t0);
  const out = new Map<number, SeriesPoint>();
  for (const p of ps) out.set(Math.min(max - 1, Math.floor(((p.at - t0) / span) * max)), p);
  return [...out.entries()].sort((a, b) => a[0] - b[0]).map(([, p]) => p);
}
/** SVG polyline coordinates in a w x h box with padding; null if there is nothing to draw. */
export function polyline(points: readonly SeriesPoint[], w: number, h: number, pad = 3): { d: string; min: number; max: number } | null {
  if (points.length < 2) return null;
  const xs = points.map((p) => p.at), ys = points.map((p) => p.price);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const dx = x1 - x0 || 1, dy = y1 - y0 || 1;
  const d = points.map((p, k) => `${k ? "L" : "M"}${(pad + ((p.at - x0) / dx) * (w - 2 * pad)).toFixed(1)},${(h - pad - ((p.price - y0) / dy) * (h - 2 * pad)).toFixed(1)}`).join("");
  return { d, min: y0, max: y1 };
}
