import type { EngineContext, ItemJson, MarketRowJson } from "./data/context";
import { readCompany, storeNearFull, type CompanyState } from "./domain/company";
import { evaluatePlan, netOfTax, valuePerPP, type PlanResult, type Taxes } from "./domain/economics";
import { affordablePP, analyzeCompany, type Analysis, type MarketRowIn, type SellMode } from "./domain/engine";
import type { Evidence } from "./domain/evidence";
import { parseGoldDecimal, pctToBp, roundDiv } from "./domain/fixed";
import { dailyAbsorption, instantSale, patientSale, supplyState, tradeWindow, trendPct, volatilityPct, type Level, type SupplyState, type Trade } from "./domain/market";
import { recipeOf } from "./domain/recipes";
import type { ScenarioId } from "./domain/salary";
import { levelOf, maxEnergy, productionPerShift, sustainedShiftsPerDay } from "./domain/skills";
import { upgradeRoi, type UpgradeRoi } from "./domain/upgrades";

export interface Controls {
  workers: number;
  ownPPPerDay: number;
  sellMode: SellMode;
  absorbSharePct: number;
  /** What-if: shift the output item's market prices by this percent (-50..+100). */
  priceShiftPct: number;
  caps: Record<ScenarioId, number>;
  customWage: string;
  capital: string;
}
export const DEFAULT_CAPS: Record<ScenarioId, number> = { conservative: 60, balanced: 75, competitive: 90 };

export const toRows = (rows: readonly MarketRowJson[]): Map<string, MarketRowIn> =>
  new Map(rows.map((r) => [r.itemCode, { itemCode: r.itemCode, bestAsk: r.bestAsk === null ? null : BigInt(r.bestAsk), askQty: r.askQty, bestBid: r.bestBid === null ? null : BigInt(r.bestBid), bidQty: r.bidQty, last: r.last === null ? null : BigInt(r.last) }]));

const shiftPrice = (p: bigint | null, pct: number): bigint | null => (p === null ? null : roundDiv(p * BigInt(100 + pct), 100n));

export interface MarketFacts {
  vwap7d: bigint | null; tradeCount: number; unitsPerDay: number | null; spanHours: number;
  supply: SupplyState; daysOfSupply: number | null; volatilityPct: number | null; trendPct: number | null;
  askQty: number | null; bidQty: number | null; bookLevels: number; bookEvidence: Evidence | null;
}
export interface Custom { wage: bigint; plan: PlanResult; netWagePerPP: bigint }
export interface CompanyView {
  state: CompanyState;
  analysis: Analysis;
  custom: Custom | null;
  upgrades: UpgradeRoi[];
  market: MarketFacts;
  workers: { count: number; shiftsPerDay: number; ppPerShift: number; ppPerShiftWithBonus: number; hiredPPPerDay: bigint; skillLevel: number | null; skillEvidence: Evidence; energyLevel: number | null };
  taxes: Taxes & { marketEvidence: Evidence };
  affordablePP: bigint | null;
  nearFull: boolean | null;
}

export function companyView(ctx: EngineContext, raw: unknown, c: Controls, nowMs: number): CompanyView | null {
  const st = readCompany(raw); if (!st) return null;
  const recipe = recipeOf(st.itemCode);
  const ppPerUnit = st.ppPerUnit ?? recipe?.ppPerUnit ?? null;
  const inputs = Object.keys(st.needs).length ? st.needs : recipe?.inputs ?? {};
  if (ppPerUnit === null) return null;
  const marketOk = ctx.market.state === "ok";
  const rows = toRows(marketOk ? (ctx.market as { value: MarketRowJson[] }).value : []);
  const o = rows.get(st.itemCode);
  if (o) rows.set(st.itemCode, { ...o, bestAsk: shiftPrice(o.bestAsk, c.priceShiftPct), bestBid: shiftPrice(o.bestBid, c.priceShiftPct), last: shiftPrice(o.last, c.priceShiftPct) });

  const itemSlot = ctx.items[st.itemCode]; const item: ItemJson | null = itemSlot?.state === "ok" ? itemSlot.value : null;
  const bids: Level[] | null = item && item.bids.length ? item.bids.map(([p, q]) => ({ price: shiftPrice(BigInt(p), c.priceShiftPct)!, qty: q })) : null;
  const trades: Trade[] = item ? item.trades.map(([p, q, at]) => ({ price: BigInt(p), qty: q, at })) : [];
  const win = tradeWindow(trades, nowMs, 7 * 86_400_000), abs = dailyAbsorption(trades, nowMs);
  const sup = supplyState(rows.get(st.itemCode)?.askQty ?? null, abs.unitsPerDay);

  const taxSlot = ctx.taxes?.state === "ok" ? ctx.taxes : null;
  const marketPct = taxSlot?.value.marketPct ?? null;
  const taxes: Taxes = { marketBp: marketPct === null ? 0n : pctToBp(marketPct), productionBp: st.productionTaxBp ?? 0n, incomeBp: st.incomeBp ?? 0n };

  const playerSlot = ctx.player?.state === "ok" ? ctx.player : null;
  const skillLevel = playerSlot ? levelOf(playerSlot.value.skills, "production") : null;
  const energyLevel = playerSlot ? levelOf(playerSlot.value.skills, "energy") : null;
  const base = productionPerShift(skillLevel ?? 0);
  const skillEvidence: Evidence = skillLevel === null ? "assumption" : "inferred";
  const ppShift = base.value, ppShiftBonus = Math.round((ppShift * (100 + st.bonusTotalPct)) / 100);
  const shifts = sustainedShiftsPerDay(maxEnergy(energyLevel ?? 0).value);
  const workers = Math.max(0, Math.floor(c.workers));
  const hired = BigInt(workers * shifts * ppShiftBonus);

  const jobs = ctx.jobs.state === "ok" ? ctx.jobs : null;
  const allowed = jobs?.value.allowed ? { min: BigInt(jobs.value.allowed.min), max: BigInt(jobs.value.allowed.max), median: BigInt(jobs.value.allowed.median) } : null;
  const weak = (e: Evidence | undefined): Evidence => e ?? "assumption";
  const analysis = analyzeCompany({
    item: st.itemCode, ppPerUnit, inputs, rows, bids, vwap7d: win.vwap, unitsPerDay: abs.unitsPerDay, absorbSharePct: c.absorbSharePct, taxes,
    offersNet: jobs ? jobs.value.offersNet.map((x) => BigInt(x)) : [], allowed, hiredPPPerDay: hired, ownPPPerDay: BigInt(Math.max(0, Math.floor(c.ownPPPerDay))),
    sellMode: c.sellMode, capPctOverride: c.caps, workerPPPerShift: ppShift, workerShiftsPerDay: shifts, bonusPct: st.bonusTotalPct,
    evidence: {
      prices: c.priceShiftPct !== 0 ? "user" : weak(ctx.market.state === "ok" ? ctx.market.evidence : undefined), wages: weak(jobs?.evidence),
      skill: skillEvidence === "assumption" ? "assumption" : "inferred", taxes: marketPct === null ? "assumption" : weak(taxSlot?.evidence),
      recipe: st.ppPerUnit !== null ? "live" : recipe?.mapping ?? "assumption",
    },
  });

  let custom: Custom | null = null;
  const cw = c.customWage.trim() === "" ? null : parseGoldDecimal(c.customWage);
  if (cw !== null && analysis.ok) {
    const rowsOut = rows.get(st.itemCode);
    const bidLevels: Level[] = bids ?? (rowsOut?.bestBid != null && (rowsOut.bidQty ?? 0) > 0 ? [{ price: rowsOut.bestBid, qty: rowsOut.bidQty ?? 0 }] : []);
    const cap = abs.unitsPerDay === null ? null : (abs.unitsPerDay * c.absorbSharePct) / 100;
    const sell = c.sellMode === "instant" ? instantSale(bidLevels) : patientSale(rowsOut?.bestAsk ?? rowsOut?.last ?? null, cap);
    custom = { wage: cw, netWagePerPP: netOfTax(cw, taxes.incomeBp), plan: evaluatePlan({ ppHired: hired, ppOwn: BigInt(Math.max(0, Math.floor(c.ownPPPerDay))), wage: cw, ppPerUnit, ingredientCostPerUnit: analysis.ingredientPerUnit ?? 0n, taxes, sell }) };
  }

  const steel = rows.get("steel")?.bestAsk ?? null;
  const near = storeNearFull(st, nowMs);
  const upgrades = st.upgrades.flatMap((u) => { const r = upgradeRoi(u, { steelAsk: steel, resourceAsk: u.next ? rows.get(u.next.constructionResource)?.bestAsk ?? null : null }, analysis.vpp, near); return r ? [r] : []; });
  const capital = parseGoldDecimal(c.capital);
  const bal = analysis.outcomes.find((x) => x.rec.id === "balanced");
  const aff = capital !== null && bal && analysis.ingredientPerUnit !== null ? affordablePP(capital, bal.rec.wage, ppPerUnit, analysis.ingredientPerUnit) : null;

  return {
    state: st, analysis, custom, upgrades, nearFull: near, affordablePP: aff,
    market: { vwap7d: win.vwap, tradeCount: win.count, unitsPerDay: abs.unitsPerDay, spanHours: abs.spanHours, supply: sup.state, daysOfSupply: sup.daysOfSupply, volatilityPct: volatilityPct(trades), trendPct: trendPct(trades), askQty: rows.get(st.itemCode)?.askQty ?? null, bidQty: rows.get(st.itemCode)?.bidQty ?? null, bookLevels: item?.bookDepthLevels ?? 0, bookEvidence: itemSlot?.state === "ok" ? itemSlot.evidence : null },
    workers: { count: workers, shiftsPerDay: shifts, ppPerShift: ppShift, ppPerShiftWithBonus: ppShiftBonus, hiredPPPerDay: hired, skillLevel, skillEvidence, energyLevel },
    taxes: { ...taxes, marketEvidence: marketPct === null ? "assumption" : weak(taxSlot?.evidence) },
  };
}
export { valuePerPP };
