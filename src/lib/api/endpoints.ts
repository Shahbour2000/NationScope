import { ApiError } from "./errors";

/**
 * Registry of endpoints from the published OpenAPI spec (dev host). Listing an endpoint here
 * does NOT mean Main serves it or what it returns; availability is verified per environment
 * on /diagnostics before a feature depends on it.
 */

/** Matches the id pattern in the spec. */
const ID = /^[A-Za-z0-9_-]{1,80}$/;

export type Query = Record<string, string | number | boolean | undefined>;
export interface Endpoint {
  path: string;
  query?: Query;
}

function id(value: string, label: string): string {
  if (!ID.test(value)) throw new ApiError("invalid_request", `Invalid ${label}.`);
  return encodeURIComponent(value);
}
function int(name: string, v: number | undefined, min: number, max: number): number | undefined {
  if (v === undefined) return undefined;
  if (!Number.isInteger(v) || v < min || v > max) throw new ApiError("invalid_request", `${name} must be ${min} to ${max}.`);
  return v;
}
function text(name: string, v: string | undefined, max: number, min = 0): string | undefined {
  if (v === undefined) return undefined;
  if (v.length < min || v.length > max) throw new ApiError("invalid_request", `${name} must be ${min} to ${max} characters.`);
  return v;
}
function oneOf<T extends string>(name: string, v: T | undefined, allowed: readonly T[]): T | undefined {
  if (v === undefined) return undefined;
  if (!allowed.includes(v)) throw new ApiError("invalid_request", `${name} is not an allowed value.`);
  return v;
}
function optId(name: string, v: string | undefined): string | undefined {
  return v === undefined ? undefined : (id(v, name), v);
}
const ep = (path: string, query?: Query): Endpoint => ({ path, ...(query ? { query } : {}) });

const HISTORY_TYPES = ["ownership", "treaty", "battle", "election", "law", "tournament"] as const;
type HistoryType = (typeof HISTORY_TYPES)[number];
interface CompanyQuery { itemCode?: string; sort?: "invested" | "workers" | "level" | "newest"; limit?: number; offset?: number }
function companyQuery(o: CompanyQuery): Query {
  return {
    itemCode: text("itemCode", o.itemCode, 30),
    sort: oneOf("sort", o.sort, ["invested", "workers", "level", "newest"] as const),
    limit: int("limit", o.limit, 1, 100),
    offset: int("offset", o.offset, 0, 10000),
  };
}

export const endpoints = {
  game: () => ep("/game"),
  search: (q: string) => ep("/search", { q: text("q", q.trim(), 60, 2) }),

  countries: () => ep("/countries"),
  country: (countryId: string) => ep(`/countries/${id(countryId, "country id")}`),
  citizens: (countryId: string, o: { search?: string; limit?: number; offset?: number } = {}) =>
    ep(`/countries/${id(countryId, "country id")}/citizens`, {
      search: text("search", o.search, 40), limit: int("limit", o.limit, 1, 100), offset: int("offset", o.offset, 0, 10000),
    }),
  government: (countryId: string) => ep(`/countries/${id(countryId, "country id")}/government`),
  governmentHistory: (countryId: string, o: { limit?: number } = {}) =>
    ep(`/countries/${id(countryId, "country id")}/government/history`, { limit: int("limit", o.limit, 1, 200) }),
  countryElections: (countryId: string) => ep(`/countries/${id(countryId, "country id")}/elections`),
  countryParties: (countryId: string) => ep(`/countries/${id(countryId, "country id")}/parties`),
  countryLaws: (countryId: string, o: { filter?: "open" | "closed" | "all"; limit?: number; offset?: number } = {}) =>
    ep(`/countries/${id(countryId, "country id")}/laws`, {
      filter: oneOf("filter", o.filter, ["open", "closed", "all"] as const), limit: int("limit", o.limit, 1, 100), offset: int("offset", o.offset, 0, 10000),
    }),
  bank: (countryId: string) => ep(`/countries/${id(countryId, "country id")}/bank`),
  revolution: (countryId: string) => ep(`/countries/${id(countryId, "country id")}/revolution`),
  election: (electionId: string) => ep(`/elections/${id(electionId, "election id")}`),
  party: (partyId: string) => ep(`/parties/${id(partyId, "party id")}`),
  law: (proposalId: string) => ep(`/laws/${id(proposalId, "proposal id")}`),

  alliances: (o: { includeDisbanded?: boolean } = {}) => ep("/alliances", { includeDisbanded: o.includeDisbanded }),
  alliance: (allianceId: string) => ep(`/alliances/${id(allianceId, "alliance id")}`),

  regions: () => ep("/regions"),
  region: (regionId: string) => ep(`/regions/${id(regionId, "region id")}`),
  regionCompanies: (regionId: string) => ep(`/regions/${id(regionId, "region id")}/companies`),
  regionCampaign: (regionId: string) => ep(`/regions/${id(regionId, "region id")}/campaign`),
  company: (companyId: string) => ep(`/companies/${id(companyId, "company id")}`),
  jobs: () => ep("/jobs"),

  battles: (o: { status?: "active" | "finished"; type?: "territorial" | "resistance" | "revolution" | "tournament"; countryId?: string; regionId?: string; limit?: number } = {}) =>
    ep("/battles", {
      status: oneOf("status", o.status, ["active", "finished"] as const),
      type: oneOf("type", o.type, ["territorial", "resistance", "revolution", "tournament"] as const),
      countryId: optId("countryId", o.countryId), regionId: optId("regionId", o.regionId), limit: int("limit", o.limit, 1, 1000),
    }),
  battle: (battleId: string) => ep(`/battles/${id(battleId, "battle id")}`),
  battleContracts: (battleId: string) => ep(`/battles/${id(battleId, "battle id")}/contracts`),
  wars: (o: { status?: "active" | "ended"; countryId?: string } = {}) =>
    ep("/wars", { status: oneOf("status", o.status, ["active", "ended"] as const), countryId: optId("countryId", o.countryId) }),
  contracts: () => ep("/contracts"),
  auction: (auctionId: string) => ep(`/contracts/auctions/${id(auctionId, "auction id")}`),

  market: (o: { market?: string } = {}) => ep("/market", { market: optId("market", o.market) }),
  marketOrders: (itemCode: string, o: { market?: string } = {}) =>
    ep(`/market/${id(itemCode, "item code")}/orders`, { market: optId("market", o.market) }),
  marketHistory: (itemCode: string, o: { hours?: number; market?: string } = {}) =>
    ep(`/market/${id(itemCode, "item code")}/history`, { hours: int("hours", o.hours, 1, 720), market: optId("market", o.market) }),
  marketTrades: (itemCode: string, o: { limit?: number; market?: string } = {}) =>
    ep(`/market/${id(itemCode, "item code")}/trades`, { limit: int("limit", o.limit, 1, 100), market: optId("market", o.market) }),
  allTrades: (o: { limit?: number; market?: string } = {}) =>
    ep("/market/trades", { limit: int("limit", o.limit, 1, 100), market: optId("market", o.market) }),
  equipment: (o: { slot?: string; rarity?: string; sort?: "priceAsc" | "priceDesc" | "newest"; limit?: number; offset?: number } = {}) =>
    ep("/equipment", {
      slot: text("slot", o.slot, 20), rarity: text("rarity", o.rarity, 20),
      sort: oneOf("sort", o.sort, ["priceAsc", "priceDesc", "newest"] as const), limit: int("limit", o.limit, 1, 60), offset: int("offset", o.offset, 0, 10000),
    }),
  equipmentFloor: () => ep("/equipment/floor"),

  units: (o: { countryId?: string; search?: string; policy?: "open" | "application" } = {}) =>
    ep("/units", { countryId: optId("countryId", o.countryId), search: text("search", o.search, 40), policy: oneOf("policy", o.policy, ["open", "application"] as const) }),
  unit: (muId: string) => ep(`/units/${id(muId, "unit id")}`),

  player: (userId: string) => ep(`/players/${id(userId, "player id")}`),

  ranking: (board: string, o: { period?: "all" | "daily" | "weekly" | "monthly" | "current"; periodKey?: string; countryId?: string; limit?: number } = {}) =>
    ep(`/rankings/${id(board, "board")}`, {
      period: oneOf("period", o.period, ["all", "daily", "weekly", "monthly", "current"] as const),
      periodKey: text("periodKey", o.periodKey, 20), countryId: optId("countryId", o.countryId), limit: int("limit", o.limit, 1, 100),
    }),
  rankingArchive: (board: string) => ep(`/rankings/${id(board, "board")}/archive`),

  articles: (o: { category?: string; language?: string; countryId?: string; newspaperId?: string } = {}) =>
    ep("/articles", { category: text("category", o.category, 24), language: text("language", o.language, 8), countryId: optId("countryId", o.countryId), newspaperId: optId("newspaperId", o.newspaperId) }),
  article: (articleId: string) => ep(`/articles/${id(articleId, "article id")}`),
  newspaper: (newspaperId: string) => ep(`/newspapers/${id(newspaperId, "newspaper id")}`),

  history: (o: { type?: "ownership" | "treaty" | "battle" | "election" | "law" | "tournament"; countryId?: string; cursor?: string } = {}) =>
    ep("/history", {
      type: oneOf("type", o.type, ["ownership", "treaty", "battle", "election", "law", "tournament"] as const),
      countryId: optId("countryId", o.countryId), cursor: text("cursor", o.cursor, 120),
    }),
  tournaments: () => ep("/tournaments"),
  tournament: (editionId: string) => ep(`/tournaments/${id(editionId, "edition id")}`),

  // ---- Added from the production OpenAPI spec (https://app.ageofnations.world/api/docs/json) ----
  countrySummary: (countryId: string) => ep(`/countries/${id(countryId, "country id")}/summary`),
  governmentMembers: (countryId: string) => ep(`/countries/${id(countryId, "country id")}/government/members`),
  announcements: (countryId: string) => ep(`/countries/${id(countryId, "country id")}/announcements`),
  embassies: (countryId: string) => ep(`/countries/${id(countryId, "country id")}/embassies`),
  countryWars: (countryId: string, o: { status?: "active" | "ended" } = {}) =>
    ep(`/countries/${id(countryId, "country id")}/wars`, { status: oneOf("status", o.status, ["active", "ended"] as const) }),
  countryBattles: (countryId: string, o: { status?: "active" | "finished"; limit?: number } = {}) =>
    ep(`/countries/${id(countryId, "country id")}/battles`, { status: oneOf("status", o.status, ["active", "finished"] as const), limit: int("limit", o.limit, 1, 100) }),
  countryUnits: (countryId: string) => ep(`/countries/${id(countryId, "country id")}/units`),
  countryHistory: (countryId: string, o: { type?: HistoryType; cursor?: string } = {}) =>
    ep(`/countries/${id(countryId, "country id")}/history`, { type: oneOf("type", o.type, HISTORY_TYPES), cursor: text("cursor", o.cursor, 120) }),
  countryCompanies: (countryId: string, o: CompanyQuery = {}) => ep(`/countries/${id(countryId, "country id")}/companies`, companyQuery(o)),
  countryCompanyStats: (countryId: string) => ep(`/countries/${id(countryId, "country id")}/companies/stats`),
  companies: (o: CompanyQuery & { countryId?: string; regionId?: string; ownerId?: string } = {}) =>
    ep("/companies", { countryId: optId("countryId", o.countryId), regionId: optId("regionId", o.regionId), ownerId: optId("ownerId", o.ownerId), ...companyQuery(o) }),
  companyStats: (o: { countryId?: string } = {}) => ep("/companies/stats", { countryId: optId("countryId", o.countryId) }),
  playerStats: (userId: string) => ep(`/players/${id(userId, "player id")}/stats`),
  playerCompanies: (userId: string, o: CompanyQuery = {}) => ep(`/players/${id(userId, "player id")}/companies`, companyQuery(o)),
  /** Case, spaces, dots and dashes are ignored by the API; the name is URL-encoded here. */
  playerByName: (username: string) => ep(`/players/by-name/${encodeURIComponent(text("username", username.trim(), 40, 1)!)}`),
  /** Up to 25 comma-separated ids; unknown ids are omitted by the API. */
  players: (ids: readonly string[]) => {
    if (ids.length < 1 || ids.length > 25) throw new ApiError("invalid_request", "ids must contain 1 to 25 entries.");
    return ep("/players", { ids: ids.map((x) => id(x, "player id")).join(",") });
  },
  allianceLaws: (allianceId: string, o: { filter?: "open" | "closed" | "all"; limit?: number; offset?: number } = {}) =>
    ep(`/alliances/${id(allianceId, "alliance id")}/laws`, {
      filter: oneOf("filter", o.filter, ["open", "closed", "all"] as const), limit: int("limit", o.limit, 1, 100), offset: int("offset", o.offset, 0, 10000),
    }),
  /** Catalog of every law code with its parameters and voting rules. */
  lawsCatalog: () => ep("/laws"),
} as const;

/** Path templates from the spec (for the diagnostics explorer's allowlist). */
export const PATH_TEMPLATES: readonly string[] = [
  "/game", "/search", "/countries", "/countries/{id}", "/countries/{id}/citizens", "/countries/{id}/government",
  "/countries/{id}/government/history", "/countries/{id}/elections", "/countries/{id}/parties", "/countries/{id}/laws",
  "/countries/{id}/bank", "/countries/{id}/revolution", "/elections/{id}", "/parties/{id}", "/laws/{id}",
  "/alliances", "/alliances/{id}", "/regions", "/regions/{id}", "/regions/{id}/companies", "/regions/{id}/campaign",
  "/companies/{id}", "/jobs", "/battles", "/battles/{id}", "/battles/{id}/contracts", "/wars", "/contracts",
  "/contracts/auctions/{id}", "/market", "/market/{id}/orders", "/market/{id}/history", "/market/{id}/trades",
  "/market/trades", "/equipment", "/equipment/floor", "/units", "/units/{id}", "/players/{id}", "/rankings/{id}",
  "/rankings/{id}/archive", "/articles", "/articles/{id}", "/newspapers/{id}", "/history", "/tournaments", "/tournaments/{id}",
  // production spec additions
  "/countries/{id}/summary", "/countries/{id}/government/members", "/countries/{id}/announcements", "/countries/{id}/embassies",
  "/countries/{id}/wars", "/countries/{id}/battles", "/countries/{id}/units", "/countries/{id}/history", "/countries/{id}/companies",
  "/countries/{id}/companies/stats", "/alliances/{id}/laws", "/laws", "/companies", "/companies/stats", "/players",
  "/players/by-name/{name}", "/players/{id}/stats", "/players/{id}/companies",
];

const TEMPLATE_REGEXES = PATH_TEMPLATES.map(
  (t) => new RegExp(`^${t.replace(/\{id\}/g, "[A-Za-z0-9_-]{1,80}").replace(/\{name\}/g, "[^/]{1,120}")}$`),
);

export function isKnownPath(path: string): boolean {
  return TEMPLATE_REGEXES.some((r) => r.test(path));
}

/** Endpoints with no required parameters; safe to probe in bulk. */
export const PROBE_ENDPOINTS: readonly Endpoint[] = [
  endpoints.game(), endpoints.countries(), endpoints.alliances(), endpoints.regions(), endpoints.jobs(),
  endpoints.battles({ limit: 20 }), endpoints.wars(), endpoints.contracts(), endpoints.market(), endpoints.allTrades({ limit: 20 }),
  endpoints.equipment({ limit: 10 }), endpoints.equipmentFloor(), endpoints.units(), endpoints.tournaments(),
  endpoints.history(), endpoints.articles(), endpoints.companyStats(), endpoints.lawsCatalog(),
];
