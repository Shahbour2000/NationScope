import type { JobOffer } from "@/lib/domain/economy";

export interface JobFilters { q: string; country: string; item: string; min: number | null; max: number | null }
export const NO_JOB_FILTERS: JobFilters = { q: "", country: "", item: "", min: null, max: null };
const CUR = (o: JobOffer): string => (typeof o.currency === "string" && o.currency ? o.currency : "money");
const net = (o: JobOffer): number | null => (o.netPerPoint != null && /^-?\d+$/.test(o.netPerPoint) ? Number(o.netPerPoint) : null);

/** Filters on raw values: net pay is compared as a number, never as formatted text. Offers without a net pay never match a pay bound. */
export function filterJobs(rows: readonly JobOffer[], f: JobFilters): JobOffer[] {
  const q = f.q.trim().toLowerCase();
  return rows.filter((o) => {
    if (f.country && o.countryId !== f.country) return false;
    if (f.item && o.itemCode !== f.item) return false;
    if (q && !`${o.companyName ?? ""} ${o.ownerName ?? ""}`.toLowerCase().includes(q)) return false;
    const v = net(o);
    if (f.min !== null && (v === null || v < f.min)) return false;
    if (f.max !== null && (v === null || v > f.max)) return false;
    return true;
  });
}

export interface PayGroup { key: string; offers: number; avg: number; max: number; min: number }
export interface JobStats { currency: string; offers: number; avg: number; highest: number; lowest: number; median: number; byCountry: PayGroup[]; byItem: PayGroup[] }

function group(vals: Map<string, number[]>): PayGroup[] {
  return [...vals].map(([key, v]) => ({ key, offers: v.length, avg: Math.round(v.reduce((a, b) => a + b, 0) / v.length), max: Math.max(...v), min: Math.min(...v) })).sort((a, b) => b.avg - a.avg || a.key.localeCompare(b.key));
}

/** Statistics over the GIVEN offers only (the live board, not game-wide figures), one entry per currency so different currencies are never mixed. */
export function jobStats(rows: readonly JobOffer[]): JobStats[] {
  const byCur = new Map<string, JobOffer[]>();
  for (const o of rows) if (net(o) !== null) (byCur.get(CUR(o)) ?? byCur.set(CUR(o), []).get(CUR(o))!).push(o);
  return [...byCur].map(([currency, offers]) => {
    const v = offers.map((o) => net(o)!).sort((a, b) => a - b);
    const mid = v.length >> 1;
    const countries = new Map<string, number[]>(), items = new Map<string, number[]>();
    for (const o of offers) {
      if (o.countryId) (countries.get(o.countryId) ?? countries.set(o.countryId, []).get(o.countryId)!).push(net(o)!);
      (items.get(o.itemCode) ?? items.set(o.itemCode, []).get(o.itemCode)!).push(net(o)!);
    }
    return { currency, offers: v.length, avg: Math.round(v.reduce((a, b) => a + b, 0) / v.length), highest: v[v.length - 1]!, lowest: v[0]!, median: v.length % 2 ? v[mid]! : Math.round((v[mid - 1]! + v[mid]!) / 2), byCountry: group(countries), byItem: group(items) };
  }).sort((a, b) => b.offers - a.offers);
}
