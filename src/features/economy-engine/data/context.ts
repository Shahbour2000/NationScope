import { endpoints, type Endpoint } from "@/lib/api/endpoints";
import { getApiClient } from "@/lib/api/instance";
import { anyJson } from "@/lib/api/schemas";
import { isApiError } from "@/lib/api/errors";
import type { ApiResultMeta } from "@/lib/api/client";
import { readOrderBook, readTrades } from "@/lib/domain/market-item";
import type { Evidence } from "../domain/evidence";
import { readCompany } from "../domain/company";
import { readSkills, type SkillRow } from "../domain/skills";

/** Everything here is JSON-safe (no bigint) so the server page can hand it to the client what-if simulator. */
export type Slot<T> =
  | { state: "ok"; value: T; evidence: Evidence; fetchedAt: string }
  | { state: "missing" | "rate_limited" | "error"; reason: string };

export type Get = (e: Endpoint) => Promise<{ data: unknown; meta: Pick<ApiResultMeta, "source" | "fetchedAt"> }>;
const defaultGet: Get = (e) => getApiClient().get(e.path, { schema: anyJson, query: e.query });

const evidenceOf = (s: ApiResultMeta["source"]): Evidence => (s === "live" ? "live" : s === "cache" ? "cached" : "stale");
const rec = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);

/**
 * A failed request is never read as "does not exist": only an HTTP 404 means missing. Rate limits, timeouts and
 * network errors stay distinguishable so the UI can say "try again" instead of "not found".
 */
async function slot<T>(run: () => Promise<{ data: unknown; meta: Pick<ApiResultMeta, "source" | "fetchedAt"> }>, map: (data: unknown) => T | null): Promise<Slot<T>> {
  try {
    const { data, meta } = await run();
    const value = map(data);
    return value === null ? { state: "error", reason: "unrecognised-shape" } : { state: "ok", value, evidence: evidenceOf(meta.source), fetchedAt: meta.fetchedAt };
  } catch (e) {
    if (isApiError(e)) {
      if (e.kind === "rate_limited") return { state: "rate_limited", reason: e.local ? "local-budget" : "upstream" };
      if (e.kind === "http" && e.status === 404) return { state: "missing", reason: "404" };
      return { state: "error", reason: e.kind };
    }
    return { state: "error", reason: "unknown" };
  }
}

export interface MarketRowJson { itemCode: string; bestAsk: string | null; askQty: number | null; bestBid: string | null; bidQty: number | null; last: string | null }
export interface JobsJson { offersNet: string[]; offerCount: number; allowed: { min: string; max: string; median: string } | null; energyCost: number | null }
export interface PlayerJson { id: string; username: string; level: number | null; countryId: string | null; regionId: string | null; skills: SkillRow[]; issues: string[] }
export interface TaxesJson { marketPct: number | null; incomePct: number | null; productionPct: number | null; locationCountryId: string | null; specializedItem: string | null }
export interface ItemJson { bids: [string, number][]; asks: [string, number][]; trades: [string, number, number][]; historyPoints: number | null; bookDepthLevels: number }

const money = (v: unknown): string | null => (typeof v === "string" && /^-?\d+$/.test(v) ? v : null);
const numOrNull = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

export function mapMarket(data: unknown): MarketRowJson[] | null {
  const list = Array.isArray(data) ? data : Array.isArray(rec(data).items) ? (rec(data).items as unknown[]) : null;
  if (!list) return null;
  const out: MarketRowJson[] = [];
  for (const x of list) { const o = rec(x); const code = str(o.itemCode); if (!code) continue; out.push({ itemCode: code, bestAsk: money(o.bestAsk), askQty: numOrNull(o.askQty), bestBid: money(o.bestBid), bidQty: numOrNull(o.bidQty), last: money(o.last) }); }
  return out;
}
export function mapJobs(data: unknown): JobsJson | null {
  const o = rec(data); if (!Array.isArray(o.offers)) return null;
  const nets: string[] = [];
  for (const x of o.offers) { const r = rec(x); if (r.own === true || r.blocked || r.moneyAvailable === false) continue; const n = money(r.netPerPoint); if (n && BigInt(n) > 0n) nets.push(n); }
  const w = rec(o.allowedWage); const min = money(w.min), max = money(w.max), median = money(w.median);
  return { offersNet: nets, offerCount: o.offers.length, allowed: min && max && median ? { min, max, median } : null, energyCost: numOrNull(o.energyCost) };
}
export function mapPlayer(data: unknown): PlayerJson | null {
  const o = rec(data); const p = o.id ? o : rec(o.player);
  const id = str(p.id), name = str(p.username);
  if (!id || !name) return null;
  const sk = readSkills(p);
  return { id, username: name, level: numOrNull(p.level), countryId: str(p.countryId), regionId: str(p.regionId), skills: sk.rows, issues: sk.issues };
}
export function mapTaxes(data: unknown, locationCountryId: string | null): TaxesJson | null {
  const o = rec(data); const t = rec(o.taxes);
  if (!o.taxes) return null;
  return { marketPct: numOrNull(t.market), incomePct: numOrNull(t.income), productionPct: numOrNull(t.production), locationCountryId, specializedItem: str(o.specializedItem) };
}

export interface EngineContext {
  market: Slot<MarketRowJson[]>;
  jobs: Slot<JobsJson>;
  player: Slot<PlayerJson> | null;
  /** Raw /companies/{id} bodies (re-read on the client with the same pure parser). */
  companies: Slot<unknown[]> | null;
  companyIds: string[];
  taxes: Slot<TaxesJson> | null;
  items: Record<string, Slot<ItemJson>>;
  requests: number;
}

export interface LoadOptions { player?: string; maxCompanies?: number; get?: Get }

export async function loadEngineContext(o: LoadOptions = {}): Promise<EngineContext> {
  let requests = 0;
  const raw = o.get ?? defaultGet;
  const get: Get = (e) => { requests++; return raw(e); };
  const maxCompanies = Math.min(o.maxCompanies ?? 6, 12);

  const [market, jobs] = await Promise.all([slot(() => get(endpoints.market()), mapMarket), slot(() => get(endpoints.jobs()), mapJobs)]);
  const ctx: EngineContext = { market, jobs, player: null, companies: null, companyIds: [], taxes: null, items: {}, requests: 0 };

  const name = o.player?.trim();
  if (name) {
    // Discovery: username -> player id (+ skills). If the by-name body has no skills, the profile by id is requested once.
    let player = await slot(() => get(endpoints.playerByName(name)), mapPlayer);
    if (player.state === "ok" && player.value.skills.length === 0) {
      const full = await slot(() => get(endpoints.player((player as { value: PlayerJson }).value.id)), mapPlayer);
      if (full.state === "ok") player = full;
    }
    ctx.player = player;
    if (player.state === "ok") {
      const list = await slot(() => get(endpoints.playerCompanies(player.value.id, { sort: "level", limit: 12 })), (d) => (Array.isArray(rec(d).companies) ? (rec(d).companies as unknown[]) : null));
      if (list.state === "ok") {
        const ids = list.value.map((c) => str(rec(c).id)).filter((x): x is string => x !== null).slice(0, maxCompanies);
        ctx.companyIds = ids;
        const details: unknown[] = []; let failed: Slot<unknown[]> | null = null;
        for (let k = 0; k < ids.length; k += 3) {
          const chunk = await Promise.all(ids.slice(k, k + 3).map((id) => slot(() => get(endpoints.company(id)), (d) => (readCompany(d) ? d : null))));
          for (const c of chunk) { if (c.state === "ok") details.push(c.value); else failed ??= { state: c.state, reason: c.reason }; }
        }
        ctx.companies = details.length || !failed ? { state: "ok", value: details, evidence: list.evidence, fetchedAt: list.fetchedAt } : failed;
      } else ctx.companies = { state: list.state, reason: list.reason };

      // Market tax is paid to the country controlling the region where the seller stands: player.regionId -> region -> country -> taxes.
      let loc: string | null = null;
      if (player.value.regionId) {
        const reg = await slot(() => get(endpoints.region(player.value.regionId!)), (d) => str(rec(d).countryId));
        if (reg.state === "ok") loc = reg.value;
      }
      loc ??= player.value.countryId;
      if (loc) { const country = loc; ctx.taxes = await slot(() => get(endpoints.country(country)), (d) => mapTaxes(d, country)); }
    }
  }

  // Order book + trades only for the items of the loaded companies (request budget).
  const wanted = new Set<string>();
  if (ctx.companies?.state === "ok") for (const c of ctx.companies.value) { const s = readCompany(c); if (s) wanted.add(s.itemCode); }
  for (const item of [...wanted].slice(0, 6)) {
    const [book, trades] = await Promise.all([
      slot(() => get(endpoints.marketOrders(item)), (d) => readOrderBook(d) ?? { buys: [], sells: [], rawUnits: false }),
      slot(() => get(endpoints.marketTrades(item, { limit: 100 })), (d) => readTrades(d)),
    ]);
    const bk = book.state === "ok" ? book : null, tr = trades.state === "ok" ? trades : null;
    ctx.items[item] = bk || tr
      ? { state: "ok", evidence: bk ? bk.evidence : "stale", fetchedAt: bk ? bk.fetchedAt : tr!.fetchedAt, value: {
          bids: bk ? bk.value.buys.map((l): [string, number] => [l.price.toString(), l.qty]) : [],
          asks: bk ? bk.value.sells.map((l): [string, number] => [l.price.toString(), l.qty]) : [],
          trades: tr ? tr.value.rows.map((t): [string, number, number] => [t.price, t.qty, Date.parse(t.createdAt ?? "") || 0]).filter((t) => t[2] > 0) : [],
          historyPoints: null, bookDepthLevels: bk ? bk.value.buys.length : 0 } }
      : { state: book.state === "ok" ? "error" : book.state, reason: book.state === "ok" ? "no-data" : book.reason };
  }
  ctx.requests = requests;
  return ctx;
}
