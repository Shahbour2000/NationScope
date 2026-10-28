import { endpoints, type Endpoint } from "@/lib/api/endpoints";

export interface PageParams { limit: number; offset: number }
export interface SubDef { slug: string; endpoint: (id: string, p: PageParams) => Endpoint; paged?: boolean }
export interface SectionDef {
  slug: string;
  list?: (p: PageParams) => Endpoint;
  paged?: boolean;
  pageSize?: number;
  detail?: (id: string) => Endpoint;
  /** Link list rows to /{slug}/{id} even without a detail endpoint (the detail route redirects to the first sub-page). */
  linkRows?: boolean;
  subs?: SubDef[];
}

/** Single registry of the documented endpoints the generic pages render. Add a section here to add a page. */
export const SECTIONS: Record<string, SectionDef> = {
  countries: {
    slug: "countries", list: () => endpoints.countries(),
    // Overview tab = the documented one-call summary (profile, government, wars, battles, laws, elections, announcements, embassies).
    detail: endpoints.countrySummary,
    subs: [
      { slug: "government", endpoint: endpoints.government },
      { slug: "government-history", endpoint: (id) => endpoints.governmentHistory(id, { limit: 100 }) },
      { slug: "citizens", paged: true, endpoint: (id, p) => endpoints.citizens(id, p) },
      { slug: "elections", endpoint: endpoints.countryElections },
      { slug: "parties", endpoint: endpoints.countryParties },
      { slug: "laws", paged: true, endpoint: (id, p) => endpoints.countryLaws(id, { filter: "all", ...p }) },
      { slug: "announcements", endpoint: endpoints.announcements },
      { slug: "embassies", endpoint: endpoints.embassies },
      { slug: "bank", endpoint: endpoints.bank },
      { slug: "companies", paged: true, endpoint: (id, p) => endpoints.countryCompanies(id, p) },
      { slug: "company-stats", endpoint: endpoints.countryCompanyStats },
      { slug: "units", endpoint: endpoints.countryUnits },
      { slug: "wars", endpoint: (id) => endpoints.countryWars(id) },
      { slug: "battles", endpoint: (id) => endpoints.countryBattles(id, { limit: 100 }) },
      { slug: "events", endpoint: (id) => endpoints.countryHistory(id) },
      { slug: "revolution", endpoint: endpoints.revolution },
    ],
  },
  alliances: {
    slug: "alliances", list: () => endpoints.alliances(), detail: endpoints.alliance,
    subs: [{ slug: "laws", paged: true, endpoint: (id, p) => endpoints.allianceLaws(id, { filter: "all", ...p }) }],
  },
  regions: {
    slug: "regions", list: () => endpoints.regions(), detail: endpoints.region,
    subs: [{ slug: "companies", endpoint: endpoints.regionCompanies }, { slug: "campaign", endpoint: endpoints.regionCampaign }],
  },
  units: { slug: "units", detail: endpoints.unit },
  battles: {
    slug: "battles", list: () => endpoints.battles({ limit: 100 }), detail: endpoints.battle,
    subs: [{ slug: "contracts", endpoint: endpoints.battleContracts }],
  },
  wars: { slug: "wars", list: () => endpoints.wars() },
  contracts: { slug: "contracts", list: () => endpoints.contracts() },
  market: {
    slug: "market", list: () => endpoints.market(), linkRows: true,
    subs: [
      { slug: "orders", endpoint: (id) => endpoints.marketOrders(id) },
      { slug: "history", endpoint: (id) => endpoints.marketHistory(id, { hours: 168 }) },
      { slug: "trades", endpoint: (id) => endpoints.marketTrades(id, { limit: 50 }) },
    ],
  },
  equipment: { slug: "equipment", list: (p) => endpoints.equipment(p), paged: true, pageSize: 24 },
  "equipment-floor": { slug: "equipment-floor", list: () => endpoints.equipmentFloor() },
  companies: { slug: "companies", list: (p) => endpoints.companies(p), paged: true, detail: endpoints.company },
  "company-stats": { slug: "company-stats", list: () => endpoints.companyStats() },
  jobs: { slug: "jobs", list: () => endpoints.jobs() },
  history: { slug: "history", list: () => endpoints.history() },
  articles: { slug: "articles", list: () => endpoints.articles(), detail: endpoints.article },
  tournaments: { slug: "tournaments", list: () => endpoints.tournaments(), detail: endpoints.tournament },
  game: { slug: "game", list: () => endpoints.game() },
  laws: { slug: "laws", list: () => endpoints.lawsCatalog(), detail: endpoints.law },
  players: {
    slug: "players", detail: endpoints.player,
    subs: [
      { slug: "stats", endpoint: endpoints.playerStats },
      { slug: "companies", paged: true, endpoint: (id, p) => endpoints.playerCompanies(id, p) },
    ],
  },
  parties: { slug: "parties", detail: endpoints.party },
  elections: { slug: "elections", detail: endpoints.election },
  newspapers: { slug: "newspapers", detail: endpoints.newspaper },
  rankings: {
    slug: "rankings", detail: (b) => endpoints.ranking(b, { limit: 100 }),
    subs: [{ slug: "archive", endpoint: endpoints.rankingArchive }],
  },
};

export const DEFAULT_PAGE_SIZE = 50;

export function parseOffset(raw: string | undefined): number {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 && n <= 10000 ? n : 0;
}
