import { endpoints } from "@/lib/api/endpoints";
import { getApiClient } from "@/lib/api/instance";
import { unverifiedPayload } from "@/lib/api/schemas";

/** GET /game: server time and rules. Shape unverified; see schemas.ts. */
export function getGameInfo() {
  const e = endpoints.game();
  return getApiClient().get(e.path, { schema: unverifiedPayload, query: e.query });
}
