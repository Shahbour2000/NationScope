import { ceilDiv } from "./fixed";

export interface UpgradeNext { level: number; steelCost: number; constructionCost: number; constructionResource: string; stats: Record<string, number> }
export interface UpgradeRow { code: string; level: number; maxLevel: number; stats: Record<string, number>; next: UpgradeNext | null; downgradeRefundSteel: number | null }

const rec = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const nums = (v: unknown): Record<string, number> => { const o: Record<string, number> = {}; for (const [k, x] of Object.entries(rec(v))) if (typeof x === "number" && Number.isFinite(x)) o[k] = x; return o; };
const int = (v: unknown): number | null => (typeof v === "number" && Number.isInteger(v) && v >= 0 ? v : null);

export function readUpgrades(raw: unknown): UpgradeRow[] {
  if (!Array.isArray(raw)) return [];
  const out: UpgradeRow[] = [];
  for (const x of raw) {
    const o = rec(x); const level = int(o.level), maxLevel = int(o.maxLevel);
    if (typeof o.code !== "string" || level === null || maxLevel === null) continue;
    const n = rec(o.next); const nl = int(n.level), steel = int(n.steelCost), cons = int(n.constructionCost);
    const next: UpgradeNext | null = nl !== null && steel !== null && cons !== null && typeof n.constructionResource === "string"
      ? { level: nl, steelCost: steel, constructionCost: cons, constructionResource: n.constructionResource, stats: nums(n.stats) } : null;
    out.push({ code: o.code, level, maxLevel, stats: nums(o.stats), next, downgradeRefundSteel: int(o.downgradeRefundSteel) });
  }
  return out;
}

export interface UpgradePrices { steelAsk: bigint | null; resourceAsk: bigint | null }
export interface UpgradeRoi {
  code: string; fromLevel: number; toLevel: number;
  /** Gold to buy the materials on the market at the best ask (null if a price is missing). */
  cost: bigint | null;
  /** Extra PP per day (automation) or extra PP of capacity (storage). */
  gain: number;
  /** Automation only: gold per day the extra PP are worth (extra PP x value per PP). */
  valuePerDay: bigint | null;
  paybackDays: number | null;
  /** Storage only: is the store full or close to full (otherwise more capacity earns nothing today). */
  binding: boolean | null;
}
export function upgradeCost(u: UpgradeNext, p: UpgradePrices): bigint | null {
  if (p.steelAsk === null || p.resourceAsk === null) return null;
  return p.steelAsk * BigInt(u.steelCost) + p.resourceAsk * BigInt(u.constructionCost);
}
/**
 * Automation ROI (engine PP are free of wages):  gain = dailyProd(next) - dailyProd(now);  valuePerDay = gain x VPP;  payback = cost / valuePerDay.
 * Assumes engine PP receive no bonus (unverified) and sell at today's value per PP. Storage ROI is only informational: it shows the cost and whether the store is binding.
 */
export function upgradeRoi(u: UpgradeRow, p: UpgradePrices, vppPerPP: bigint | null, storeNearFull: boolean | null): UpgradeRoi | null {
  if (!u.next) return null;
  const cost = upgradeCost(u.next, p);
  if (u.code === "automatedEngine") {
    const gain = (u.next.stats.dailyProd ?? NaN) - (u.stats.dailyProd ?? NaN);
    if (!Number.isFinite(gain) || gain <= 0) return null;
    const valuePerDay = vppPerPP === null ? null : vppPerPP * BigInt(Math.round(gain));
    const paybackDays = cost !== null && valuePerDay !== null && valuePerDay > 0n ? Number(ceilDiv(cost * 100n, valuePerDay)) / 100 : null;
    return { code: u.code, fromLevel: u.level, toLevel: u.next.level, cost, gain, valuePerDay, paybackDays, binding: null };
  }
  if (u.code === "storage") {
    const gain = (u.next.stats.maxProduction ?? NaN) - (u.stats.maxProduction ?? NaN);
    if (!Number.isFinite(gain) || gain <= 0) return null;
    return { code: u.code, fromLevel: u.level, toLevel: u.next.level, cost, gain, valuePerDay: null, paybackDays: null, binding: storeNearFull };
  }
  return null; // e.g. break room: effect not documented
}
