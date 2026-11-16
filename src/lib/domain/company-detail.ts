import { z } from "zod";
import { asRecord } from "./parse";

/**
 * GET /companies/{id}. Written from the real capture API/samples/companies/Company details.txt. Fields never seen populated
 * (`workers` entries, an open `offer`, `boost`, `ownerView`) are read tolerantly and never invented.
 */
const s = z.string();
const n = z.number();
const digits = s.regex(/^\d+$/);
const stats = z.record(z.string(), z.number());

export const upgradeSchema = z.object({
  code: s, level: n.nullish(), maxLevel: n.nullish(), stats: stats.nullish(),
  next: z.object({ level: n.nullish(), steelCost: n.nullish(), constructionCost: n.nullish(), constructionResource: s.nullish(), stats: stats.nullish() }).passthrough().nullish(),
  canDowngrade: z.boolean().nullish(), downgradeRefundSteel: n.nullish(),
}).passthrough();
export type CompanyUpgrade = z.infer<typeof upgradeSchema>;

export const companyDetailSchema = z.object({
  id: s.min(1), name: s, status: s.nullish(), itemCode: s, regionId: s.nullish(), countryId: s.nullish(),
  incomeTax: n.nullish(), isOwner: z.boolean().nullish(),
  owner: z.object({ id: s, username: s, avatarUrl: s.nullish() }).passthrough().nullish(),
  production: z.object({
    points: digits.nullish(), capacity: digits.nullish(), full: z.boolean().nullish(), enginePerDay: n.nullish(), fullAt: s.nullish(), pointsPerUnit: n.nullish(),
    needs: z.record(z.string(), z.number()).nullish(), tax: z.object({ percent: n.nullish(), carryUnits: n.nullish() }).passthrough().nullish(),
  }).passthrough().nullish(),
  bonuses: z.array(z.object({ source: s, percent: n }).passthrough()).nullish(), bonusTotal: n.nullish(),
  boost: z.unknown().nullish(),
  upgrades: z.array(z.unknown()).nullish(), workers: z.array(z.unknown()).nullish(), maxWorkers: n.nullish(), hiresToday: n.nullish(),
  offer: z.unknown().nullish(),
}).passthrough();
export type CompanyDetail = z.infer<typeof companyDetailSchema>;

export function parseCompanyDetail(raw: unknown): CompanyDetail | null {
  const r = companyDetailSchema.safeParse(raw);
  return r.success ? r.data : null;
}

/** Upgrades with a code; rows that do not parse are counted by the caller, not guessed. */
export function readUpgrades(list: readonly unknown[] | null | undefined): { rows: CompanyUpgrade[]; skipped: number } {
  const rows: CompanyUpgrade[] = []; let skipped = 0;
  for (const u of list ?? []) { const r = upgradeSchema.safeParse(u); if (r.success) rows.push(r.data); else skipped++; }
  return { rows, skipped };
}

export interface Worker { id: string | null; username: string; avatarUrl: string | null }
/** Workers are only listed when an entry carries a username; the API has never been captured with a non-empty list. */
export function readWorkers(list: readonly unknown[] | null | undefined): { rows: Worker[]; unreadable: number } {
  const rows: Worker[] = []; let unreadable = 0;
  for (const w of list ?? []) {
    const o = asRecord(w);
    const name = typeof o.username === "string" ? o.username : typeof asRecord(o.user).username === "string" ? (asRecord(o.user).username as string) : null;
    if (!name) { unreadable++; continue; }
    const id = typeof o.id === "string" ? o.id : typeof o.userId === "string" ? o.userId : typeof asRecord(o.user).id === "string" ? (asRecord(o.user).id as string) : null;
    rows.push({ id, username: name, avatarUrl: typeof o.avatarUrl === "string" ? o.avatarUrl : null });
  }
  return { rows, unreadable };
}

/** Hiring state of a company: `offer` null means closed; an object means open. Slots/min level only when present as numbers. */
export function readOffer(offer: unknown): { open: boolean; slots: number | null; minLevel: number | null } {
  if (offer == null) return { open: false, slots: null, minLevel: null };
  const o = asRecord(offer);
  return { open: true, slots: typeof o.slots === "number" ? o.slots : null, minLevel: typeof o.minLevel === "number" ? o.minLevel : null };
}

/** Storage fill 0-100 with one decimal (BigInt-safe), or null. */
export function storageFill(p: CompanyDetail["production"]): number | null {
  if (!p?.points || !p.capacity) return null;
  const cap = BigInt(p.capacity);
  if (cap === 0n) return null;
  return Math.max(0, Math.min(100, Number((BigInt(p.points) * 1000n) / cap) / 10));
}

/** Milliseconds until storage is full (from `production.fullAt`), null when full already, unknown or in the past. */
export function msUntilFull(p: CompanyDetail["production"], nowMs: number): number | null {
  if (!p?.fullAt || p.full) return null;
  const t = Date.parse(p.fullAt);
  return Number.isFinite(t) && t > nowMs ? t - nowMs : null;
}
