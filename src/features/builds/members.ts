import { getCitizens, getAlliances, getCountries, getPartyDetail, getWars } from "@/lib/data/world";
import { getUnitDetail } from "@/lib/data/units";
import { allianceAggregate } from "@/features/economy/analytics";

export type MixEntity = "country" | "unit" | "party" | "alliance";
export const MIX_ENTITIES: readonly MixEntity[] = ["country", "unit", "party", "alliance"];
export const isMixEntity = (v: string): v is MixEntity => (MIX_ENTITIES as readonly string[]).includes(v);

/** Where the entity's own page lives (used by the "back to overview" link). */
export const entityHref = (e: MixEntity, id: string): string => `/${e === "country" ? "countries" : e === "unit" ? "units" : e === "party" ? "parties" : "alliances"}/${encodeURIComponent(id)}`;
/** The drill-down route for one classification. */
export const mixHref = (e: MixEntity, id: string, kind: "war" | "eco" | "hybrid"): string => `/builds/${e}/${encodeURIComponent(id)}/${kind}`;

export interface MixMembers {
  name: string | null;
  ids: string[];
  /** true when the API reports more members than were retrieved (page cap), so the figures are a floor, not the full total. */
  truncated: boolean;
  /** Members the API says exist (when it says), for the coverage note. */
  reportedTotal: number | null;
}

const PAGE = 100, COUNTRY_PAGES = 5, ALLIANCE_PAGES = 1;

/** ACTIVE citizens of one country, paged (100 per request). Inactive accounts are excluded so the mix reflects players who still play. */
export async function getCountryCitizenIds(countryId: string, maxPages: number): Promise<{ ids: string[]; truncated: boolean; total: number | null }> {
  const ids: string[] = [];
  let total: number | null = null, truncated = false;
  for (let page = 0; page < maxPages; page++) {
    const r = await getCitizens(countryId, { offset: page * PAGE, limit: PAGE });
    if (r.total !== null) total = r.total;
    for (const c of r.rows) if (c.active) ids.push(c.id);
    if (!r.hasMore && r.rows.length < PAGE) return { ids, truncated: false, total };
    if (page === maxPages - 1) truncated = r.hasMore || r.rows.length >= PAGE;
  }
  return { ids, truncated, total };
}

export async function citizenIdsOfCountries(countryIds: readonly string[], maxPages: number): Promise<{ ids: string[]; truncated: boolean }> {
  const lists = await Promise.allSettled(countryIds.map((id) => getCountryCitizenIds(id, maxPages)));
  return { ids: lists.flatMap((l) => (l.status === "fulfilled" ? l.value.ids : [])), truncated: lists.some((l) => l.status === "rejected" || (l.status === "fulfilled" && l.value.truncated)) };
}

/** The single source of member ids for every WAR / ECO / HYBRID count and list, so a count and its member list can never disagree. */
export async function getMixMembers(entity: MixEntity, id: string): Promise<MixMembers | null> {
  if (entity === "unit") {
    const { unit } = await getUnitDetail(id);
    return unit ? { name: unit.name, ids: unit.members.map((x) => x.id), truncated: false, reportedTotal: unit.members.length } : null;
  }
  if (entity === "party") {
    const res = await getPartyDetail(id);
    if (!res.party) return null;
    return { name: res.party.name, ids: res.members.map((x) => x.id), truncated: res.party.members != null && res.party.members > res.members.length, reportedTotal: res.party.members ?? null };
  }
  if (entity === "country") {
    const [{ countries }, c] = await Promise.all([getCountries(), getCountryCitizenIds(id, COUNTRY_PAGES)]);
    const country = countries.find((x) => x.id === id);
    return country ? { name: country.name, ids: c.ids, truncated: c.truncated, reportedTotal: c.total } : null;
  }
  const [all, countries, wars] = await Promise.all([getAlliances(), getCountries(), getWars()]);
  const alliance = all.rows.find((x) => x.id === id);
  if (!alliance) return null;
  const agg = allianceAggregate(alliance, countries.countries, wars.rows);
  const c = await citizenIdsOfCountries(agg.members.map((x) => x.id), ALLIANCE_PAGES);
  return { name: alliance.name, ids: c.ids, truncated: c.truncated || agg.unresolved.length > 0, reportedTotal: agg.activeCitizens };
}
