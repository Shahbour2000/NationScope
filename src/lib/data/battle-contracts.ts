import { endpoints } from "@/lib/api/endpoints";
import { getApiClient } from "@/lib/api/instance";
import { anyJson } from "@/lib/api/schemas";
import { parseBattleContracts } from "@/lib/domain/contracts";

/** GET /battles/{id}/contracts. A thrown error means the request failed; `shapeOk: false` means the body was not a contracts object. */
export async function getBattleContracts(id: string) {
  const e = endpoints.battleContracts(id);
  const { data, meta } = await getApiClient().get(e.path, { schema: anyJson, query: e.query });
  return { ...parseBattleContracts(data), meta };
}
