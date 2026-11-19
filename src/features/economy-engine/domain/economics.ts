import { BP, afterRate, ceilDiv, floorDiv, mulBpFloor, roundDiv } from "./fixed";
import type { SaleResult } from "./market";

export interface Taxes {
  /** Market tax, paid by the seller (percent of sale value). */
  marketBp: bigint;
  /** Production tax: share of produced units taken at Produce. */
  productionBp: bigint;
  /** Income tax on wages, in basis points (offers show gross and net). */
  incomeBp: bigint;
}
export const NO_TAXES: Taxes = { marketBp: 0n, productionBp: 0n, incomeBp: 0n };

/** Worker's net per PP given the employer's gross: the API floors the tax (jobs sample: 1,450 at 5% -> tax 72, net 1,378). */
export function netOfTax(gross: bigint, incomeBp: bigint): bigint { return gross - mulBpFloor(gross, incomeBp); }
/** Smallest gross wage whose net (after floored tax) reaches `net`. */
export function grossForNet(net: bigint, incomeBp: bigint): bigint {
  if (incomeBp >= BP) throw new RangeError("Income tax must be below 100%.");
  let g = ceilDiv(net * BP, BP - incomeBp);
  while (netOfTax(g, incomeBp) < net) g += 1n;
  while (g > 0n && netOfTax(g - 1n, incomeBp) >= net) g -= 1n;
  return g;
}

export interface ValueInput {
  /** Price of one unit of the product (gold 1/10,000). */
  unitPrice: bigint;
  ppPerUnit: number;
  /** Cost of the inputs consumed to make ONE unit. */
  ingredientCostPerUnit: bigint;
  taxes: Pick<Taxes, "marketBp" | "productionBp">;
}
export interface ValuePerPP {
  /** Revenue per produced unit after production tax and market tax. */
  netRevenuePerUnit: bigint;
  /** Margin over ingredients per produced unit, before any labour cost. */
  valuePerUnit: bigint;
  /** Gold (1/10,000) one production point is worth. It is also the break-even wage (gross, per PP). */
  perPP: bigint;
}
/**
 * VPP = ( P x (1 - t_prod) x (1 - t_market) - inputs ) / PP-per-unit.   [wage ceiling, units: gold/PP]
 * Exact: one rounding step at the end only.
 */
export function valuePerPP(i: ValueInput): ValuePerPP {
  if (!Number.isInteger(i.ppPerUnit) || i.ppPerUnit <= 0) throw new RangeError("ppPerUnit must be a positive integer.");
  const netRevenuePerUnit = roundDiv(i.unitPrice * (BP - i.taxes.productionBp) * (BP - i.taxes.marketBp), BP * BP);
  const valuePerUnit = netRevenuePerUnit - i.ingredientCostPerUnit;
  return { netRevenuePerUnit, valuePerUnit, perPP: roundDiv(valuePerUnit, BigInt(i.ppPerUnit)) };
}

export interface PlanInput {
  /** Whole PP bought from workers (wage paid) and whole PP from own work / engine (no wage). */
  ppHired: bigint;
  ppOwn: bigint;
  /** Gross wage per PP the employer pays. */
  wage: bigint;
  ppPerUnit: number;
  ingredientCostPerUnit: bigint;
  taxes: Taxes;
  sell: (units: number) => SaleResult;
}
export interface PlanResult {
  ppTotal: bigint;
  unitsProduced: number;
  unitsAfterProductionTax: number;
  labourCost: bigint;
  ingredientCost: bigint;
  /** Gold actually received for sold units, before market tax. */
  grossRevenue: bigint;
  marketTax: bigint;
  netRevenue: bigint;
  unitsSold: number;
  unitsUnsold: number;
  /** netRevenue - labour - ingredients. Unsold stock is NOT valued. */
  profit: bigint;
  /** profit / netRevenue in basis points (null when there is no revenue). */
  marginBp: bigint | null;
  /** Lowest average gross price per unit at which the plan breaks even on the units that were sold (null when nothing sold). */
  breakEvenPrice: bigint | null;
  profitPerPP: bigint | null;
}
/** Plan economics. Ingredients are paid for every produced unit; only units that actually sell earn revenue. */
export function evaluatePlan(p: PlanInput): PlanResult {
  const ppTotal = p.ppHired + p.ppOwn;
  const unitsProduced = Number(floorDiv(ppTotal, BigInt(p.ppPerUnit)));
  const unitsAfter = Number(floorDiv(BigInt(unitsProduced) * (BP - p.taxes.productionBp), BP));
  const labour = p.wage * p.ppHired;
  const ingredient = p.ingredientCostPerUnit * BigInt(unitsProduced);
  const sale = p.sell(unitsAfter);
  const marketTax = mulBpFloor(sale.revenue, p.taxes.marketBp);
  const netRevenue = sale.revenue - marketTax;
  const profit = netRevenue - labour - ingredient;
  const cost = labour + ingredient;
  const breakEvenPrice = sale.sold > 0 ? ceilDiv(cost * BP, BigInt(sale.sold) * (BP - p.taxes.marketBp)) : null;
  return {
    ppTotal, unitsProduced, unitsAfterProductionTax: unitsAfter, labourCost: labour, ingredientCost: ingredient,
    grossRevenue: sale.revenue, marketTax, netRevenue, unitsSold: sale.sold, unitsUnsold: sale.unsold, profit,
    marginBp: netRevenue > 0n ? roundDiv(profit * BP, netRevenue) : null,
    breakEvenPrice,
    profitPerPP: ppTotal > 0n ? roundDiv(profit, ppTotal) : null,
  };
}
export { afterRate };
