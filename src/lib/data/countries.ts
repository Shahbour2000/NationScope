import { endpoints } from "@/lib/api/endpoints";
import { getApiClient } from "@/lib/api/instance";
import { unverifiedPayload } from "@/lib/api/schemas";

/** GET /countries. Shape unverified; do not read fields until fixtures exist. */
export function getCountries() {
  const e = endpoints.countries();
  return getApiClient().get(e.path, { schema: unverifiedPayload, query: e.query });
}

/** GET /countries/{countryId}. Shape unverified. */
export function getCountry(countryId: string) {
  const e = endpoints.country(countryId);
  return getApiClient().get(e.path, { schema: unverifiedPayload, query: e.query });
}
