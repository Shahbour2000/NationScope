import type { Company, FloorRow, JobOffer, MarketRow, StatsRow, Trade } from "@/lib/domain/economy";
import type { Alliance, Country, War } from "@/lib/domain/world";

/** All money stays BigInt (1/10,000 gold). Every function here is a CALCULATION from API rows; the UI labels them as such. */

export interface MarketView {
  itemCode: string;
  ask: bigint | null; bid: bigint | null; last: bigint | null;
  askQty: number; bidQty: number;
  /** (ask - bid) / bid in basis points, truncated; null unless both sides exist. */
  spreadBps: number | null;
  /** (ask - last) / last in basis points; null without both. */
  askVsLastBps: number | null;
}

const big = (v: string | null | undefined): bigint | null => (v === null || v === undefined ? null : BigInt(v));
const bps = (num: bigint, den: bigint): number | null => (den > 0n ? Number((num * 10000n) / den) : null);

export function marketView(rows: readonly MarketRow[]): MarketView[] {
  return rows.map((r) => {
    const ask = big(r.bestAsk), bid = big(r.bestBid), last = big(r.last);
    return {
      itemCode: r.itemCode, ask, bid, last, askQty: r.askQty ?? 0, bidQty: r.bidQty ?? 0,
      spreadBps: ask !== null && bid !== null ? bps(ask - bid, bid) : null,
      askVsLastBps: ask !== null && last !== null ? bps(ask - last, last) : null,
    };
  });
}

export interface ItemTrades { itemCode: string; trades: number; qty: number; vwap: bigint; last: bigint; lastAt: string | null; series: { at: string; price: bigint }[] }

/** Volume-weighted average price per item over the supplied trades: sum(price*qty)/sum(qty), rounded half up to 1/10,000 gold. */
export function tradesByItem(trades: readonly Trade[]): ItemTrades[] {
  const groups = new Map<string, Trade[]>();
  for (const t of trades) (groups.get(t.itemCode) ?? groups.set(t.itemCode, []).get(t.itemCode)!).push(t);
  const out: ItemTrades[] = [];
  for (const [itemCode, list] of groups) {
    const asc = [...list].sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""));
    let pq = 0n, q = 0n;
    for (const t of asc) { pq += BigInt(t.price) * BigInt(t.qty); q += BigInt(t.qty); }
    const lastTrade = asc[asc.length - 1]!;
    out.push({
      itemCode, trades: asc.length, qty: Number(q), vwap: q > 0n ? (pq * 2n + q) / (2n * q) : 0n,
      last: BigInt(lastTrade.price), lastAt: lastTrade.createdAt ?? null,
      series: asc.map((t) => ({ at: t.createdAt ?? "", price: BigInt(t.price) })),
    });
  }
  return out.sort((a, b) => b.trades - a.trades || a.itemCode.localeCompare(b.itemCode));
}

export function median(values: readonly bigint[]): bigint | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2n;
}

export interface JobsSummary {
  count: number;
  bestNet: JobOffer | null;
  medianNet: bigint | null;
  byCountry: { countryId: string; offers: number; avgNet: bigint }[];
}

export function jobsSummary(offers: readonly JobOffer[]): JobsSummary {
  const withNet = offers.filter((o) => o.netPerPoint != null);
  const sorted = [...withNet].sort((a, b) => (BigInt(b.netPerPoint!) > BigInt(a.netPerPoint!) ? 1 : BigInt(b.netPerPoint!) < BigInt(a.netPerPoint!) ? -1 : 0));
  const groups = new Map<string, bigint[]>();
  for (const o of withNet) if (o.countryId) (groups.get(o.countryId) ?? groups.set(o.countryId, []).get(o.countryId)!).push(BigInt(o.netPerPoint!));
  const byCountry = [...groups].map(([countryId, v]) => ({ countryId, offers: v.length, avgNet: v.reduce((a, b) => a + b, 0n) / BigInt(v.length) }))
    .sort((a, b) => (b.avgNet > a.avgNet ? 1 : b.avgNet < a.avgNet ? -1 : 0));
  return { count: offers.length, bestNet: sorted[0] ?? null, medianNet: median(withNet.map((o) => BigInt(o.netPerPoint!))), byCountry };
}

export const SLOT_ORDER = ["helmet", "chest", "gloves", "pants", "boots", "weapon"];
export const RARITY_ORDER = ["common", "uncommon", "rare", "epic", "legendary", "mythic"];

export function floorMatrix(rows: readonly FloorRow[]) {
  const cell = new Map<string, FloorRow>();
  for (const r of rows) cell.set(`${r.slot}|${r.rarity}`, r);
  const order = (known: string[], present: string[]) => [...known.filter((k) => present.includes(k)), ...present.filter((p) => !known.includes(p)).sort()];
  return { slots: order(SLOT_ORDER, [...new Set(rows.map((r) => r.slot))]), rarities: order(RARITY_ORDER, [...new Set(rows.map((r) => r.rarity))]), cell };
}

export function coreControl(c: Pick<Country, "coreHeld" | "coreRegions">): { held: number; total: number; pct: number | null } {
  const held = c.coreHeld ?? 0, total = c.coreRegions ?? 0;
  return { held, total, pct: total > 0 ? Math.round((held / total) * 100) : null };
}

/** Elapsed (active) or total (ended) duration of a war in ms; null when the start time is missing. */
export function warDurationMs(w: Pick<War, "declaredAt" | "endedAt">, nowMs: number): number | null {
  if (!w.declaredAt) return null;
  const start = Date.parse(w.declaredAt);
  if (Number.isNaN(start)) return null;
  const end = w.endedAt ? Date.parse(w.endedAt) : nowMs;
  return Number.isNaN(end) ? null : Math.max(0, end - start);
}

export interface StatsShare { itemCode: string; companies: number; workers: number; owners: number; sharePct: number | null }
/** Share of a country's companies per product relative to its own total. Calculated, not an API field. */
export function statsWithShare(rows: readonly StatsRow[], totalCompanies: number): StatsShare[] {
  return rows.map((r) => ({ itemCode: r.itemCode, companies: r.companies, workers: r.workers ?? 0, owners: r.owners ?? 0, sharePct: totalCompanies > 0 ? Math.round((r.companies / totalCompanies) * 1000) / 10 : null }))
    .sort((a, b) => b.companies - a.companies);
}

export function allianceAggregate(alliance: Pick<Alliance, "members">, countries: readonly Country[], wars: readonly War[]) {
  const ids = new Set(alliance.members ?? []);
  const members = countries.filter((c) => ids.has(c.id));
  const sum = (f: (c: Country) => number | null | undefined) => members.reduce((a, c) => a + (f(c) ?? 0), 0);
  const activeWars = wars.filter((w) => w.status === "active" && (ids.has(w.countryA) || ids.has(w.countryB)));
  return {
    members,
    unresolved: [...ids].filter((id) => !members.some((m) => m.id === id)),
    citizens: sum((c) => c.citizens), activeCitizens: sum((c) => c.activeCitizens), regions: sum((c) => c.regions), development: sum((c) => c.development),
    activeWars,
  };
}

export const companyUpgradeTotal = (c: Pick<Company, "storageLevel" | "engineLevel" | "breakRoomLevel">): number => (c.storageLevel ?? 0) + (c.engineLevel ?? 0) + (c.breakRoomLevel ?? 0);

export interface MarketInsights {
  items: number; withAsk: number; withBid: number; noAsk: number;
  /** Median of the available spreads (basis points); null when no item has both sides. */
  medianSpreadBps: number | null;
  /** Items whose lowest ask is furthest above / below the last price (basis points, calculated). */
  askAbove: MarketView[]; askBelow: MarketView[];
}

export function marketInsights(view: readonly MarketView[], top = 5): MarketInsights {
  const spreads = view.map((v) => v.spreadBps).filter((x): x is number => x !== null).sort((a, b) => a - b);
  const mid = Math.floor(spreads.length / 2);
  const medianSpreadBps = spreads.length === 0 ? null : spreads.length % 2 ? spreads[mid]! : Math.trunc((spreads[mid - 1]! + spreads[mid]!) / 2);
  const gaps = view.filter((v) => v.askVsLastBps !== null);
  return {
    items: view.length, withAsk: view.filter((v) => v.ask !== null).length, withBid: view.filter((v) => v.bid !== null).length, noAsk: view.filter((v) => v.ask === null).length,
    medianSpreadBps,
    askAbove: gaps.filter((v) => v.askVsLastBps! > 0).sort((a, b) => b.askVsLastBps! - a.askVsLastBps!).slice(0, top),
    askBelow: gaps.filter((v) => v.askVsLastBps! < 0).sort((a, b) => a.askVsLastBps! - b.askVsLastBps!).slice(0, top),
  };
}
