import { endpoints, type Endpoint } from "@/lib/api/endpoints";
import { getApiClient } from "@/lib/api/instance";
import { anyJson } from "@/lib/api/schemas";
import { parseElectionDetail } from "@/lib/domain/election-detail";
import { parseLawDetail } from "@/lib/domain/law-detail";

const get = (e: Endpoint) => getApiClient().get(e.path, { schema: anyJson, query: e.query });
/** GET /laws/{id}. `law` is null when the body is not a law proposal (distinct from a failed request, which throws). */
export async function getLawDetail(id: string) { const { data, meta } = await get(endpoints.law(id)); return { law: parseLawDetail(data), meta }; }
/** GET /elections/{id}. */
export async function getElectionDetail(id: string) { const { data, meta } = await get(endpoints.election(id)); return { election: parseElectionDetail(data), meta }; }
