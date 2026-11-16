import { endpoints, type Endpoint } from "@/lib/api/endpoints";
import { asRecord } from "@/lib/domain/parse";

/**
 * Automatic entity-id discovery. The API only hands out ids through list/search endpoints, so every id used to reach a detail
 * endpoint is read from a list response the app already loads (the same way a visitor reaches a page by clicking a link).
 * Pure functions: they take parsed JSON and never fetch, so they are testable against saved fixtures and reusable by diagnostics.
 */
const ID = /^[A-Za-z0-9_-]{1,80}$/;

export type IdKind =
  | "country" | "region" | "battle" | "item" | "board" | "player" | "company" | "unit" | "alliance"
  | "party" | "law" | "election" | "article" | "newspaper" | "tournament" | "auction";

/** Responses that carry ids. Keys are the endpoints they come from. */
export type SourceKey =
  | "countries" | "regions" | "battles" | "market" | "game" | "ranking" | "companies" | "units" | "alliances"
  | "articles" | "tournaments" | "contracts" | "countryParties" | "countryLaws" | "countryElections";
export type Sources = Partial<Record<SourceKey, unknown>>;

export interface Discovered {
  ids: Record<IdKind, string[]>;
  /** Which source supplied each kind (for reports). */
  from: Partial<Record<IdKind, SourceKey>>;
  /** A player's display name taken from the ranking, for the by-name endpoint. */
  playerName: string | null;
}

const KINDS: readonly IdKind[] = ["country", "region", "battle", "item", "board", "player", "company", "unit", "alliance", "party", "law", "election", "article", "newspaper", "tournament", "auction"];
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string | null => (typeof v === "string" && ID.test(v) ? v : null);

function take(out: string[], values: Iterable<string | null>, max: number) {
  for (const v of values) {
    if (v && !out.includes(v)) out.push(v);
    if (out.length >= max) return;
  }
}

/** Reads ids out of whatever sources are available; missing or unreadable sources simply yield no ids for their kinds. */
export function discoverIds(src: Sources, max = 3): Discovered {
  const ids = Object.fromEntries(KINDS.map((k) => [k, [] as string[]])) as Record<IdKind, string[]>;
  const from: Discovered["from"] = {};
  const add = (kind: IdKind, key: SourceKey, values: Iterable<string | null>) => {
    const before = ids[kind].length;
    take(ids[kind], values, max);
    if (ids[kind].length > before && !from[kind]) from[kind] = key;
  };
  const rec = (v: unknown) => asRecord(v);

  // Countries ordered by development so the first id is a country with real data.
  const countries = list(rec(src.countries).countries).map(rec).sort((a, b) => (Number(b.development) || 0) - (Number(a.development) || 0));
  add("country", "countries", countries.map((c) => str(c.id)));
  add("region", "regions", list(rec(src.regions).regions).map((r) => str(rec(r).id)));
  const battles = Array.isArray(src.battles) ? src.battles : list(rec(src.battles).battles);
  add("battle", "battles", battles.map((b) => str(rec(b).id)));
  add("item", "market", list(src.market).map((m) => str(rec(m).itemCode)));
  add("board", "game", list(rec(src.game).leaderboards).map((b) => str(rec(b).id)));
  const rows = list(rec(src.ranking).rows).map(rec);
  add("player", "ranking", rows.filter((r) => r.subjectType === "user").map((r) => str(r.subjectId)));
  const nm = rows.find((r) => r.subjectType === "user" && typeof r.name === "string" && r.name.length >= 1 && r.name.length <= 40);
  const comps = list(rec(src.companies).companies).map(rec);
  add("company", "companies", comps.map((c) => str(c.id)));
  if (ids.player.length === 0) add("player", "companies", comps.map((c) => str(rec(c.owner).id)));
  add("unit", "units", (Array.isArray(src.units) ? src.units : list(rec(src.units).units)).map((u) => str(rec(u).id)));
  add("alliance", "alliances", list(rec(src.alliances).alliances).map((a) => str(rec(a).id)));
  add("party", "countryParties", list(rec(src.countryParties).parties).map((p) => str(rec(p).id)));
  add("law", "countryLaws", list(rec(src.countryLaws).proposals).map((p) => str(rec(p).id)));
  const el = rec(src.countryElections);
  add("election", "countryElections", [...list(el.open), ...list(el.finished)].map((e) => str(rec(e).id)));
  const arts = list(rec(src.articles).items).map(rec);
  add("article", "articles", arts.map((a) => str(a.id)));
  add("newspaper", "articles", arts.map((a) => str(a.newspaperId)));
  const t = rec(src.tournaments);
  add("tournament", "tournaments", [rec(t.current).id, ...list(t.active).map((x) => rec(x).id), ...list(t.history).map((x) => rec(x).id)].map(str));
  add("auction", "contracts", list(rec(src.contracts).auctions).map((a) => str(rec(a).id)));
  return { ids, from, playerName: nm ? (nm.name as string) : null };
}

export interface IdProbe { kind: IdKind | "none"; id: string | null; label: string; endpoint: Endpoint | null; skipped?: string }

/** One entry per ID-requiring documented endpoint. An endpoint whose id could not be discovered is reported as skipped with the reason. */
export function idProbes(d: Discovered): IdProbe[] {
  const out: IdProbe[] = [];
  const each = (kind: IdKind, build: Array<[string, (id: string) => Endpoint]>) => {
    const id = d.ids[kind][0] ?? null;
    for (const [label, fn] of build) {
      out.push(id ? { kind, id, label, endpoint: fn(id) } : { kind, id: null, label, endpoint: null, skipped: `No ${kind} id found in the list responses (${LIST_FOR[kind]}).` });
    }
  };
  each("country", [
    ["country", endpoints.country], ["citizens", (c) => endpoints.citizens(c, { limit: 5 })], ["government", endpoints.government], ["government history", (c) => endpoints.governmentHistory(c, { limit: 5 })],
    ["elections", endpoints.countryElections], ["parties", endpoints.countryParties], ["laws", (c) => endpoints.countryLaws(c, { limit: 5 })], ["bank", endpoints.bank], ["revolution", endpoints.revolution],
    ["summary", endpoints.countrySummary], ["government members", endpoints.governmentMembers], ["announcements", endpoints.announcements], ["embassies", endpoints.embassies],
    ["wars", (c) => endpoints.countryWars(c)], ["battles", (c) => endpoints.countryBattles(c, { limit: 5 })], ["units", endpoints.countryUnits], ["history", (c) => endpoints.countryHistory(c)],
    ["companies", (c) => endpoints.countryCompanies(c, { limit: 5 })], ["company stats", endpoints.countryCompanyStats],
  ]);
  each("region", [["region", endpoints.region], ["region companies", endpoints.regionCompanies], ["region campaign", endpoints.regionCampaign]]);
  each("battle", [["battle", endpoints.battle], ["battle contracts", endpoints.battleContracts]]);
  each("item", [["market orders", (i) => endpoints.marketOrders(i)], ["market history", (i) => endpoints.marketHistory(i)], ["market trades", (i) => endpoints.marketTrades(i, { limit: 20 })]]);
  each("board", [["ranking", (b) => endpoints.ranking(b, { limit: 5 })], ["ranking archive", endpoints.rankingArchive]]);
  each("player", [["player", endpoints.player], ["player stats", endpoints.playerStats], ["player companies", (p) => endpoints.playerCompanies(p, { limit: 5 })]]);
  each("company", [["company", endpoints.company]]);
  each("unit", [["unit", endpoints.unit]]);
  each("alliance", [["alliance", endpoints.alliance], ["alliance laws", (a) => endpoints.allianceLaws(a, { limit: 5 })]]);
  each("party", [["party", endpoints.party]]);
  each("law", [["law", endpoints.law]]);
  each("election", [["election", endpoints.election]]);
  each("article", [["article", endpoints.article]]);
  each("newspaper", [["newspaper", endpoints.newspaper]]);
  each("tournament", [["tournament", endpoints.tournament]]);
  each("auction", [["auction", endpoints.auction]]);
  if (d.playerName) out.push({ kind: "player", id: d.playerName, label: "player by name", endpoint: endpoints.playerByName(d.playerName) });
  if (d.ids.player.length > 0) out.push({ kind: "player", id: d.ids.player.slice(0, 3).join(","), label: "players (batch)", endpoint: endpoints.players(d.ids.player.slice(0, 3)) });
  return out;
}

const LIST_FOR: Record<IdKind, string> = {
  country: "GET /countries", region: "GET /regions", battle: "GET /battles", item: "GET /market", board: "GET /game", player: "GET /rankings/playerDamage",
  company: "GET /companies", unit: "GET /units", alliance: "GET /alliances", party: "GET /countries/{id}/parties", law: "GET /countries/{id}/laws",
  election: "GET /countries/{id}/elections", article: "GET /articles", newspaper: "GET /articles", tournament: "GET /tournaments", auction: "GET /contracts",
};

/** The list endpoints to read, in order. Country-scoped lists need the first discovered country, so they are a second step. */
export const DISCOVERY_SOURCES: ReadonlyArray<[SourceKey, Endpoint]> = [
  ["countries", endpoints.countries()], ["regions", endpoints.regions()], ["battles", endpoints.battles({ limit: 20 })], ["market", endpoints.market()],
  ["game", endpoints.game()], ["ranking", endpoints.ranking("playerDamage", { period: "all", limit: 10 })], ["companies", endpoints.companies({ limit: 20 })],
  ["units", endpoints.units()], ["alliances", endpoints.alliances()], ["articles", endpoints.articles()], ["tournaments", endpoints.tournaments()], ["contracts", endpoints.contracts()],
];
export function countryScopedSources(countryId: string): ReadonlyArray<[SourceKey, Endpoint]> {
  return [["countryParties", endpoints.countryParties(countryId)], ["countryLaws", endpoints.countryLaws(countryId, { filter: "all", limit: 10 })], ["countryElections", endpoints.countryElections(countryId)]];
}
