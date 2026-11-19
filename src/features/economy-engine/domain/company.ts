import { PP_SCALE, floorDiv, parseIntString, pctToBp } from "./fixed";
import { readUpgrades, type UpgradeRow } from "./upgrades";

const rec = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

export interface CompanyBonus { source: string; percent: number }
export interface CompanyState {
  id: string; name: string; itemCode: string; regionId: string | null; countryId: string | null;
  ownerId: string | null;
  incomeBp: bigint | null;
  productionTaxBp: bigint | null;
  /** Live recipe of this company (overrides the static table). */
  ppPerUnit: number | null;
  needs: Record<string, number>;
  /** Whole PP in the store. The API reports points x 10,000 (inferred from capacity 4,000,000 vs storage level 2 = 400). */
  storedPP: bigint | null;
  capacityPP: bigint | null;
  full: boolean | null;
  fullAt: string | null;
  enginePerDay: number | null;
  bonuses: CompanyBonus[];
  bonusTotalPct: number;
  upgrades: UpgradeRow[];
  workers: number | null;
  /** Gross wage per PP of the company's open job offer, when one is posted and readable. */
  offerGross: bigint | null;
}

export function readCompany(raw: unknown): CompanyState | null {
  const o = rec(raw);
  if (typeof o.id !== "string" || typeof o.itemCode !== "string") return null;
  const prod = rec(o.production), tax = rec(prod.tax);
  const pts = parseIntString(prod.points), cap = parseIntString(prod.capacity);
  const needs: Record<string, number> = {};
  for (const [k, v] of Object.entries(rec(prod.needs))) { const n = num(v); if (n !== null && n > 0) needs[k] = n; }
  const bonuses: CompanyBonus[] = Array.isArray(o.bonuses)
    ? o.bonuses.flatMap((b) => { const r = rec(b); return typeof r.source === "string" && num(r.percent) !== null ? [{ source: r.source, percent: r.percent as number }] : []; }) : [];
  const total = num(o.bonusTotal) ?? bonuses.reduce((a, b) => a + b.percent, 0);
  const offer = rec(o.offer);
  const inc = num(o.incomeTax), pt = num(tax.percent);
  return {
    id: o.id, name: typeof o.name === "string" ? o.name : o.id, itemCode: o.itemCode,
    regionId: typeof o.regionId === "string" ? o.regionId : null, countryId: typeof o.countryId === "string" ? o.countryId : null,
    ownerId: typeof rec(o.owner).id === "string" ? (rec(o.owner).id as string) : null,
    incomeBp: inc === null ? null : pctToBp(inc), productionTaxBp: pt === null ? null : pctToBp(pt),
    ppPerUnit: num(prod.pointsPerUnit) && Number.isInteger(prod.pointsPerUnit) ? (prod.pointsPerUnit as number) : null,
    needs,
    storedPP: pts === null ? null : floorDiv(pts, PP_SCALE), capacityPP: cap === null ? null : floorDiv(cap, PP_SCALE),
    full: typeof prod.full === "boolean" ? prod.full : null, fullAt: typeof prod.fullAt === "string" ? prod.fullAt : null,
    enginePerDay: num(prod.enginePerDay),
    bonuses, bonusTotalPct: total,
    upgrades: readUpgrades(o.upgrades),
    workers: Array.isArray(o.workers) ? o.workers.length : num(o.workers),
    offerGross: parseIntString(offer.grossPerPoint),
  };
}

/** Is the store full or will it be within `hours`? null when unknown. */
export function storeNearFull(c: CompanyState, nowMs: number, hours = 24): boolean | null {
  if (c.full === true) return true;
  // `fullAt` is a forecast. A forecast already in the past while `full` is false is stale: fall through to the fill ratio.
  if (c.fullAt) { const t = Date.parse(c.fullAt); if (Number.isFinite(t) && t >= nowMs) return t - nowMs <= hours * 3_600_000; }
  if (c.storedPP !== null && c.capacityPP !== null && c.capacityPP > 0n) return c.storedPP * 10n >= c.capacityPP * 9n;
  return null;
}
