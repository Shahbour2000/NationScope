import { buildMarketSnapshot, offersToCandidates, type CandidateBuild, type MarketRowLike, type MarketSnapshot, type OfferLike } from "./market";
import { buildPlayerState, type CompanyLike, type PlayerState, type ProfileLike, type UserInputs } from "./player-state";

/** Pure orchestration of an "Import Profile": every request is independent; one failure never hides the rest; failures are reported, never defaulted. */
export interface ImportDeps {
  profile: (id: string) => Promise<{ player: ProfileLike | null }>;
  companies: (id: string) => Promise<{ rows: CompanyLike[] }>;
  stats: (id: string) => Promise<unknown>;
  market: () => Promise<{ rows: MarketRowLike[] }>;
  /** Equipment offers of one slot, cheapest first. `offset` is the `nextOffset` of the previous page (omitted for the first page). A numeric `nextOffset` in the reply means the API reported another page. */
  offers: (slot: string, offset?: number) => Promise<{ rows: OfferLike[]; nextOffset?: number | null }>;
}
export const EQUIPMENT_SLOTS = ["weapon", "helmet", "gloves", "chest", "pants", "boots"] as const;
/** Per-slot account of what the offer import actually read. `moreAvailable` is true when the API reported a further page that was not fetched (so pricier or stronger offers were never seen). */
export interface OfferCoverage { fetched: number; pages: number; moreAvailable: boolean }
/** Offers per request (the API maximum, endpoints.equipment) and pages read per slot: at most 6 slots x 3 pages = 18 requests, i.e. the 180 cheapest offers of each slot. */
export const OFFER_PAGE_SIZE = 60;
export const OFFER_MAX_PAGES = 3;

/** Follows `nextOffset` for one slot with hard bounds: page cap, no repeated or backwards offset, no empty page. Rows already read survive a later failure. */
async function readSlotOffers(deps: ImportDeps, slot: string, maxPages: number): Promise<{ rows: OfferLike[]; pages: number; moreAvailable: boolean; error: unknown }> {
  const rows: OfferLike[] = []; let offset: number | undefined, pages = 0, more = false, error: unknown = null;
  while (pages < maxPages) {
    let page: { rows: OfferLike[]; nextOffset?: number | null };
    try { page = await deps.offers(slot, offset); } catch (e) { error = e; more = pages > 0; break; }
    pages++; rows.push(...page.rows);
    const next = page.nextOffset;
    if (typeof next !== "number") { more = false; break; }
    more = true;
    if (page.rows.length === 0 || next <= (offset ?? 0)) break; // an empty page or an offset that does not advance would loop: stop and report
    offset = next;
  }
  return { rows, pages, moreAvailable: more, error };
}
export interface BuildImport { state: PlayerState; market: MarketSnapshot | null; candidates: CandidateBuild | null; failures: Record<string, string>; /** absent on imports built by hand (older callers/tests) */ offerCoverage?: Record<string, OfferCoverage> }
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function importForBuild(playerId: string, deps: ImportDeps, user?: UserInputs): Promise<BuildImport | null> {
  const failures: Record<string, string> = {};
  const [prof, comps, stats, market, ...offers] = await Promise.allSettled([deps.profile(playerId), deps.companies(playerId), deps.stats(playerId), deps.market(), ...EQUIPMENT_SLOTS.map((s) => readSlotOffers(deps, s, OFFER_MAX_PAGES))]);
  if (prof.status === "rejected") throw prof.reason;
  const player = prof.value.player;
  if (!player) return null;
  if (comps.status === "rejected") failures["companies"] = msg(comps.reason);
  if (stats.status === "rejected") failures["stats"] = msg(stats.reason);
  if (market.status === "rejected") failures["market"] = msg(market.reason);
  const offerRows: OfferLike[] = []; const offerCoverage: Record<string, OfferCoverage> = {};
  offers.forEach((o, i) => {
    const slot = EQUIPMENT_SLOTS[i]!;
    if (o.status === "rejected") { failures[`equipment:${slot}`] = msg(o.reason); return; }
    const r = o.value;
    if (r.error) failures[`equipment:${slot}`] = msg(r.error);
    if (r.pages > 0) { offerRows.push(...r.rows); offerCoverage[slot] = { fetched: r.rows.length, pages: r.pages, moreAvailable: r.moreAvailable }; }
  });
  const state = buildPlayerState({ profile: player, companies: comps.status === "fulfilled" ? comps.value.rows : null, statsRaw: stats.status === "fulfilled" ? stats.value : undefined, user });
  return { state, failures, offerCoverage, market: market.status === "fulfilled" ? buildMarketSnapshot(market.value.rows) : null, candidates: offerRows.length ? offersToCandidates(offerRows) : null };
}
