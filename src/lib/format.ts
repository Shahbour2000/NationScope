import { MONEY_SCALE, formatGold, parseMoney } from "@/lib/money";

/** Money string (1/10,000 gold) -> "1.2345" with trailing zeros trimmed but at least 2 decimals. Null for missing/invalid. */
export function formatMoney(value: string | null | undefined, locale = "en-US"): string | null {
  if (value === null || value === undefined) return null;
  let v: bigint;
  try { v = parseMoney(value); } catch { return null; }
  const raw = formatGold(v, { decimals: 4, group: false });
  const [whole = "0", frac = ""] = raw.split(".");
  const trimmed = frac.replace(/0+$/, "").padEnd(2, "0");
  const grouped = new Intl.NumberFormat(locale).format(BigInt(whole.replace("-", "") || "0"));
  return `${whole.startsWith("-") ? "-" : ""}${grouped}.${trimmed}`;
}

/** Compact, locale-aware UTC timestamp. */
export function formatDateTime(iso: string | null | undefined, locale: string, utcLabel = "UTC"): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(d)} ${utcLabel}`;
}

export function formatDate(iso: string | null | undefined, locale: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(d);
}

export function formatDuration(ms: number, u: { d: string; h: string; m: string }): string {
  const mins = Math.max(0, Math.floor(ms / 60000));
  const d = Math.floor(mins / 1440), h = Math.floor((mins % 1440) / 60), m = mins % 60;
  if (d > 0) return `${d}${u.d} ${h}${u.h}`;
  if (h > 0) return `${h}${u.h} ${m}${u.m}`;
  return `${m}${u.m}`;
}

/** "lightAmmo" / "light_ammo" / "iq-mosul" -> "Light ammo" / "Mosul". Fallback only; official names win. */
export function humanizeCode(code: string): string {
  const spaced = code.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").trim().toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Percent from two integers, one decimal, without float drift on the division inputs. */
export function percent(part: number, whole: number): number | null {
  return whole > 0 ? Math.round((part / whole) * 1000) / 10 : null;
}

export { MONEY_SCALE };
