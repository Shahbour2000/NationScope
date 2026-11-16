import { asRecord } from "./parse";
import { tradeSchema, type Trade } from "./economy";

/**
 * Per-item market responses (GET /market/{item}/orders | history | trades).
 * Only the global trade list has ever been captured (tests/fixtures/real/market-trades.json: id, itemCode, price, qty, currency,
 * buyerType, sellerType, createdAt); the per-item trade list is assumed to use the same row shape. Orders and history have no
 * saved response, so they are read by field-name conventions seen elsewhere in this API (money = digit string in 1/10,000 gold).
 * Every reader returns null/[] when it does not recognise the response, and the page then shows the data as returned.
 */
const MONEY = /^\d+$/;
const firstArray = (raw: unknown, keys: readonly string[]): unknown[] | null => {
  if (Array.isArray(raw)) return raw;
  const o = asRecord(raw);
  for (const k of keys) if (Array.isArray(o[k])) return o[k] as unknown[];
  return null;
};
const moneyOf = (v: unknown): { v: bigint; raw: boolean } | null => {
  if (typeof v === "string" && MONEY.test(v)) return { v: BigInt(v), raw: false };
  if (typeof v === "number" && Number.isFinite(v) && v >= 0 && Number.isInteger(v)) return { v: BigInt(v), raw: true };
  return null;
};
const numOf = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && /^\d+$/.test(v) ? Number(v) : null);

export function readTrades(raw: unknown): { rows: Trade[]; skipped: number; shapeOk: boolean } {
  const list = firstArray(raw, ["trades", "items", "rows", "data"]);
  if (!list) return { rows: [], skipped: 0, shapeOk: false };
  const rows: Trade[] = []; let skipped = 0;
  for (const x of list) { const r = tradeSchema.safeParse(x); if (r.success) rows.push(r.data); else skipped++; }
  rows.sort((a, b) => (Date.parse(b.createdAt ?? "") || 0) - (Date.parse(a.createdAt ?? "") || 0));
  return { rows, skipped, shapeOk: skipped === 0 || rows.length > 0 };
}

export interface TradeStats { count: number; volume: number; last: bigint; high: bigint; low: bigint; vwap: bigint | null; value: bigint }
export function tradeStats(rows: readonly Trade[]): TradeStats | null {
  if (rows.length === 0) return null;
  let volume = 0, value = 0n, high = -1n, low = -1n;
  for (const t of rows) {
    const p = BigInt(t.price);
    volume += t.qty; value += p * BigInt(Math.max(0, Math.trunc(t.qty)));
    if (high < 0n || p > high) high = p;
    if (low < 0n || p < low) low = p;
  }
  return { count: rows.length, volume, last: BigInt(rows[0]!.price), high, low, value, vwap: volume > 0 ? value / BigInt(Math.trunc(volume)) : null };
}

export interface Level { price: bigint; qty: number }
export interface OrderBook { buys: Level[]; sells: Level[]; rawUnits: boolean }
const BUY_KEYS = ["buy", "buys", "bids", "buyOrders", "bid"], SELL_KEYS = ["sell", "sells", "asks", "sellOrders", "ask"];
const BUY_SIDE = new Set(["buy", "bid", "buys", "bids"]), SELL_SIDE = new Set(["sell", "ask", "sells", "asks"]);

function levels(list: unknown[] | null): { rows: Level[]; raw: boolean } {
  const rows: Level[] = []; let raw = false;
  for (const x of list ?? []) {
    const o = asRecord(x);
    const p = moneyOf(o.price ?? o.unitPrice);
    const q = numOf(o.qty ?? o.quantity ?? o.amount ?? o.remaining);
    if (!p || q === null) continue;
    if (p.raw) raw = true;
    rows.push({ price: p.v, qty: q });
  }
  return { rows, raw };
}

/** Recognises {buy|bids:[…], sell|asks:[…]} or a flat list with a `side` field. Returns null when neither side can be read. */
export function readOrderBook(raw: unknown): OrderBook | null {
  const o = asRecord(raw);
  let buyList: unknown[] | null = null, sellList: unknown[] | null = null;
  for (const k of BUY_KEYS) if (Array.isArray(o[k])) { buyList = o[k] as unknown[]; break; }
  for (const k of SELL_KEYS) if (Array.isArray(o[k])) { sellList = o[k] as unknown[]; break; }
  if (!buyList && !sellList) {
    const flat = firstArray(raw, ["orders", "items", "rows"]);
    if (flat) {
      buyList = flat.filter((x) => BUY_SIDE.has(String(asRecord(x).side ?? asRecord(x).type ?? "").toLowerCase()));
      sellList = flat.filter((x) => SELL_SIDE.has(String(asRecord(x).side ?? asRecord(x).type ?? "").toLowerCase()));
    }
  }
  if (!buyList && !sellList) return null;
  const b = levels(buyList), s = levels(sellList);
  if (b.rows.length === 0 && s.rows.length === 0 && ((buyList?.length ?? 0) + (sellList?.length ?? 0)) > 0) return null;
  return { buys: b.rows.sort((x, y) => (x.price === y.price ? 0 : x.price > y.price ? -1 : 1)), sells: s.rows.sort((x, y) => (x.price === y.price ? 0 : x.price < y.price ? -1 : 1)), rawUnits: b.raw || s.raw };
}

export interface BookStats { bestBid: bigint | null; bestAsk: bigint | null; spread: bigint | null; spreadPct: number | null; bidDepth: number; askDepth: number }
export function bookStats(b: OrderBook): BookStats {
  const bestBid = b.buys[0]?.price ?? null, bestAsk = b.sells[0]?.price ?? null;
  const spread = bestBid !== null && bestAsk !== null ? bestAsk - bestBid : null;
  return {
    bestBid, bestAsk, spread,
    spreadPct: spread !== null && bestAsk !== null && bestAsk > 0n ? Number((spread * 10000n) / bestAsk) / 100 : null,
    bidDepth: b.buys.reduce((a, x) => a + x.qty, 0), askDepth: b.sells.reduce((a, x) => a + x.qty, 0),
  };
}
/** Cumulative quantity per level, in the order given (best price first). */
export const cumulative = (ls: readonly Level[]): number[] => { let a = 0; return ls.map((l) => (a += l.qty)); };

export interface HistoryPoint { at: string; price: bigint; volume: number | null }
export interface History { points: HistoryPoint[]; rawUnits: boolean }
const TIME_KEYS = ["at", "time", "t", "ts", "hour", "bucket", "date", "periodStart", "createdAt", "timestamp"];
const PRICE_KEYS = ["close", "avg", "average", "avgPrice", "price", "last", "vwap", "open"];
const VOL_KEYS = ["volume", "qty", "vol", "quantity"];

/** Recognises a list of {time, price|close|avg, volume?} rows (also wrapped under points/history/candles). Null when no row has both a time and a price. */
export function readHistory(raw: unknown): History | null {
  const list = firstArray(raw, ["points", "history", "candles", "items", "rows", "data", "prices"]);
  if (!list) return null;
  const points: HistoryPoint[] = []; let rawUnits = false;
  for (const x of list) {
    const o = asRecord(x);
    const tk = TIME_KEYS.find((k) => o[k] != null), pk = PRICE_KEYS.find((k) => moneyOf(o[k]) !== null);
    if (!tk || !pk) continue;
    const tv = o[tk];
    const ms = typeof tv === "string" ? Date.parse(tv) : typeof tv === "number" ? (tv < 1e12 ? tv * 1000 : tv) : NaN;
    if (!Number.isFinite(ms)) continue;
    const p = moneyOf(o[pk])!; if (p.raw) rawUnits = true;
    const vk = VOL_KEYS.find((k) => numOf(o[k]) !== null);
    points.push({ at: new Date(ms).toISOString(), price: p.v, volume: vk ? numOf(o[vk]) : null });
  }
  if (points.length === 0) return null;
  points.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  return { points, rawUnits };
}

export interface HistoryStats { first: bigint; last: bigint; high: bigint; low: bigint; changePct: number | null; volume: number | null }
export function historyStats(h: History): HistoryStats {
  const ps = h.points.map((p) => p.price);
  const first = ps[0]!, last = ps[ps.length - 1]!;
  const vols = h.points.map((p) => p.volume).filter((v): v is number => v !== null);
  return { first, last, high: ps.reduce((a, b) => (b > a ? b : a)), low: ps.reduce((a, b) => (b < a ? b : a)), changePct: first > 0n ? Number(((last - first) * 10000n) / first) / 100 : null, volume: vols.length ? vols.reduce((a, b) => a + b, 0) : null };
}

/** True when the response is (or wraps) a list with no entries: "nothing returned", distinct from "format not recognised". */
export const isEmptyList = (raw: unknown): boolean => firstArray(raw, ["points", "history", "candles", "items", "rows", "data", "prices", "trades", "orders"])?.length === 0;
