import { getConfig } from "@/lib/config/env";
import { z } from "zod";
import { endpoints } from "@/lib/api/endpoints";
import { getApiClient } from "@/lib/api/instance";
import { anyJson } from "@/lib/api/schemas";
import type { Directory } from "@/lib/domain/directory";
import { asRecord, parseRows } from "@/lib/domain/parse";
import { parseBattleDetail } from "@/lib/domain/battle-detail";
import { governmentHistorySchema, governmentSchema, memberSchema, allianceSchema, articleSchema, battleSchema, citizenSchema, countrySchema, historyItemSchema, leaderboardSchema, rankingRowSchema, summarySchema, warSchema } from "@/lib/domain/world";
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

export async function getWars() {
  const { data, meta } = await get(endpoints.wars());
  return { ...parseRows(listKey(data, "wars"), warSchema), meta };
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
