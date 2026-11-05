import { defineFormula } from './registry';
import { skillValue, type Levels } from './skills';

export interface Recipe { itemCode: string; pointsPerUnit: number; ingredients: { itemCode: string; qty: number }[] }
/** Documented recipes (wiki 02-economy §1.2). Raw materials: 1 point per unit (cattle 20, fish 40, uranium 10). */
export const RECIPES: Record<string, Recipe> = {
  concrete: { itemCode: 'concrete', pointsPerUnit: 8, ingredients: [{ itemCode: 'limestone', qty: 8 }] },
  steel: { itemCode: 'steel', pointsPerUnit: 8, ingredients: [{ itemCode: 'iron', qty: 8 }] },
  bread: { itemCode: 'bread', pointsPerUnit: 8, ingredients: [{ itemCode: 'grain', qty: 8 }] },
  steak: { itemCode: 'steak', pointsPerUnit: 18, ingredients: [{ itemCode: 'cattle', qty: 1 }] },
  cookedFish: { itemCode: 'cookedFish', pointsPerUnit: 36, ingredients: [{ itemCode: 'fish', qty: 1 }] },
  lightBullets: { itemCode: 'lightBullets', pointsPerUnit: 1, ingredients: [{ itemCode: 'lead', qty: 1 }] },
  mediumBullets: { itemCode: 'mediumBullets', pointsPerUnit: 3, ingredients: [{ itemCode: 'lead', qty: 3 }] },
  heavyBullets: { itemCode: 'heavyBullets', pointsPerUnit: 12, ingredients: [{ itemCode: 'lead', qty: 12 }] },
  stimulant: { itemCode: 'stimulant', pointsPerUnit: 150, ingredients: [{ itemCode: 'coca', qty: 150 }] },
  oil: { itemCode: 'oil', pointsPerUnit: 1, ingredients: [{ itemCode: 'petroleum', qty: 1 }] },
  paper: { itemCode: 'paper', pointsPerUnit: 1, ingredients: [{ itemCode: 'wood', qty: 1 }] },
  coffee: { itemCode: 'coffee', pointsPerUnit: 8, ingredients: [{ itemCode: 'coffeeBeans', qty: 8 }] },
  fuelCell: { itemCode: 'fuelCell', pointsPerUnit: 100, ingredients: [{ itemCode: 'uranium', qty: 1 }] },
};
export const rawRecipe = (itemCode: string, pointsPerUnit = 1): Recipe => ({ itemCode, pointsPerUnit, ingredients: [] });

defineFormula({ id: 'econ.barRegen', version: 1, status: 'documented',
  summary: 'Each bar regains 10% of its max every full hour; a work action costs 10. Steady-state works/day = 0.24*max (+ max/10 if the bar starts full).',
  source: 'wiki 01-basics §1.3, §2.2; 02-economy §1.5, §2.2', inputs: ['barMax'], outputs: ['worksPerDay'], dependsOn: ['skills.value.endpoints'], tests: ['works per day'] });
defineFormula({ id: 'econ.pointsPerWork', version: 1, status: 'estimated',
  summary: 'Points per work = production skill value * (1 + bonuses). Bonuses are caller-supplied (deposit, specialization, party, loyalty); whether they sum or multiply is not documented -> summed (estimated).',
  source: 'wiki 02-economy §1.4, §1.6', inputs: ['production', 'bonusPct'], outputs: ['points'], dependsOn: ['skills.value.linear'], tests: ['points per work'] });
defineFormula({ id: 'econ.unitValue', version: 1, status: 'estimated',
  summary: 'Value of one production point = [sell*(1-marketTax)*(1-prodTax) - sum(ingredient buy prices)] / pointsPerUnit. Production-tax carry fractions are ignored (long-run average).',
  source: 'wiki 02-economy §1.2, §2.5, §4.4', inputs: ['prices', 'taxes', 'recipe'], outputs: ['goldPerPoint'], dependsOn: [], tests: ['unit value'] });
defineFormula({ id: 'econ.dailyNet', version: 1, status: 'estimated',
  summary: 'Daily net = own-company profit (initiative works) + worker margin (workers*points*(value-wage)) + employer wages after income tax (energy works). Storage caps, upgrade amortization and shipping are not modelled.',
  source: 'wiki 02-economy §1.5, §1.9, §2.2, §2.4', inputs: ['levels', 'companies', 'workers', 'job', 'prices'], outputs: ['goldPerDay'], dependsOn: ['econ.barRegen', 'econ.pointsPerWork', 'econ.unitValue'], tests: ['daily net', 'leadership caps workers'] });

export const worksPerDay = (barMax: number, includeFullBar = false): number => 0.24 * barMax + (includeFullBar ? barMax / 10 : 0);

export interface CompanyGroup { count: number; product: Recipe; productionBonusPct?: number }
export interface EconomyInput {
  /** Own companies, by product. Total count must be <= company slots (checked). The owner's own works are assumed to go to the most valuable group (storage caps not modelled). */
  companies?: CompanyGroup | CompanyGroup[];
  /** Gold per unit. sell = what you receive before market tax; buy = what ingredients cost. undefined = unknown. */
  prices: Record<string, { sell?: number; buy?: number } | undefined>;
  marketTaxPct?: number; productionTaxPct?: number; incomeTaxPct?: number;
  workers?: { count: number; pointsPerWorkerPerDay: number; wagePerPoint: number };
  /** Employer job: gross wage per production point. */
  job?: { wagePerPoint: number };
  includeFullBar?: boolean;
}
export interface EconomyResult {
  ownWorksPerDay: number; ownPointsPerDay: number; effectiveWorkers: number; slotsOk: boolean;
  ownProfit: number | null; workerMargin: number | null; jobIncome: number; net: number | null; missing: string[]; usedFormulas: string[];
}
export function unitValuePerPoint(r: Recipe, input: EconomyInput, missing: string[]): number | null {
  const sell = input.prices[r.itemCode]?.sell;
  if (sell === undefined) { missing.push(`price.sell.${r.itemCode}`); return null; }
  let ing = 0;
  for (const i of r.ingredients) {
    const b = input.prices[i.itemCode]?.buy;
    if (b === undefined) { missing.push(`price.buy.${i.itemCode}`); return null; }
    ing += i.qty * b;
  }
  const kept = sell * (1 - (input.marketTaxPct ?? 0) / 100) * (1 - (input.productionTaxPct ?? 0) / 100);
  return (kept - ing) / r.pointsPerUnit;
}
const groupsOf = (c: EconomyInput['companies']): CompanyGroup[] => (c === undefined ? [] : Array.isArray(c) ? c : [c]).filter((g) => g.count > 0);
export const totalCompanies = (c: EconomyInput['companies']): number => groupsOf(c).reduce((n, g) => n + g.count, 0);

export function dailyEconomy(levels: Levels, input: EconomyInput): EconomyResult {
  const missing: string[] = [];
  if (input.marketTaxPct === undefined) missing.push('marketTaxPct(0 assumed)');
  if (input.incomeTaxPct === undefined && input.job) missing.push('incomeTaxPct(0 assumed)');
  const groups = groupsOf(input.companies);
  const count = totalCompanies(input.companies);
  const slotsOk = count <= skillValue('companySlots', levels.companySlots);
  const prod = skillValue('production', levels.production);
  const ownWorks = count > 0 ? worksPerDay(skillValue('business', levels.business), input.includeFullBar) : 0;
  // value per point of each group (with its own bonus); works go to the best group
  let bestValue: number | null = count > 0 ? null : 0, bestBonus = 0, anyUnknown = false;
  for (const g of groups) {
    const v = unitValuePerPoint(g.product, input, missing);
    if (v === null) { anyUnknown = true; continue; }
    const eff = v * (1 + (g.productionBonusPct ?? 0) / 100);
    if (bestValue === null || eff > bestValue * (1 + bestBonus / 100)) { bestValue = v; bestBonus = g.productionBonusPct ?? 0; }
  }
  if (anyUnknown) bestValue = null; // a missing price must never be silently skipped
  const ownPoints = ownWorks * prod * (1 + bestBonus / 100);
  const ownProfit = count > 0 ? (bestValue === null ? null : ownPoints * bestValue) : 0;
  const cap = skillValue('leadership', levels.leadership);
  const effectiveWorkers = Math.min(input.workers?.count ?? 0, Math.floor(cap));
  let workerMargin: number | null = 0;
  if (input.workers && effectiveWorkers > 0 && count > 0) {
    workerMargin = bestValue === null ? null : effectiveWorkers * input.workers.pointsPerWorkerPerDay * (bestValue - input.workers.wagePerPoint);
  }
  const jobIncome = input.job ? worksPerDay(skillValue('energy', levels.energy), input.includeFullBar) * prod * input.job.wagePerPoint * (1 - (input.incomeTaxPct ?? 0) / 100) : 0;
  const net = !slotsOk ? null : ownProfit === null || workerMargin === null ? null : ownProfit + workerMargin + jobIncome;
  return { ownWorksPerDay: ownWorks, ownPointsPerDay: ownPoints, effectiveWorkers, slotsOk, ownProfit, workerMargin, jobIncome, net,
    missing: [...new Set(missing)], usedFormulas: ['econ.dailyNet', 'econ.barRegen', 'econ.pointsPerWork', 'econ.unitValue'] };
}
