import { buildMarketSnapshot, offersToCandidates, type CandidateBuild, type MarketRowLike, type MarketSnapshot, type OfferLike } from "./market";
import { buildPlayerState, type CompanyLike, type PlayerState, type ProfileLike, type UserInputs } from "./player-state";

/** Pure orchestration of an "Import Profile": every request is independent; one failure never hides the rest; failures are reported, never defaulted. */
export interface ImportDeps {
  profile: (id: string) => Promise<{ player: ProfileLike | null }>;
  companies: (id: string) => Promise<{ rows: CompanyLike[] }>;
  stats: (id: string) => Promise<unknown>;
  market: () => Promise<{ rows: MarketRowLike[] }>;
  /** `nextOffset` (as returned by the existing getEquipmentOffers): a number means the API reported a further page that was NOT read; undefined/null = no further page reported. */
  offers: (slot: string) => Promise<{ rows: OfferLike[]; nextOffset?: number | null }>;
}
export const EQUIPMENT_SLOTS = ["weapon", "helmet", "gloves", "chest", "pants", "boots"] as const;
/** Per-slot account of what the offer import actually read. `moreAvailable` is true when the API reported a further page that was not fetched (so pricier or stronger offers were never seen). */
export interface OfferCoverage { fetched: number; moreAvailable: boolean }
export interface BuildImport { state: PlayerState; market: MarketSnapshot | null; candidates: CandidateBuild | null; failures: Record<string, string>; /** absent on imports built by hand (older callers/tests) */ offerCoverage?: Record<string, OfferCoverage> }
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function importForBuild(playerId: string, deps: ImportDeps, user?: UserInputs): Promise<BuildImport | null> {
  const failures: Record<string, string> = {};
  const [prof, comps, stats, market, ...offers] = await Promise.allSettled([deps.profile(playerId), deps.companies(playerId), deps.stats(playerId), deps.market(), ...EQUIPMENT_SLOTS.map((s) => deps.offers(s))]);
  if (prof.status === "rejected") throw prof.reason;
  const player = prof.value.player;
  if (!player) return null;
  if (comps.status === "rejected") failures["companies"] = msg(comps.reason);
  if (stats.status === "rejected") failures["stats"] = msg(stats.reason);
  if (market.status === "rejected") failures["market"] = msg(market.reason);
  const offerRows: OfferLike[] = []; const offerCoverage: Record<string, OfferCoverage> = {};
  offers.forEach((o, i) => {
    const slot = EQUIPMENT_SLOTS[i]!;
    if (o.status === "fulfilled") { offerRows.push(...o.value.rows); offerCoverage[slot] = { fetched: o.value.rows.length, moreAvailable: typeof o.value.nextOffset === "number" }; }
    else failures[`equipment:${slot}`] = msg(o.reason);
  });
  const state = buildPlayerState({ profile: player, companies: comps.status === "fulfilled" ? comps.value.rows : null, statsRaw: stats.status === "fulfilled" ? stats.value : undefined, user });
  return { state, failures, offerCoverage, market: market.status === "fulfilled" ? buildMarketSnapshot(market.value.rows) : null, candidates: offerRows.length ? offersToCandidates(offerRows) : null };
}
