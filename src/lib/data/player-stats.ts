import { endpoints } from "@/lib/api/endpoints";
import { getApiClient } from "@/lib/api/instance";
import { anyJson } from "@/lib/api/schemas";
import { parsePlayerStats } from "@/lib/domain/player-stats";

/** GET /players/{id}/stats. Own parser (does not use the profile parser in lib/domain/player.ts). `stats` is null when the body is not a stats object; `raw` is kept for display. */
export async function getPlayerStats(id: string) {
  const e = endpoints.playerStats(id);
  const { data, meta } = await getApiClient().get(e.path, { schema: anyJson, query: e.query });
  return { stats: parsePlayerStats(data), raw: data, meta };
}
