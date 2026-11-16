import { endpoints } from "@/lib/api/endpoints";
import type { Endpoint } from "@/lib/api/endpoints";
import { getApiClient } from "@/lib/api/instance";
import { anyJson } from "@/lib/api/schemas";
import { parseCampaign, parseRegionCompanies, parseRegionDetail } from "@/lib/domain/region-detail";

const get = (e: Endpoint) => getApiClient().get(e.path, { schema: anyJson, query: e.query });

/** GET /regions/{id}. region = null when the body is not a region object (kept distinct from an API failure, which throws). */
export async function getRegionDetail(id: string) {
  const { data, meta } = await get(endpoints.region(id));
  return { region: parseRegionDetail(data), meta };
}
export async function getRegionCompanies(id: string) {
  const { data, meta } = await get(endpoints.regionCompanies(id));
  return { ...parseRegionCompanies(data), meta };
}
export async function getRegionCampaign(id: string) {
  const { data, meta } = await get(endpoints.regionCampaign(id));
  return { ...parseCampaign(data), meta };
}
