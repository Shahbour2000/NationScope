/**
 * Independent oracle for the economic model (tests only).
 *
 * Independence rules: nothing is imported from `@/features/build-optimizer`. Constants are typed in from the Wiki:
 *  - 02-economy §1.2 (recipes: production points and ingredients per unit, raw-material points per unit),
 *  - 02-economy §1.5 / §2.2 (work cost 10; one work adds production-skill points; employer pays gold per point),
 *  - 01-basics §1.3 / §2.2 (every full hour a bar regains 10% of its maximum),
 *  - 02-economy §2.4 / §4.4 (income tax on wages, market tax on sales, production tax in goods),
 *  - 01-basics §2.4 (skill endpoints; levels in between are the engine's documented linear ESTIMATE, reused from oracle.ts).
 * Modelling choices that the Wiki does not spell out (listed in the registry as `estimated`) are re-implemented from the registry text:
 * owner works go to the best group, workers are paid the posted wage on every point, net = own profit + worker margin + job income.
 * A mismatch means an engine bug or an oracle misreading; both are investigated.
 */
import { CUM, SKILL_ORDER, W_SKILL, allowedLevels, effectiveBudget, exhaustiveTop, statAt, type CSpec, type Sk } from './oracle';

// ---- Wiki 02-economy §1.2, typed in (points per unit; ingredients per unit) ----
export const WIKI_RAW_POINTS: Record<string, number> = { limestone: 1, grain: 1, cattle: 20, fish: 40, iron: 1, coca: 1, lead: 1, petroleum: 1, wood: 1, coffeeBeans: 1, uranium: 10 };
export const WIKI_RECIPES: Record<string, { points: number; needs: Record<string, number> }> = {
  concrete: { points: 8, needs: { limestone: 8 } }, steel: { points: 8, needs: { iron: 8 } }, bread: { points: 8, needs: { grain: 8 } },
  steak: { points: 18, needs: { cattle: 1 } }, cookedFish: { points: 36, needs: { fish: 1 } },
  lightBullets: { points: 1, needs: { lead: 1 } }, mediumBullets: { points: 3, needs: { lead: 3 } }, heavyBullets: { points: 12, needs: { lead: 12 } },
  stimulant: { points: 150, needs: { coca: 150 } }, oil: { points: 1, needs: { petroleum: 1 } }, paper: { points: 1, needs: { wood: 1 } },
  coffee: { points: 8, needs: { coffeeBeans: 8 } }, fuelCell: { points: 100, needs: { uranium: 1 } },
};
export const productPoints = (code: string): number => WIKI_RECIPES[code]?.points ?? WIKI_RAW_POINTS[code]!;
export const productNeeds = (code: string): Record<string, number> => WIKI_RECIPES[code]?.needs ?? {};

export type OPrices = Record<string, { sell?: number; buy?: number } | undefined>;
export interface OGroup { count: number; product: string; bonusPct: number }
export interface OCfg {
  groups: OGroup[]; prices: OPrices; marketTaxPct?: number; productionTaxPct?: number; incomeTaxPct?: number;
  workers?: { count: number; pointsPerDay: number; wage: number }; jobWage?: number; fullBar?: boolean;
}
export type OLevels = Record<Sk, number>;

// 10% of the maximum per full hour, 24 hours a day, 10 per work (Wiki 01-basics §1.3, §2.2)
export const oWorks = (max: number, fullBar = false): number => (0.1 * max * 24) / 10 + (fullBar ? max / 10 : 0);
export const oStat = (s: Sk, l: number): number => statAt(s, l);

/** gold per production point of a product; null when a needed price is unknown (never zero) */
export function oPointValue(code: string, c: OCfg): number | null {
  const sell = c.prices[code]?.sell; if (sell === undefined) return null;
  let cost = 0;
  for (const [ing, qty] of Object.entries(productNeeds(code))) { const b = c.prices[ing]?.buy; if (b === undefined) return null; cost += qty * b; }
  const kept = sell * (1 - (c.marketTaxPct ?? 0) / 100) * (1 - (c.productionTaxPct ?? 0) / 100);
  return (kept - cost) / productPoints(code);
}

export interface ODaily { net: number | null; slotsOk: boolean; own: number | null; workerMargin: number | null; job: number; workers: number }
export function oDaily(l: OLevels, c: OCfg): ODaily {
  const n = c.groups.filter((g) => g.count > 0).reduce((a, g) => a + g.count, 0);
  const slotsOk = n <= oStat('companySlots', l.companySlots);
  const values = c.groups.filter((g) => g.count > 0).map((g) => ({ g, v: oPointValue(g.product, c) }));
  const anyUnknown = values.some((x) => x.v === null);
  // the best group = highest value per point INCLUDING its own bonus; ties keep the earlier group
  let best: { v: number; bonus: number } | null = null;
  for (const x of values) { if (x.v === null) continue; if (best === null || x.v * (1 + x.g.bonusPct / 100) > best.v * (1 + best.bonus / 100)) best = { v: x.v, bonus: x.g.bonusPct }; }
  const prod = oStat('production', l.production);
  const works = n > 0 ? oWorks(oStat('business', l.business), c.fullBar) : 0;
  let own: number | null;
  if (n === 0) own = 0; else if (anyUnknown || best === null) own = null; else own = works * prod * (1 + best.bonus / 100) * best.v;
  const eff = Math.min(c.workers?.count ?? 0, Math.floor(oStat('leadership', l.leadership)));
  let wm: number | null = 0;
  if (c.workers && eff > 0 && n > 0) wm = anyUnknown || best === null ? null : eff * c.workers.pointsPerDay * (best.v - c.workers.wage);
  const job = c.jobWage === undefined ? 0 : oWorks(oStat('energy', l.energy), c.fullBar) * prod * c.jobWage * (1 - (c.incomeTaxPct ?? 0) / 100);
  return { net: !slotsOk || own === null || wm === null ? null : own + wm + job, slotsOk, own, workerMargin: wm, job, workers: eff };
}

/** Exhaustive best maxEconomy build: every level of the four economic skills (companySlots takes its minimum allowed level, as the cap constraint requires). */
export function oBestEconomy(c: OCfg, playerLevel: number, totalPoints: number, specs: CSpec[]): { status: 'ok' | 'conflict' | 'infeasible'; best?: { levels: OLevels; net: number; points: number } } {
  const sets = {} as Record<Sk, number[]>;
  for (const s of SKILL_ORDER) { sets[s] = allowedLevels(s, specs, playerLevel); if (!sets[s].length) return { status: 'conflict' }; }
  const budget = effectiveBudget(specs, totalPoints);
  const top = exhaustiveTop(sets, ['production', 'business', 'energy', 'leadership'], budget, (lv) => oDaily(lv, c).net ?? -1e15, 1);
  if (!top.length) return { status: 'conflict' }; // the minimum levels alone exceed the budget
  const b = top[0]!;
  if (b.score <= -1e14) return { status: 'infeasible' };
  return { status: 'ok', best: { levels: b.levels, net: b.score, points: b.points } };
}
export { CUM, W_SKILL };
