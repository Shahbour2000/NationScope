import { endpoints } from "@/lib/api/endpoints";
import type { Endpoint } from "@/lib/api/endpoints";
import { getApiClient } from "@/lib/api/instance";
import { anyJson } from "@/lib/api/schemas";
import { companySchema, equipmentOfferSchema, floorRowSchema, jobOfferSchema, marketRowSchema, statsRowSchema, statsTotalsSchema, tradeSchema } from "@/lib/domain/economy";
import { asRecord, parseRows } from "@/lib/domain/parse";

const get = (e: Endpoint) => getApiClient().get(e.path, { schema: anyJson, query: e.query });
const listKey = (data: unknown, key: string): unknown => (Array.isArray(data) ? data : asRecord(data)[key]);

export async function getMarket() {
  const { data, meta } = await get(endpoints.market());
  return { ...parseRows(listKey(data, "items"), marketRowSchema), meta };
}

export async function getTrades(limit = 50) {
  const { data, meta } = await get(endpoints.allTrades({ limit }));
  return { ...parseRows(listKey(data, "trades"), tradeSchema), meta };
}

export async function getEquipmentOffers(o: { slot?: string; rarity?: string; sort?: "priceAsc" | "priceDesc" | "newest"; limit?: number; offset?: number }) {
  const { data, meta } = await get(endpoints.equipment(o));
  const rec = asRecord(data);
  return { ...parseRows(rec.offers, equipmentOfferSchema), nextOffset: typeof rec.nextOffset === "number" ? rec.nextOffset : null, minLevel: typeof rec.minLevel === "number" ? rec.minLevel : null, meta };
}

export async function getEquipmentFloor() {
  const { data, meta } = await get(endpoints.equipmentFloor());
  return { ...parseRows(listKey(data, "floor"), floorRowSchema), meta };
}

export async function getCompanies(o: { countryId?: string; itemCode?: string; sort?: "invested" | "workers" | "level" | "newest"; limit?: number; offset?: number }) {
  const { data, meta } = await get(endpoints.companies(o));
  const rec = asRecord(data);
  return { ...parseRows(rec.companies, companySchema), total: typeof rec.total === "number" ? rec.total : null, meta };
}

/** Companies owned by a player (GET /players/{id}/companies; same company shape as the other company lists). Callers must tolerate failure. */
export async function getPlayerCompanies(playerId: string, o: { limit?: number } = {}) {
  const { data, meta } = await get(endpoints.playerCompanies(playerId, { sort: "level", limit: o.limit ?? 8 }));
  const rec = asRecord(data);
  return { ...parseRows(rec.companies, companySchema), total: typeof rec.total === "number" ? rec.total : null, meta };
}

export async function getCompanyStats(countryId?: string) {
  const { data, meta } = await get(endpoints.companyStats({ countryId }));
  const rec = asRecord(data);
  const totals = statsTotalsSchema.safeParse(rec.totals);
  return { ...parseRows(rec.byItem, statsRowSchema), totals: totals.success ? totals.data : null, meta };
}

export async function getJobs() {
  const { data, meta } = await get(endpoints.jobs());
  const rec = asRecord(data);
  const wage = asRecord(rec.allowedWage);
  const str = (v: unknown) => (typeof v === "string" && /^-?\d+$/.test(v) ? v : null);
  return {
    ...parseRows(rec.offers, jobOfferSchema),
    energyCost: typeof rec.energyCost === "number" ? rec.energyCost : null,
    wage: { min: str(wage.min), median: str(wage.median), max: str(wage.max) },
    meta,
  };
}
