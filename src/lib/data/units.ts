import { z } from "zod";
import { endpoints } from "@/lib/api/endpoints";
import { getApiClient } from "@/lib/api/instance";
import { getConfig } from "@/lib/config/env";
import { parseUnits } from "@/lib/domain/units";

const list = z.array(z.unknown());

/** GET /units: verified on Main as a JSON array. One request returns every unit. */
export async function getUnits() {
  const e = endpoints.units();
  const { data, meta } = await getApiClient().get(e.path, { schema: list, query: e.query });
  return { ...parseUnits(data, getConfig().origin), meta };
}
