import type { Evidence } from "./evidence";
import { weakest } from "./evidence";
import { BP, ceilDiv, floorDiv, roundDiv } from "./fixed";
import { evaluatePlan, netOfTax, valuePerPP, type PlanResult, type Taxes } from "./economics";
import { instantSale, patientSale, walkBook, type Level, type SaleResult } from "./market";
import { recipeOf, type Recipe } from "./recipes";
import { recommendAll, type AllowedWage, type ScenarioId, type WageRecommendation } from "./salary";

export interface MarketRowIn { itemCode: string; bestAsk: bigint | null; askQty: number | null; bestBid: bigint | null; bidQty: number | null; last: bigint | null }

/** ---------- Product ranking ---------- */
export interface ProductRank {
  item: string; recipe: Recipe;
  ingredientCost: bigint | null;
  /** Value per PP when selling at the best bid (instant) and at the best ask (patient). null = price missing. */
  vppInstant: bigint | null; vppPatient: bigint | null;
  bestBid: bigint | null; bestAsk: bigint | null; bidQty: number | null; askQty: number | null;
  /** True when the best bid has fewer than `thinDepth` units behind it (heuristic, not a game rule). */
  thin: boolean;
  missing: ("output-price" | "input-price")[];
}
export const THIN_DEPTH_UNITS = 20;

export function ingredientCost(inputs: Readonly<Record<string, number>>, rows: ReadonlyMap<string, MarketRowIn>): bigint | null {
  let total = 0n;
  for (const [item, q] of Object.entries(inputs)) {
    const ask = rows.get(item)?.bestAsk ?? null;
    if (ask === null || ask <= 0n) return null;
    total += ask * BigInt(q);
  }
  return total;
}

export function rankProducts(rows: ReadonlyMap<string, MarketRowIn>, taxes: Pick<Taxes, "marketBp" | "productionBp">, recipes: readonly Recipe[]): ProductRank[] {
  const out: ProductRank[] = [];
  for (const r of recipes) {
    const m = rows.get(r.item); const ing = ingredientCost(r.inputs, rows);
    const missing: ProductRank["missing"] = [];
    if (!m || (m.bestBid === null && m.bestAsk === null)) missing.push("output-price");
    if (ing === null) missing.push("input-price");
    const vpp = (price: bigint | null) => (price !== null && ing !== null ? valuePerPP({ unitPrice: price, ppPerUnit: r.ppPerUnit, ingredientCostPerUnit: ing, taxes }).perPP : null);
    out.push({
      item: r.item, recipe: r, ingredientCost: ing,
      vppInstant: vpp(m?.bestBid ?? null), vppPatient: vpp(m?.bestAsk ?? m?.last ?? null),
      bestBid: m?.bestBid ?? null, bestAsk: m?.bestAsk ?? null, bidQty: m?.bidQty ?? null, askQty: m?.askQty ?? null,
      thin: (m?.bidQty ?? 0) < THIN_DEPTH_UNITS, missing,
    });
  }
  // Rank by what you can actually get today (instant); items without a price go last.
  return out.sort((a, b) => (a.vppInstant === null ? 1 : 0) - (b.vppInstant === null ? 1 : 0) || (a.vppInstant === b.vppInstant ? 0 : (a.vppInstant ?? 0n) > (b.vppInstant ?? 0n) ? -1 : 1));
}

/** ---------- Company analysis ---------- */
export type SellMode = "instant" | "patient";
export interface AnalysisInput {
  item: string;
  ppPerUnit: number;
  inputs: Readonly<Record<string, number>>;
  rows: ReadonlyMap<string, MarketRowIn>;
  /** Bid levels of the output item (order book). When null the best bid alone (with bidQty) is used. */
  bids: readonly Level[] | null;
  vwap7d: bigint | null;
  /** Market throughput of the output item (units/day) or null if unknown. */
  unitsPerDay: number | null;
  /** Share of that throughput you assume you can sell (percent). */
  absorbSharePct: number;
  taxes: Taxes;
  offersNet: readonly bigint[];
  allowed: AllowedWage | null;
  hiredPPPerDay: bigint;
  ownPPPerDay: bigint;
  sellMode: SellMode;
  capPctOverride?: Partial<Record<ScenarioId, number>>;
  /** Whole PP a worker adds per shift incl. company bonus, for worker-income display. */
  workerPPPerShift: number | null;
  workerShiftsPerDay: number | null;
  bonusPct: number;
  evidence: { prices: Evidence; wages: Evidence; skill: Evidence; taxes: Evidence; recipe: Evidence };
}
export interface Outcome { rec: WageRecommendation; plan: PlanResult; workerNetPerShift: bigint | null; workerNetPerDay: bigint | null }
export interface Analysis {
  ok: boolean;
  problems: ("no-output-price" | "no-input-price" | "no-plan-volume")[];
  ingredientPerUnit: bigint | null;
  /** Average price used to value the plan under the chosen sell mode. */
  referencePrice: bigint | null;
  vpp: bigint | null;
  outcomes: Outcome[];
  /** Units the plan would produce after production tax, and what the market book can take immediately. */
  unitsPlanned: number;
  depthCovers: boolean | null;
  confidence: Evidence;
  notes: string[];
}

export function analyzeCompany(i: AnalysisInput): Analysis {
  const notes: string[] = []; const problems: Analysis["problems"] = [];
  const ing = ingredientCost(i.inputs, i.rows);
  const out = i.rows.get(i.item) ?? null;
  const bidLevels: Level[] = i.bids && i.bids.length ? [...i.bids] : out?.bestBid != null && (out.bidQty ?? 0) > 0 ? [{ price: out.bestBid, qty: out.bidQty ?? 0 }] : [];
  if (i.bids === null || i.bids.length === 0) notes.push("book-fallback-best-bid");
  const ppTotal = i.hiredPPPerDay + i.ownPPPerDay;
  const unitsProduced = Number(floorDiv(ppTotal, BigInt(i.ppPerUnit)));
  const unitsPlanned = Number(floorDiv(BigInt(unitsProduced) * (BP - i.taxes.productionBp), BP));
  if (ing === null) problems.push("no-input-price");
  if (ppTotal <= 0n) problems.push("no-plan-volume");

  const askRef = out?.bestAsk ?? out?.last ?? null;
  let sell: (u: number) => SaleResult; let reference: bigint | null;
  if (i.sellMode === "instant") {
    sell = instantSale(bidLevels);
    const w = walkBook(bidLevels, Math.max(1, unitsPlanned), "bids");
    reference = w.avgPrice;
  } else {
    const cap = i.unitsPerDay === null ? null : (i.unitsPerDay * i.absorbSharePct) / 100;
    sell = patientSale(askRef, cap);
    reference = askRef;
    if (cap === null) notes.push("absorption-unknown");
  }
  if (reference === null) problems.push("no-output-price");
  if (problems.length) return { ok: false, problems, ingredientPerUnit: ing, referencePrice: reference, vpp: null, outcomes: [], unitsPlanned, depthCovers: null, confidence: "assumption", notes };

  const vpp = valuePerPP({ unitPrice: reference!, ppPerUnit: i.ppPerUnit, ingredientCostPerUnit: ing!, taxes: i.taxes }).perPP;
  const recs = recommendAll({ offersNet: i.offersNet, incomeBp: i.taxes.incomeBp, breakEven: vpp, allowed: i.allowed, ...(i.capPctOverride ? { capPctOverride: i.capPctOverride } : {}) });
  const outcomes: Outcome[] = recs.map((rec) => {
    const plan = evaluatePlan({ ppHired: i.hiredPPPerDay, ppOwn: i.ownPPPerDay, wage: rec.wage, ppPerUnit: i.ppPerUnit, ingredientCostPerUnit: ing!, taxes: i.taxes, sell });
    const net = netOfTax(rec.wage, i.taxes.incomeBp);
    const shift = i.workerPPPerShift === null ? null : roundDiv(BigInt(Math.round(i.workerPPPerShift * (100 + i.bonusPct))) * net, 100n);
    return { rec, plan, workerNetPerShift: shift, workerNetPerDay: shift !== null && i.workerShiftsPerDay !== null ? shift * BigInt(i.workerShiftsPerDay) : null };
  });
  const depthCovers = i.sellMode === "instant" ? walkBook(bidLevels, unitsPlanned, "bids").shortfall === 0 : null;
  const ev: Evidence[] = [i.evidence.prices, i.evidence.wages, i.evidence.taxes, i.evidence.recipe, ...(i.workerPPPerShift !== null ? [i.evidence.skill] : [])];
  return { ok: true, problems: [], ingredientPerUnit: ing, referencePrice: reference, vpp, outcomes, unitsPlanned, depthCovers, confidence: weakest(ev), notes };
}

export { recipeOf, ceilDiv };

/** Capital-aware: how many PP of work can be paid for (wages + ingredients) with `capital` gold. */
export function affordablePP(capital: bigint, wage: bigint, ppPerUnit: number, ingredientPerUnit: bigint): bigint {
  // cost per PP = wage + ingredients per unit / PP per unit (rounded up so the answer never overspends)
  const perPPx = wage * BigInt(ppPerUnit) + ingredientPerUnit; // cost of one unit's worth of PP (ppPerUnit PP)
  if (perPPx <= 0n) return 0n;
  return floorDiv(capital * BigInt(ppPerUnit), perPPx);
}
