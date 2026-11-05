/** Locale-aware number formatting. Unknown values are shown as an em dash, never as 0. */
export const DASH = '—';
export function fmt(v: number | null | undefined, numLocale: string, digits = 0): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return DASH;
  return new Intl.NumberFormat(numLocale, { maximumFractionDigits: digits, minimumFractionDigits: 0 }).format(v);
}
export function fmtGold(v: number | null | undefined, numLocale: string): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return DASH;
  const d = Math.abs(v) >= 100 ? 0 : Math.abs(v) >= 1 ? 1 : 2;
  return new Intl.NumberFormat(numLocale, { maximumFractionDigits: d, minimumFractionDigits: 0 }).format(v);
}
export const signed = (v: number | null | undefined, numLocale: string, digits = 0): string => (v === null || v === undefined || !Number.isFinite(v) ? DASH : `${v > 0 ? '+' : ''}${fmt(v, numLocale, digits)}`);
export const minutesLabel = (m: number): string => { const h = Math.floor(m / 60), r = Math.round(m % 60); return h > 0 ? `${h}h ${r}m` : `${r}m`; };
