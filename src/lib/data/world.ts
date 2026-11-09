import { getConfig } from "@/lib/config/env";
import { z } from "zod";
import { endpoints } from "@/lib/api/endpoints";
import { getApiClient } from "@/lib/api/instance";
import { anyJson } from "@/lib/api/schemas";
import type { Directory } from "@/lib/domain/directory";
import { asRecord, parseRows } from "@/lib/domain/parse";
import { parseBattleDetail } from "@/lib/domain/battle-detail";
import { electionCalendarSchema, electionSchema, governmentHistorySchema, governmentSchema, partySchema, lawDefSchema, lawsCatalogSchema, memberSchema, allianceSchema, articleSchema, battleSchema, citizenSchema, countrySchema, historyItemSchema, leaderboardSchema, rankingRowSchema, summarySchema, warSchema } from "@/lib/domain/world";
import type { Endpoint } from "@/lib/api/endpoints";

const get = (e: Endpoint) => getApiClient().get(e.path, { schema: anyJson, query: e.query });
const listKey = (data: unknown, key: string): unknown => (Array.isArray(data) ? data : asRecord(data)[key]);

export async function getCountries() {
  const { data, meta } = await get(endpoints.countries());
  const { rows, skipped } = parseRows(listKey(data, "countries"), countrySchema);
  const o = asRecord(data);
  return { countries: rows, skipped, worldDevelopment: typeof o.worldDevelopment === "number" ? o.worldDevelopment : null, meta };
}

export function toDirectory(countries: { id: string; name: string; scheme?: string | null }[]): Directory {
  return {
    countries: Object.fromEntries(countries.map((c) => [c.id, { name: c.name, scheme: c.scheme ?? null }])),
    regionNames: {},
  };
}

export async function getCountrySummary(id: string) {
  const { data, meta } = await get(endpoints.countrySummary(id));
  const parsed = summarySchema.safeParse(data);
  return { summary: parsed.success ? parsed.data : null, meta };
}

/**
 * All wars. Active and ended wars are requested separately (`status=active` / `status=ended`) so a long active list
 * cannot crowd ended wars out of a size-capped response; rows are merged and de-duplicated by id.
 */
export async function getWars() {
  const [active, ended] = await Promise.all([get(endpoints.wars({ status: "active" })), get(endpoints.wars({ status: "ended" })).catch(() => null)]);
  const a = parseRows(listKey(active.data, "wars"), warSchema);
  const e = ended ? parseRows(listKey(ended.data, "wars"), warSchema) : { rows: [], skipped: 0 };
  const seen = new Set<string>();
  const rows = [...a.rows, ...e.rows].filter((w) => (seen.has(w.id) ? false : (seen.add(w.id), true)));
  return { rows, skipped: a.skipped + e.skipped, meta: active.meta, endedMissing: ended === null };
}

export async function getWar(id: string) {
  const res = await getWars();
  return { war: res.rows.find((w) => w.id === id) ?? null, meta: res.meta };
}

/** Battles between two countries (either direction), newest first. The list endpoint has no war id, so a war's battles are matched by country pair. */
export async function getBattlesBetween(a: string, b: string) {
  const [x, y] = await Promise.all([get(endpoints.battles({ countryId: a, limit: 100 })), get(endpoints.battles({ countryId: a, status: "finished", limit: 100 }))]);
  const rows = [...parseRows(listKey(x.data, "battles"), battleSchema).rows, ...parseRows(listKey(y.data, "battles"), battleSchema).rows];
  const seen = new Set<string>();
  return rows.filter((r) => ((r.attackerCountryId === a && r.defenderCountryId === b) || (r.attackerCountryId === b && r.defenderCountryId === a)) && !seen.has(r.id) && (seen.add(r.id), true));
}

export async function getBattles(status?: "active" | "finished") {
  const { data, meta } = await get(endpoints.battles({ status, limit: 100 }));
  return { ...parseRows(listKey(data, "battles"), battleSchema), meta };
}

export async function getAlliances() {
  const { data, meta } = await get(endpoints.alliances());
  return { ...parseRows(listKey(data, "alliances"), allianceSchema), meta };
}

export async function getCitizens(countryId: string, o: { offset: number; limit: number; search?: string }) {
  const { data, meta } = await get(endpoints.citizens(countryId, o));
  const rec = asRecord(data);
  return { ...parseRows(rec.citizens, citizenSchema), total: typeof rec.total === "number" ? rec.total : null, hasMore: rec.hasMore === true, meta };
}

export async function getGameLeaderboards() {
  const { data, meta } = await get(endpoints.game());
  return { ...parseRows(asRecord(data).leaderboards, leaderboardSchema), meta };
}

export async function getRanking(board: string, o: { period?: "all" | "daily" | "weekly" | "monthly" | "current"; limit?: number }) {
  const { data, meta } = await get(endpoints.ranking(board, o));
  const rec = asRecord(data);
  return { ...parseRows(rec.rows, rankingRowSchema), board: asRecord(rec.board), period: typeof rec.period === "string" ? rec.period : null, meta };
}

export async function getHistory() {
  const { data, meta } = await get(endpoints.history());
  return { ...parseRows(asRecord(data).items, historyItemSchema), meta };
}

export async function getArticles() {
  const { data, meta } = await get(endpoints.articles());
  return { ...parseRows(asRecord(data).items, articleSchema), meta };
}

export async function getGovernment(countryId: string) {
  const [gov, mem] = await Promise.all([get(endpoints.government(countryId)), get(endpoints.governmentMembers(countryId))]);
  const parsed = governmentSchema.safeParse(gov.data);
  const rec = asRecord(mem.data);
  return { government: parsed.success ? parsed.data : null, ...parseRows(rec.members, memberSchema), countryName: typeof rec.countryName === "string" ? rec.countryName : null, meta: mem.meta };
}

/** Optional tab counts for the country header: companies and military units (two cached requests; failures just omit the count). */
export async function getCountryCounts(countryId: string) {
  const [co, un] = await Promise.allSettled([get(endpoints.countryCompanyStats(countryId)), get(endpoints.countryUnits(countryId))]);
  const companies = co.status === "fulfilled" ? (typeof asRecord(asRecord(co.value.data).totals).companies === "number" ? (asRecord(asRecord(co.value.data).totals).companies as number) : null) : null;
  const list = un.status === "fulfilled" ? (Array.isArray(un.value.data) ? un.value.data : asRecord(un.value.data).units) : null;
  return { companies, units: Array.isArray(list) ? list.length : null };
}

export async function getBattleRules() {
  const { data } = await get(endpoints.game());
  const rules = asRecord(asRecord(data).battleRules);
  const num = (v: unknown) => (typeof v === "number" ? v : null);
  return { roundsToWin: num(rules.roundsToWin), pointsToWinRound: num(rules.pointsToWinRound) };
}

export const _z = z; // keep zod import explicit for schema re-exports

/** GET /search?q=: groups players/countries/units/parties/alliances (player rows verified: id, username, avatarUrl, countryId, level; other groups parsed defensively: id + name). */
export async function searchUpstream(q: string) {
  const e = endpoints.search(q);
  const { data } = await get(e);
  return asRecord(data);
}

/** GET /battles/{id} (shape verified, see src/lib/domain/battle-detail.ts). battle = null when the body is not a battle object. */
export async function getBattleDetail(id: string) {
  const { data, meta } = await get(endpoints.battle(id));
  return { battle: parseBattleDetail(data, getConfig().origin), meta };
}

/** Office history of one country (appointments and elections, with start and end). The API caps it at 200 rows. */
export async function getGovernmentHistory(countryId: string) {
  const { data, meta } = await get(endpoints.governmentHistory(countryId, { limit: 200 }));
  return { ...parseRows(listKey(data, "items"), governmentHistorySchema), meta };
}

export interface BattleHistory {
  rows: ReturnType<typeof parseRows<typeof battleSchema>>["rows"];
  /** The `limit` that was actually accepted by the API. */
  limit: number;
  /** True when the API returned fewer rows than asked for, i.e. it has no older finished battles to give. */
  exhausted: boolean;
  meta: Awaited<ReturnType<typeof get>>["meta"];
}

/**
 * Finished battles, newest first. Asks for a large page first and falls back to the documented maximum (100) if the
 * API rejects it. The API exposes no offset/cursor/date filter for battles, so one page is all that can be fetched.
 */
export async function getBattleHistory(): Promise<BattleHistory> {
  for (const limit of [500, 100]) {
    try {
      const { data, meta } = await get(endpoints.battles({ status: "finished", limit }));
      const rows = parseRows(listKey(data, "battles"), battleSchema).rows;
      return { rows, limit, exhausted: rows.length < limit, meta };
    } catch (e) {
      if (limit === 100) throw e;
    }
  }
  throw new Error("unreachable");
}

export async function getLawsCatalog() {
  const { data, meta } = await get(endpoints.lawsCatalog());
  const head = lawsCatalogSchema.safeParse(data);
  if (!head.success) throw new Error("Unexpected /laws response");
  const parsed = parseRows(head.data.laws, lawDefSchema);
  return { laws: parsed.rows, skipped: parsed.skipped, costItem: head.data.costItem ?? null, voteHours: head.data.voteHours ?? null, answerHours: head.data.counterpartAnswerHours ?? null, maxTax: head.data.maxTaxPercent ?? null, meta };
}

export async function getCountryParties(countryId: string) {
  const { data, meta } = await get(endpoints.countryParties(countryId));
  const obj = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  const parsed = parseRows(Array.isArray(obj.parties) ? obj.parties : [], partySchema);
  return { parties: parsed.rows, skipped: parsed.skipped, createCost: typeof obj.createCost === "string" ? obj.createCost : null, meta };
}

export async function getCountryElections(countryId: string) {
  const { data, meta } = await get(endpoints.countryElections(countryId));
  const obj = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  const list = (v: unknown) => parseRows(Array.isArray(v) ? v : [], electionSchema).rows;
  return { open: list(obj.open), finished: list(obj.finished), calendar: parseRows(Array.isArray(obj.calendar) ? obj.calendar : [], electionCalendarSchema).rows, meta };
}

/** GET /regions: the world map (regions with owner/core owner/deposit, plus the battles running on it). */
export async function getRegionsMap() {
  const { data, meta } = await get(endpoints.regions());
  const obj = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  const regionRow = z.object({ id: z.string(), countryId: z.string().nullish(), coreCountryId: z.string().nullish(), deposit: z.object({ type: z.string().nullish(), bonusPercent: z.number().nullish(), endsAt: z.string().nullish() }).passthrough().nullish() }).passthrough();
  const battleRow = z.object({ id: z.string(), regionId: z.string().nullish(), type: z.string().nullish(), attackerCountryId: z.string().nullish(), defenderCountryId: z.string().nullish() }).passthrough();
  const regions = parseRows(Array.isArray(obj.regions) ? obj.regions : [], regionRow);
  const battles = parseRows(Array.isArray(obj.battles) ? obj.battles : [], battleRow);
  return { regions: regions.rows, battles: battles.rows, skipped: regions.skipped, meta };
}

/** GET /contracts: mercenary bounties on running battles plus auctions/contracts (shape verified for rules and bounties). */
export async function getContracts() {
  const { data, meta } = await get(endpoints.contracts());
  const o = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  const bounty = z.object({
    id: z.string(), side: z.string().nullish(), perK: z.string().nullish(), budget: z.string().nullish(), remaining: z.string().nullish(), status: z.string().nullish(), earned: z.string().nullish(),
    battle: z.object({ id: z.string(), type: z.string().nullish(), status: z.string().nullish(), regionId: z.string().nullish(), attackerCountryId: z.string().nullish(), defenderCountryId: z.string().nullish() }).passthrough().nullish(),
    funder: z.object({ type: z.string().nullish(), id: z.string().nullish(), name: z.string().nullish() }).passthrough().nullish(),
  }).passthrough();
  const bounties = parseRows(Array.isArray(o.bounties) ? o.bounties : [], bounty);
  const rules = (o.rules && typeof o.rules === "object" ? o.rules : {}) as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === "number" ? v : null);
  return {
    bounties: bounties.rows,
    auctions: Array.isArray(o.auctions) ? o.auctions : [],
    myContracts: Array.isArray(o.myContracts) ? o.myContracts : [],
    issued: Array.isArray(o.issuedContracts) ? o.issuedContracts : [],
    fee: num(rules.acceptanceFeePercent), penalty: num(rules.cancellationPenaltyPercent), expiryHours: num(rules.contractExpiryHours),
    meta,
  };
}

/** GET /tournaments: the running/most recent edition with its entrants, the next scheduled one, past editions and prize rules. */
export async function getTournaments() {
  const { data, meta } = await get(endpoints.tournaments());
  const o = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  const reg = z.object({ id: z.string(), entrantId: z.string(), seed: z.number().nullish(), name: z.string().nullish(), registrarName: z.string().nullish() }).passthrough();
  const edition = z.object({
    id: z.string(), kind: z.string(), name: z.string().nullish(), status: z.string().nullish(), periodKey: z.string().nullish(), startsAt: z.string().nullish(), registrationOpensAt: z.string().nullish(),
    rarityCap: z.string().nullish(), totalRounds: z.number().nullish(), winnerId: z.string().nullish(), runnerUpId: z.string().nullish(), finishedAt: z.string().nullish(), registrationOpen: z.boolean().nullish(),
    registrations: z.array(z.unknown()).nullish(),
  }).passthrough();
  const next = z.object({ kind: z.string(), name: z.string().nullish(), periodKey: z.string().nullish(), registrationOpensAt: z.string().nullish(), startsAt: z.string().nullish() }).passthrough();
  const cur = edition.safeParse(o.current);
  const nx = next.safeParse(o.next);
  const rules = (o.rules && typeof o.rules === "object" ? o.rules : {}) as Record<string, unknown>;
  const rewards = (rules.rewards && typeof rules.rewards === "object" ? rules.rewards : {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v : null);
  const current = cur.success ? { ...cur.data, entrants: parseRows(cur.data.registrations ?? [], reg).rows } : null;
  return {
    current,
    next: nx.success ? nx.data : null,
    history: parseRows(Array.isArray(o.history) ? o.history : [], edition).rows,
    prizes: { winner: str(rewards.winner), runnerUp: str(rewards.runnerUp), participant: str(rewards.participant) },
    entryFee: str(rules.entryFee), cadenceWeeks: typeof rules.cadenceWeeks === "number" ? rules.cadenceWeeks : null, minRegistrations: typeof rules.minRegistrations === "number" ? rules.minRegistrations : null,
    meta,
  };
}

const lawProposal = z.object({
  id: z.string(), lawCode: z.string(), params: z.record(z.string(), z.unknown()).nullish(), proposerId: z.string().nullish(), proposerName: z.string().nullish(), status: z.string().nullish(),
  paperCost: z.number().nullish(), yes: z.number().nullish(), no: z.number().nullish(), electorateSize: z.number().nullish(), opensAt: z.string().nullish(), closesAt: z.string().nullish(),
  executedAt: z.string().nullish(), closedAt: z.string().nullish(), failureReason: z.string().nullish(), counterpartCountryId: z.string().nullish(),
}).passthrough();
export type LawProposal = z.infer<typeof lawProposal>;

/** GET /countries/{id}/laws: proposals with their vote counts (shape verified against tests/fixtures/real/laws-eg.json). */
export async function getCountryLawProposals(countryId: string, o: { filter?: "open" | "closed" | "all"; offset?: number; limit?: number } = {}) {
  const { data, meta } = await get(endpoints.countryLaws(countryId, { filter: o.filter ?? "all", offset: o.offset, limit: o.limit ?? 30 }));
  const obj = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  const parsed = parseRows(Array.isArray(obj.proposals) ? obj.proposals : [], lawProposal);
  return { proposals: parsed.rows, skipped: parsed.skipped, hasMore: obj.hasMore === true, meta };
}

const embassy = z.object({ countryId: z.string(), openedAt: z.string().nullish(), mutual: z.boolean().nullish() }).passthrough();
/** GET /countries/{id}/embassies: embassies this country has abroad and those it hosts. */
export async function getCountryEmbassies(countryId: string) {
  const { data, meta } = await get(endpoints.embassies(countryId));
  const obj = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  return { abroad: parseRows(Array.isArray(obj.abroad) ? obj.abroad : [], embassy).rows, hosted: parseRows(Array.isArray(obj.hosted) ? obj.hosted : [], embassy).rows, meta };
}

/** GET /countries/{id}/bank: money system, taxes, port and embargoes (shape verified against tests/fixtures/real/bank-eg.json). */
export async function getCountryBank(countryId: string) {
  const { data, meta } = await get(endpoints.bank(countryId));
  const o = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v : null);
  const num = (v: unknown) => (typeof v === "number" ? v : null);
  const cur = (o.currency && typeof o.currency === "object" ? o.currency : {}) as Record<string, unknown>;
  const port = (o.port && typeof o.port === "object" ? o.port : null) as Record<string, unknown> | null;
  const emb = z.object({ id: z.string(), byCountryId: z.string(), onCountryId: z.string(), endsAt: z.string().nullish(), imposedByUs: z.boolean().nullish() }).passthrough();
  return {
    currencyCode: str(cur.code), currencyName: str(cur.name), backed: o.backed === true, treasury: str(o.treasuryGold), mintCap: str(o.mintCap), supply: str(o.supply), inCirculation: str(o.inCirculation), reserve: str(o.reserve),
    fixedRate: str(o.fixedRate), buyback: o.buybackEnabled === true, importTax: num(o.importTax), exportTax: num(o.exportTax), maxTradeTax: num(o.maxTradeTax), exchangeFee: num(o.exchangeFee), maxExchangeFee: num(o.maxExchangeFee),
    port: port ? { level: num(port.level) ?? 0, max: num(port.max), nextCost: num(port.nextCost) } : null,
    embargoes: parseRows(Array.isArray(o.embargoes) ? o.embargoes : [], emb).rows, meta,
  };
}

/** Wars of one country (as either side), active and ended requested separately, merged by id. */
export async function getCountryWars(countryId: string) {
  const [a, e] = await Promise.all([get(endpoints.countryWars(countryId, { status: "active" })), get(endpoints.countryWars(countryId, { status: "ended" })).catch(() => null)]);
  const pa = parseRows(listKey(a.data, "wars"), warSchema), pe = e ? parseRows(listKey(e.data, "wars"), warSchema) : { rows: [], skipped: 0 };
  const seen = new Set<string>();
  return { rows: [...pa.rows, ...pe.rows].filter((w) => (seen.has(w.id) ? false : (seen.add(w.id), true))), meta: a.meta };
}

/** Battles involving one country: running ones plus the most recent finished ones. */
export async function getCountryBattles(countryId: string) {
  const [a, f] = await Promise.all([get(endpoints.countryBattles(countryId, { status: "active", limit: 100 })), get(endpoints.countryBattles(countryId, { status: "finished", limit: 50 })).catch(() => null)]);
  const pa = parseRows(listKey(a.data, "battles"), battleSchema), pf = f ? parseRows(listKey(f.data, "battles"), battleSchema) : { rows: [], skipped: 0 };
  const seen = new Set<string>();
  return { rows: [...pa.rows, ...pf.rows].filter((b) => (seen.has(b.id) ? false : (seen.add(b.id), true))), meta: a.meta };
}

/** World events that involve one country (cursor-paged by the API). */
export async function getCountryHistory(countryId: string, cursor?: string) {
  const { data, meta } = await get(endpoints.countryHistory(countryId, { cursor }));
  const o = asRecord(data);
  return { ...parseRows(o.items, historyItemSchema), nextCursor: typeof o.nextCursor === "string" ? o.nextCursor : null, meta };
}

/** GET /countries/{id}/revolution (shape verified against tests/fixtures/real/revolution-eg.json). */
export async function getRevolution(countryId: string) {
  const { data, meta } = await get(endpoints.revolution(countryId));
  const o = asRecord(data) as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === "number" ? v : null);
  const str = (v: unknown) => (typeof v === "string" ? v : null);
  const bag = (v: unknown) => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
  const costs = bag(o.costs), rules = bag(o.rules), restr = bag(o.restrictions);
  return {
    unrest: num(o.unrest), max: num(o.max), activeCitizens: num(o.activeCitizens), full: o.full === true, hasPresident: o.hasPresident === true,
    launchCost: str(costs.launch), contribution: num(costs.contribution), contributionCurrency: str(costs.contributionCurrency),
    minLevel: num(rules.minLevel), battleCooldownHours: num(rules.battleCooldownHours), contributionCooldownHours: num(rules.contributionCooldownHours), nominationPeriodHours: num(rules.nominationPeriodHours), bordersOpenDays: num(rules.bordersOpenDays), dailyDecayPercent: num(rules.dailyDecayPercent),
    governmentFrozen: restr.governmentFrozen === true, bordersOpen: restr.bordersOpen === true, bordersOpenUntil: str(restr.bordersOpenUntil),
    battleId: o.battle && typeof o.battle === "object" ? str((o.battle as Record<string, unknown>).id) : null,
    lastRevolutionAt: o.lastRevolution && typeof o.lastRevolution === "object" ? str((o.lastRevolution as Record<string, unknown>).at ?? (o.lastRevolution as Record<string, unknown>).endedAt) : null,
    recentEvents: Array.isArray(o.recentEvents) ? o.recentEvents.length : 0,
    meta,
  };
}

/**
 * The API has no world-wide parties list (only /countries/{id}/parties), so every country with citizens is queried. Results are kept per country for
 * 10 minutes and at most PARTY_FETCH_CAP countries are requested per render (the request budget is shared with the rest of the site), so a first visit may
 * be PARTIAL: the page reports exactly which countries are still missing and completes on the next visits.
 */
export const PARTY_FETCH_CAP = 30;
const PARTY_TTL = 10 * 60_000;
type CountryParties = Awaited<ReturnType<typeof getCountryParties>>["parties"];
const partyCache = new Map<string, { at: number; parties: CountryParties }>();
export const _resetPartyCache = () => partyCache.clear();

export async function getWorldParties(fetcher: (id: string) => Promise<{ parties: CountryParties }> = getCountryParties) {
  const { countries, meta } = await getCountries();
  const eligible = [...countries].filter((c) => (c.citizens ?? 0) > 0).sort((a, b) => (b.citizens ?? 0) - (a.citizens ?? 0));
  const now = Date.now();
  const batch = eligible.filter((c) => { const h = partyCache.get(c.id); return !h || now - h.at >= PARTY_TTL; }).slice(0, PARTY_FETCH_CAP);
  const settled = await Promise.allSettled(batch.map((c) => fetcher(c.id)));
  settled.forEach((r, i) => { if (r.status === "fulfilled") partyCache.set(batch[i]!.id, { at: Date.now(), parties: r.value.parties }); });
  const rows = eligible.flatMap((c) => (partyCache.get(c.id)?.parties ?? []).map((p) => ({ ...p, countryId: c.id })));
  const missing = eligible.filter((c) => !partyCache.has(c.id)).map((c) => c.id);
  return { rows, covered: eligible.length - missing.length, total: eligible.length, missing, failed: settled.filter((r) => r.status === "rejected").length, meta };
}

/** GET /parties/{id}. The response shape is not recorded: accept an object (or {party: {...}}) that has the verified list fields, otherwise return null. */
export async function getPartyDetail(partyId: string) {
  const { data, meta } = await get(endpoints.party(partyId));
  const o = asRecord(data);
  const body = o.party && typeof o.party === "object" ? asRecord(o.party) : o;
  const parsed = partySchema.safeParse({ ...body, members: typeof body.members === "number" ? body.members : Array.isArray(body.members) ? body.members.length : null });
  const members = (Array.isArray(body.members) ? body.members : []).flatMap((m) => {
    const r = asRecord(m);
    const id = typeof r.userId === "string" ? r.userId : typeof r.id === "string" ? r.id : null;
    const name = typeof r.username === "string" ? r.username : typeof r.name === "string" ? r.name : null;
    return id && name ? [{ id, name, level: typeof r.level === "number" ? r.level : null, role: typeof r.role === "string" ? r.role : null }] : [];
  });
  return { party: parsed.success ? { ...parsed.data, countryId: typeof body.countryId === "string" ? body.countryId : null } : null, members, raw: data, meta };
}

/** GET /alliances/{id}/laws: same proposal shape and paging as a country's laws (the endpoint is documented with identical filter/limit/offset parameters). */
export async function getAllianceLawProposals(allianceId: string, o: { filter?: "open" | "closed" | "all"; offset?: number; limit?: number } = {}) {
  const { data, meta } = await get(endpoints.allianceLaws(allianceId, { filter: o.filter ?? "all", offset: o.offset, limit: o.limit ?? 30 }));
  const obj = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  const parsed = parseRows(Array.isArray(obj.proposals) ? obj.proposals : [], lawProposal);
  return { proposals: parsed.rows, skipped: parsed.skipped, recognised: Array.isArray(obj.proposals), hasMore: obj.hasMore === true, meta };
}
