import { endpoints } from "@/lib/api/endpoints";
import { getApiClient } from "@/lib/api/instance";
import { anyJson } from "@/lib/api/schemas";
import { parseGameRules } from "@/lib/domain/game-rules";

/** GET /game. `rules` is null when the body has none of the rule tables (distinct from a failed request, which throws). */
export async function getGameRules() {
  const e = endpoints.game();
  const { data, meta } = await getApiClient().get(e.path, { schema: anyJson, query: e.query });
  return { rules: parseGameRules(data), raw: data, meta };
}
