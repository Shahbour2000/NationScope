import { endpoints } from "@/lib/api/endpoints";
import { getApiClient } from "@/lib/api/instance";
import { anyJson } from "@/lib/api/schemas";
import { parseCompanyDetail } from "@/lib/domain/company-detail";

/** GET /companies/{id}. `company` is null when the body is not a company object (distinct from a request failure, which throws). */
export async function getCompanyDetail(id: string) {
  const e = endpoints.company(id);
  const { data, meta } = await getApiClient().get(e.path, { schema: anyJson, query: e.query });
  return { company: parseCompanyDetail(data), meta };
}
