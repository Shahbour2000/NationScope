import { z } from "zod";
import { endpoints } from "@/lib/api/endpoints";
import { getApiClient } from "@/lib/api/instance";
import { getConfig } from "@/lib/config/env";
import { parseUnitDetail } from "@/lib/domain/unit-detail";
import { parseUnits } from "@/lib/domain/units";

const list = z.array(z.unknown());

/** GET /units: verified on Main as a JSON array. One request returns every unit. */
export async function getUnits() {
  const e = endpoints.units();
  const { data, meta } = await getApiClient().get(e.path, { schema: list, query: e.query });
  return { ...parseUnits(data, getConfig().origin), meta };
}

/** GET /units/{id}: shape verified on Main (see src/lib/domain/unit-detail.ts). Returns unit = null if the body is not a unit object. */
export async function getUnitDetail(id: string) {
  const e = endpoints.unit(id);
  const { data, meta } = await getApiClient().get(e.path, { schema: z.unknown(), query: e.query });
  return { unit: parseUnitDetail(data, getConfig().origin), meta };
}
