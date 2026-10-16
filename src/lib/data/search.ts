import { endpoints } from "@/lib/api/endpoints";
import { getApiClient } from "@/lib/api/instance";
import { unverifiedPayload } from "@/lib/api/schemas";

/** GET /search?q= (spec: 2 to 60 characters). Result shape unverified. */
export function searchEntities(query: string) {
  const e = endpoints.search(query);
  return getApiClient().get(e.path, { schema: unverifiedPayload, query: e.query });
}
