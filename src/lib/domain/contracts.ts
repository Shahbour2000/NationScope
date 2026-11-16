import { z } from "zod";
import { asRecord, parseRows } from "./parse";

/**
 * Bounties. Verified against tests/fixtures/real/contracts.json (global GET /contracts). GET /battles/{id}/contracts has only
 * been captured empty ({enabled, bounties:[], auctions:[], myContract:null}), so `battle` is optional and auctions /
 * myContract stay untyped.
 */
const s = z.string();
const money = s.regex(/^-?\d+$/);
export const bountySchema = z.object({
  id: s, side: s.nullish(), perK: money.nullish(), budget: money.nullish(), remaining: money.nullish(), status: s.nullish(), earned: money.nullish(),
  battle: z.object({ id: s, type: s.nullish(), status: s.nullish(), regionId: s.nullish(), attackerCountryId: s.nullish(), defenderCountryId: s.nullish() }).passthrough().nullish(),
  funder: z.object({ type: s.nullish(), id: s.nullish(), name: s.nullish() }).passthrough().nullish(),
}).passthrough();
export type Bounty = z.infer<typeof bountySchema>;

export interface BattleContracts { enabled: boolean | null; bounties: Bounty[]; skipped: number; auctions: unknown[]; myContract: unknown | null; shapeOk: boolean }
export function parseBattleContracts(raw: unknown): BattleContracts {
  const o = asRecord(raw);
  const b = parseRows(o.bounties, bountySchema);
  return {
    enabled: typeof o.enabled === "boolean" ? o.enabled : null,
    bounties: b.rows, skipped: b.skipped,
    auctions: Array.isArray(o.auctions) ? o.auctions : [],
    myContract: o.myContract ?? null,
    shapeOk: Array.isArray(o.bounties) || Array.isArray(o.auctions) || typeof o.enabled === "boolean",
  };
}

const big = (v: string | null | undefined): bigint | null => (v != null && /^\d+$/.test(v) ? BigInt(v) : null);
export const bountyOpen = (b: Pick<Bounty, "status">) => b.status === "active";

export interface BountyTotals { open: number; pool: bigint; best: bigint | null }
/** Open offers only (status "active"); money stays BigInt. */
export function bountyTotals(rows: readonly Bounty[]): BountyTotals {
  let open = 0, pool = 0n, best: bigint | null = null;
  for (const b of rows) {
    if (!bountyOpen(b)) continue;
    open++; pool += big(b.remaining) ?? 0n;
    const p = big(b.perK);
    if (p !== null && (best === null || p > best)) best = p;
  }
  return { open, pool, best };
}

/** Share of the budget still unspent, one decimal, or null when budget/remaining are missing or the budget is zero. */
export function remainingPercent(b: Pick<Bounty, "budget" | "remaining">): number | null {
  const budget = big(b.budget), left = big(b.remaining);
  if (budget === null || left === null || budget === 0n) return null;
  return Math.max(0, Math.min(100, Number((left * 1000n) / budget) / 10));
}

/** Open offers first (best pay first), then the rest. */
export function sortBounties(rows: readonly Bounty[]): Bounty[] {
  return [...rows].sort((a, b) => {
    const ao = bountyOpen(a) ? 0 : 1, bo = bountyOpen(b) ? 0 : 1;
    if (ao !== bo) return ao - bo;
    const x = big(a.perK) ?? -1n, y = big(b.perK) ?? -1n;
    return x === y ? a.id.localeCompare(b.id) : x > y ? -1 : 1;
  });
}

/**
 * Mercenary auctions and contracts (`auctions`, `myContracts`, `issuedContracts`, battle `myContract`). None has ever been captured
 * populated, so an entry is read by convention from field names that mirror the documented auction rules (GET /game contractRules.auction:
 * minDamage, maxPerK, bidStep, durations). Anything not recognised stays visible through the "details" view of the same entry.
 */
export interface MercenaryEntry {
  id: string | null; battleId: string | null; side: string | null; status: string | null; perK: string | null; maxPerK: string | null;
  damageTarget: number | null; damageDone: number | null; endsAt: string | null; bidCount: number | null; who: { id: string | null; name: string } | null; recognised: boolean;
}
const pickStr = (o: Record<string, unknown>, keys: string[]) => keys.map((k) => o[k]).find((v) => typeof v === "string" && v) as string | undefined;
const pickNum = (o: Record<string, unknown>, keys: string[]) => keys.map((k) => o[k]).find((v) => typeof v === "number" && Number.isFinite(v)) as number | undefined;
const pickMoney = (o: Record<string, unknown>, keys: string[]) => keys.map((k) => o[k]).find((v) => typeof v === "string" && /^\d+$/.test(v)) as string | undefined;

export function readMercenaryEntry(x: unknown): MercenaryEntry {
  const o = asRecord(x), best = asRecord(o.bestBid ?? o.topBid ?? o.currentBid), battle = asRecord(o.battle);
  const whoRec = asRecord(o.mercenary ?? o.bidder ?? o.contractor ?? best.bidder ?? o.funder);
  const whoName = pickStr(whoRec, ["username", "name"]);
  const whoId = pickStr(whoRec, ["id", "userId"]);
  const ends = pickStr(o, ["endsAt", "closesAt", "expiresAt", "deadline"]);
  const e: MercenaryEntry = {
    id: pickStr(o, ["id"]) ?? null, battleId: pickStr(o, ["battleId"]) ?? pickStr(battle, ["id"]) ?? null, side: pickStr(o, ["side"]) ?? null, status: pickStr(o, ["status"]) ?? null,
    perK: pickMoney(o, ["perK", "pricePerK", "currentPerK", "bestPerK"]) ?? pickMoney(best, ["perK", "pricePerK"]) ?? null, maxPerK: pickMoney(o, ["maxPerK", "maxPricePerK", "ceilingPerK"]) ?? null,
    damageTarget: pickNum(o, ["damageTarget", "targetDamage", "damage", "target"]) ?? null, damageDone: pickNum(o, ["damageDone", "done", "progress"]) ?? null,
    endsAt: ends && !Number.isNaN(Date.parse(ends)) ? ends : null, bidCount: pickNum(o, ["bidCount", "bids"]) ?? (Array.isArray(o.bids) ? o.bids.length : null),
    who: whoName ? { id: whoId && /^[A-Za-z0-9_-]{1,80}$/.test(whoId) ? whoId : null, name: whoName } : null, recognised: false,
  };
  e.recognised = e.id !== null && (e.perK !== null || e.maxPerK !== null || e.damageTarget !== null || e.endsAt !== null || e.side !== null || e.battleId !== null);
  return e;
}
