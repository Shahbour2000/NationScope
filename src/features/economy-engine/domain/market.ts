import { floorDiv, mulBpFloor } from "./fixed";

/** One order-book level. `price` is gold in 1/10,000; `qty` is a whole number of units. */
export interface Level { price: bigint; qty: number }

export interface Fill {
  requested: number;
  filled: number;
  /** Total gold paid/received for the filled units. */
  value: bigint;
  avgPrice: bigint | null;
  worstPrice: bigint | null;
  shortfall: number;
}

/**
 * Walks an order book best-price-first. `levels` for a sell-into-bids walk must be highest price first; for a buy-from-asks walk lowest first.
 * The function re-sorts defensively using `side`, so callers cannot get a wrong order by accident.
 */
export function walkBook(levels: readonly Level[], qty: number, side: "bids" | "asks"): Fill {
  const want = Number.isFinite(qty) ? Math.max(0, Math.floor(qty)) : 0;
  const sorted = [...levels].filter((l) => l.qty > 0 && l.price > 0n).sort((a, b) => (a.price === b.price ? 0 : (side === "bids" ? a.price > b.price : a.price < b.price) ? -1 : 1));
  let left = want, value = 0n, worst: bigint | null = null;
  for (const l of sorted) {
    if (left <= 0) break;
    const take = Math.min(left, Math.floor(l.qty));
    if (take <= 0) continue;
    value += l.price * BigInt(take); worst = l.price; left -= take;
  }
  const filled = want - left;
  return { requested: want, filled, value, avgPrice: filled > 0 ? value / BigInt(filled) : null, worstPrice: worst, shortfall: left };
}

export interface Trade { price: bigint; qty: number; at: number }

export interface TradeWindow {
  count: number; volume: number; value: bigint; vwap: bigint | null; high: bigint | null; low: bigint | null;
  /** Milliseconds between the oldest trade in the sample and `now`. */
  spanMs: number;
}
export function tradeWindow(trades: readonly Trade[], now: number, windowMs: number): TradeWindow {
  const inWin = trades.filter((t) => t.qty > 0 && Number.isFinite(t.at) && t.at <= now && now - t.at <= windowMs);
  let volume = 0, value = 0n, high: bigint | null = null, low: bigint | null = null, oldest = now;
  for (const t of inWin) {
    const q = Math.floor(t.qty); volume += q; value += t.price * BigInt(q);
    if (high === null || t.price > high) high = t.price;
    if (low === null || t.price < low) low = t.price;
    if (t.at < oldest) oldest = t.at;
  }
  return { count: inWin.length, volume, value, vwap: volume > 0 ? floorDiv(value, BigInt(volume)) : null, high, low, spanMs: inWin.length ? now - oldest : 0 };
}

/** Relative dispersion of trade prices around their VWAP, in percent (analytics only, floating point is fine here). */
export function volatilityPct(trades: readonly Trade[]): number | null {
  const ts = trades.filter((t) => t.qty > 0);
  if (ts.length < 5) return null;
  let vol = 0, val = 0;
  for (const t of ts) { vol += t.qty; val += Number(t.price) * t.qty; }
  const mean = val / vol;
  if (!(mean > 0)) return null;
  let v = 0;
  for (const t of ts) v += t.qty * (Number(t.price) - mean) ** 2;
  return (Math.sqrt(v / vol) / mean) * 100;
}

/** Price change between the earlier and later half of the sample (by VWAP), in percent. */
export function trendPct(trades: readonly Trade[]): number | null {
  const ts = trades.filter((t) => t.qty > 0).sort((a, b) => a.at - b.at);
  if (ts.length < 6) return null;
  const mid = Math.floor(ts.length / 2);
  const vw = (xs: readonly Trade[]) => { let v = 0, q = 0; for (const t of xs) { v += Number(t.price) * t.qty; q += t.qty; } return q > 0 ? v / q : null; };
  const a = vw(ts.slice(0, mid)), b = vw(ts.slice(mid));
  return a && b ? ((b - a) / a) * 100 : null;
}

export interface Absorption {
  unitsPerDay: number | null;
  spanHours: number;
  /** "sample" = only the latest trades were available, so the span may be shorter than the 7 days asked for. */
  basis: "none" | "sample";
}
/** Units the market has actually been trading per day over the span the trade sample covers. */
export function dailyAbsorption(trades: readonly Trade[], now: number): Absorption {
  const w = tradeWindow(trades, now, 7 * 86_400_000);
  const spanHours = w.spanMs / 3_600_000;
  if (w.count < 5 || spanHours < 1) return { unitsPerDay: null, spanHours, basis: "none" };
  return { unitsPerDay: (w.volume / spanHours) * 24, spanHours, basis: "sample" };
}

export type SupplyState = "oversupplied" | "balanced" | "undersupplied" | "unknown";
/**
 * Days of supply = units offered at ask / units traded per day. Thresholds are NOT game rules, they are NationScope heuristics:
 * more than 7 days of offers = oversupplied, less than 1 day = undersupplied.
 */
export function supplyState(askQty: number | null, unitsPerDay: number | null): { state: SupplyState; daysOfSupply: number | null } {
  if (askQty === null || unitsPerDay === null || unitsPerDay <= 0) return { state: "unknown", daysOfSupply: null };
  const days = askQty / unitsPerDay;
  return { state: days > 7 ? "oversupplied" : days < 1 ? "undersupplied" : "balanced", daysOfSupply: days };
}

/** Result of selling `units` through some pricing model. */
export interface SaleResult { sold: number; unsold: number; revenue: bigint; avgPrice: bigint | null; model: "instant" | "patient" }

/** Sell immediately into the bid side of the order book. */
export function instantSale(bids: readonly Level[]): (units: number) => SaleResult {
  return (units) => {
    const f = walkBook(bids, units, "bids");
    return { sold: f.filled, unsold: f.shortfall, revenue: f.value, avgPrice: f.avgPrice, model: "instant" };
  };
}
/**
 * Post sell orders at `price` and wait. Only `maxUnits` can realistically sell in the period (market throughput x your assumed share);
 * the rest stays unsold. `maxUnits = null` means throughput is unknown and nothing is capped (flagged by the caller).
 */
export function patientSale(price: bigint | null, maxUnits: number | null): (units: number) => SaleResult {
  return (units) => {
    if (price === null || price <= 0n) return { sold: 0, unsold: Math.max(0, Math.floor(units)), revenue: 0n, avgPrice: null, model: "patient" };
    const want = Math.max(0, Math.floor(units));
    const sold = maxUnits === null ? want : Math.min(want, Math.max(0, Math.floor(maxUnits)));
    return { sold, unsold: want - sold, revenue: price * BigInt(sold), avgPrice: sold > 0 ? price : null, model: "patient" };
  };
}
export { mulBpFloor };
