import { z } from "zod";
import { asRecord, parseRows } from "./parse";

/**
 * Region pages. Shapes written from saved samples: API/samples/regions/Region details.txt, Regional companies.txt,
 * Regional campaign battles.txt. Fields whose populated shape has never been captured (`upgrades`, `battle`,
 * campaign `ownership` / `launchedFromHere`, a company's open `offer`) are read tolerantly and never invented.
 */
const s = z.string();
const n = z.number();
const ISO = /^\d{4}-\d{2}-\d{2}T/;

export const regionDetailSchema = z.object({
  id: s.min(1), name: s.nullish(), mainCity: s.nullish(), biome: s.nullish(), climate: s.nullish(),
  hasCoast: z.boolean().nullish(), isCapital: z.boolean().nullish(),
  countryId: s.nullish(), coreCountryId: s.nullish(), occupied: z.boolean().nullish(),
  development: n.nullish(), resistance: n.nullish(), resistanceMax: n.nullish(),
  lastOwnershipChangeAt: s.nullish(), lastBattleEndedAt: s.nullish(),
  deposit: z.object({ type: s.nullish(), bonusPercent: n.nullish(), endsAt: s.nullish() }).passthrough().nullish(),
  upgrades: z.array(z.unknown()).nullish(), battle: z.unknown().nullish(),
  residents: n.nullish(), present: n.nullish(), companies: n.nullish(),
  neighbors: z.array(z.object({ id: s, name: s.nullish(), countryId: s.nullish() }).passthrough()).nullish(),
}).passthrough();
export type RegionDetail = z.infer<typeof regionDetailSchema>;

export function parseRegionDetail(raw: unknown): RegionDetail | null {
  const r = regionDetailSchema.safeParse(raw);
  return r.success ? r.data : null;
}

export interface RegionFacility { code: string; level: number | null; maxLevel: number | null; status: string | null }
/** Reads `{code, level, maxLevel?, status?}` rows; anything without a code is skipped (not guessed). */
export function facilitiesOf(upgrades: readonly unknown[] | null | undefined): RegionFacility[] {
  const out: RegionFacility[] = [];
  for (const u of upgrades ?? []) {
    const o = asRecord(u);
    if (typeof o.code !== "string" || !o.code) continue;
    out.push({ code: o.code, level: typeof o.level === "number" ? o.level : null, maxLevel: typeof o.maxLevel === "number" ? o.maxLevel : null, status: typeof o.status === "string" ? o.status : null });
  }
  return out;
}

/** The id of a battle running on the region, when `battle` is an object that carries one. */
export function battleIdOf(battle: unknown): string | null {
  const id = asRecord(battle).id;
  return typeof id === "string" && id ? id : null;
}

export const regionCompanySchema = z.object({
  id: s.min(1), name: s, itemCode: s,
  owner: z.object({ id: s, username: s, avatarUrl: s.nullish() }).passthrough().nullish(),
  points: s.regex(/^\d+$/).nullish(), capacity: s.regex(/^\d+$/).nullish(),
  workers: n.nullish(), maxWorkers: n.nullish(), offer: z.unknown().nullish(),
}).passthrough();
export type RegionCompany = z.infer<typeof regionCompanySchema>;

/** Accepts a bare array (saved sample) or an object wrapping `companies`. */
export function parseRegionCompanies(raw: unknown): { rows: RegionCompany[]; skipped: number } {
  const list = Array.isArray(raw) ? raw : asRecord(raw).companies;
  return parseRows(list, regionCompanySchema);
}

/** Storage fill as a 0-100 integer, or null when either figure is missing/zero. BigInt-safe: points can exceed 2^53. */
export function fillPercent(points: string | null | undefined, capacity: string | null | undefined): number | null {
  if (!points || !capacity || !/^\d+$/.test(points) || !/^\d+$/.test(capacity)) return null;
  const cap = BigInt(capacity);
  if (cap === 0n) return null;
  const pct = Number((BigInt(points) * 1000n) / cap) / 10;
  return Math.max(0, Math.min(100, pct));
}

export interface CompanyTotals { companies: number; workers: number; hiring: number; byItem: { itemCode: string; companies: number }[] }
export function companyTotals(rows: readonly RegionCompany[]): CompanyTotals {
  const items = new Map<string, number>();
  let workers = 0, hiring = 0;
  for (const c of rows) {
    workers += c.workers ?? 0;
    if (c.offer != null) hiring++;
    items.set(c.itemCode, (items.get(c.itemCode) ?? 0) + 1);
  }
  return { companies: rows.length, workers, hiring, byItem: [...items.entries()].map(([itemCode, companies]) => ({ itemCode, companies })).sort((a, b) => b.companies - a.companies || a.itemCode.localeCompare(b.itemCode)) };
}

export const campaignBattleSchema = z.object({
  id: s.min(1), type: s.nullish(), status: s.nullish(),
  attackerCountryId: s.nullish(), defenderCountryId: s.nullish(), sourceRegionId: s.nullish(),
  winner: s.nullish(), attackerRounds: n.nullish(), defenderRounds: n.nullish(), sourceLost: z.boolean().nullish(),
  startedAt: s.nullish(), endedAt: s.nullish(),
}).passthrough();
export type CampaignBattle = z.infer<typeof campaignBattleSchema>;

/** A loosely-read event row: only timestamps, country/region/battle ids that are actually present on it. */
export interface LooseEvent { at: string | null; countryIds: string[]; regionIds: string[]; battleId: string | null; recognised: boolean }
export function looseEvent(x: unknown): LooseEvent {
  const o = asRecord(x);
  let at: string | null = null; const countryIds: string[] = [], regionIds: string[] = []; let battleId: string | null = null;
  for (const [k, v] of Object.entries(o)) {
    if (typeof v !== "string" || !v) continue;
    if (/At$/.test(k) && ISO.test(v)) at ??= v;
    else if (/CountryId$/.test(k) && !countryIds.includes(v)) countryIds.push(v);
    else if (/RegionId$/.test(k) && !regionIds.includes(v)) regionIds.push(v);
    else if (k === "battleId") battleId = v;
  }
  return { at, countryIds, regionIds, battleId, recognised: at !== null || countryIds.length > 0 || battleId !== null };
}

export interface Campaign { battles: CampaignBattle[]; skipped: number; ownership: unknown[]; launched: unknown[]; shapeOk: boolean }
export function parseCampaign(raw: unknown): Campaign {
  const o = asRecord(raw);
  const b = parseRows(o.battles, campaignBattleSchema);
  const battles = b.rows.sort((x, y) => (Date.parse(y.startedAt ?? "") || 0) - (Date.parse(x.startedAt ?? "") || 0));
  return { battles, skipped: b.skipped, ownership: Array.isArray(o.ownership) ? o.ownership : [], launched: Array.isArray(o.launchedFromHere) ? o.launchedFromHere : [], shapeOk: Array.isArray(o.battles) };
}

export interface CampaignSummary { total: number; active: number; heldByAttacker: number; heldByDefender: number; undecided: number }
export function campaignSummary(battles: readonly CampaignBattle[]): CampaignSummary {
  let active = 0, a = 0, dd = 0, u = 0;
  for (const b of battles) {
    if (b.status === "active" && !b.endedAt) { active++; continue; }
    if (b.winner === "attacker") a++; else if (b.winner === "defender") dd++; else u++;
  }
  return { total: battles.length, active, heldByAttacker: a, heldByDefender: dd, undecided: u };
}

export type CompanySort = "storage" | "workers" | "name";
export const COMPANY_SORTS: readonly CompanySort[] = ["storage", "workers", "name"];
export const parseCompanySort = (v: string | undefined): CompanySort => (COMPANY_SORTS as readonly string[]).includes(v ?? "") ? (v as CompanySort) : "storage";

/** Filters by product code and sorts (never mutates). Ties fall back to name so the order is stable. */
export function filterSortCompanies(rows: readonly RegionCompany[], item: string | null, sort: CompanySort): RegionCompany[] {
  const list = rows.filter((c) => !item || c.itemCode === item);
  const pts = (c: RegionCompany) => (c.points && /^\d+$/.test(c.points) ? BigInt(c.points) : -1n);
  const byName = (a: RegionCompany, b: RegionCompany) => a.name.localeCompare(b.name);
  return [...list].sort((a, b) => {
    if (sort === "storage") { const x = pts(a), y = pts(b); if (x !== y) return x > y ? -1 : 1; }
    else if (sort === "workers") { const x = a.workers ?? -1, y = b.workers ?? -1; if (x !== y) return y - x; }
    return byName(a, b);
  });
}
