import type { Evidence } from "./evidence";
import { BP, floorDiv, roundDiv } from "./fixed";
import { ingredientCost, type MarketRowIn } from "./engine";
import { valuePerPP, type Taxes } from "./economics";
import type { Recipe } from "./recipes";
import type { Trade } from "./market";

/** Cross-product activity taken from ONE sample of the latest trades of all items. */
export interface Activity { units: number; trades: number }
export interface ActivitySample { byItem: ReadonlyMap<string, Activity>; spanHours: number; tradeCount: number }

export function activityFromTrades(rows: readonly { itemCode: string; qty: number; at: number }[], now: number): ActivitySample {
  const byItem = new Map<string, Activity>(); let oldest = now, n = 0;
  for (const r of rows) {
    if (!(r.qty > 0) || !Number.isFinite(r.at) || r.at > now) continue;
    const a = byItem.get(r.itemCode) ?? { units: 0, trades: 0 };
    a.units += Math.floor(r.qty); a.trades += 1; byItem.set(r.itemCode, a); n++;
    if (r.at < oldest) oldest = r.at;
  }
  return { byItem, spanHours: n ? (now - oldest) / 3_600_000 : 0, tradeCount: n };
}
export const unitsPerDay = (s: ActivitySample, item: string): number | null => {
  const a = s.byItem.get(item);
  if (s.tradeCount < 20 || s.spanHours < 1) return null; // too little to say anything
  return ((a?.units ?? 0) / s.spanHours) * 24;
};

export type Signal =
  | "thin-depth"        // fewer than THIN units behind the best bid (heuristic)
  | "no-bids"           // nobody is buying right now: only patient selling exists
  | "wide-spread"       // ask more than 30% above bid (heuristic)
  | "no-recent-trades"  // the trade sample contains no trade of this item
  | "inferred-recipe"   // item code matched to the wiki by meaning
  | "wage-above-value"  // the going wage already exceeds what a point is worth
  | "no-wage-data";
export const THIN_UNITS = 20;
export const WIDE_SPREAD_PCT = 30;

export interface OppInput {
  rows: ReadonlyMap<string, MarketRowIn>;
  taxes: Pick<Taxes, "marketBp" | "productionBp">;
  recipes: readonly Recipe[];
  /** Gross wage per PP workers currently get (median of the game's allowed-wage band). */
  referenceWage: bigint | null;
  activity: ActivitySample | null;
  /** PP per day the player can supply (workers x shifts x PP), if known. */
  capacityPP: bigint | null;
  capital: bigint | null;
}
export interface Opportunity {
  item: string; recipe: Recipe;
  ingredientCost: bigint | null;
  vppInstant: bigint | null; vppPatient: bigint | null;
  /** Value per PP minus the reference wage: what is left per PP after paying workers the going rate. */
  headroom: bigint | null;
  /** Units the VISIBLE best bid can take (the order book beyond it was not read for this item). */
  visibleDemandUnits: number | null;
  /** PP that visible demand could absorb, and the PP of the plan (min of that and your capacity). */
  absorbablePP: bigint | null; planPP: bigint | null;
  /** Gold per day if you produced `planPP` and sold it into the visible bids, paying the reference wage. */
  dailyProfit: bigint | null;
  /** Gold to fund `planPP` of work (wages + ingredients) at the reference wage. */
  startCost: bigint | null;
  affordable: boolean | null;
  marketUnitsPerDay: number | null;
  signals: Signal[];
  evidence: { price: Evidence; wage: Evidence; recipe: Evidence };
}

export function findOpportunities(i: OppInput): Opportunity[] {
  const out: Opportunity[] = [];
  for (const r of i.recipes) {
    const m = i.rows.get(r.item) ?? null; const ing = ingredientCost(r.inputs, i.rows);
    const vpp = (p: bigint | null) => (p !== null && ing !== null ? valuePerPP({ unitPrice: p, ppPerUnit: r.ppPerUnit, ingredientCostPerUnit: ing, taxes: i.taxes }).perPP : null);
    const vInst = vpp(m?.bestBid ?? null), vPat = vpp(m?.bestAsk ?? m?.last ?? null);
    const signals: Signal[] = [];
    if (r.mapping === "inferred") signals.push("inferred-recipe");
    const bid = m?.bestBid ?? null, ask = m?.bestAsk ?? null;
    if (bid === null) signals.push("no-bids");
    else if ((m?.bidQty ?? 0) < THIN_UNITS) signals.push("thin-depth");
    if (bid !== null && ask !== null && ask > 0n && (ask - bid) * 100n > ask * BigInt(WIDE_SPREAD_PCT)) signals.push("wide-spread");
    const perDay = i.activity ? unitsPerDay(i.activity, r.item) : null;
    if (i.activity && i.activity.tradeCount >= 20 && (i.activity.byItem.get(r.item)?.trades ?? 0) === 0) signals.push("no-recent-trades");
    const headroom = vInst !== null && i.referenceWage !== null ? vInst - i.referenceWage : null;
    if (i.referenceWage === null) signals.push("no-wage-data"); else if (headroom !== null && headroom <= 0n) signals.push("wage-above-value");
    const demand = bid !== null ? (m?.bidQty ?? 0) : null;
    const absorbable = demand === null ? null : BigInt(demand) * BigInt(r.ppPerUnit);
    const planPP = absorbable === null ? null : i.capacityPP !== null && i.capacityPP < absorbable ? i.capacityPP : absorbable;
    const profit = headroom !== null && headroom > 0n && planPP !== null ? headroom * planPP : headroom !== null && planPP !== null ? 0n : null;
    const start = ing !== null && i.referenceWage !== null && planPP !== null ? i.referenceWage * planPP + floorDiv(planPP * ing, BigInt(r.ppPerUnit)) : null;
    out.push({
      item: r.item, recipe: r, ingredientCost: ing, vppInstant: vInst, vppPatient: vPat, headroom, visibleDemandUnits: demand, absorbablePP: absorbable, planPP,
      dailyProfit: profit, startCost: start, affordable: i.capital !== null && start !== null ? start <= i.capital : null,
      marketUnitsPerDay: perDay, signals,
      evidence: { price: "live", wage: i.referenceWage === null ? "assumption" : "live", recipe: r.mapping },
    });
  }
  // Rank by the gold you could actually earn from visible demand; items with no number go last, ties by value per PP.
  const key = (o: Opportunity) => o.dailyProfit ?? -1n;
  return out.sort((a, b) => (key(a) === key(b) ? ((b.vppInstant ?? -(10n ** 12n)) > (a.vppInstant ?? -(10n ** 12n)) ? 1 : -1) : key(a) > key(b) ? -1 : 1));
}
export const shareOf = (part: bigint, whole: bigint): number => (whole > 0n ? Number(roundDiv(part * BP, whole)) / 100 : 0);
export type { Trade };
