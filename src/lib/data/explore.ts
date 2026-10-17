import type { Endpoint } from "@/lib/api/endpoints";
import { getApiClient } from "@/lib/api/instance";
import { anyJson } from "@/lib/api/schemas";

/** Fetches any registered endpoint as untyped JSON. Used only by the generic views; specialised views have their own schemas. */
export function fetchEndpoint(e: Endpoint) {
  return getApiClient().get(e.path, { schema: anyJson, query: e.query });
}
