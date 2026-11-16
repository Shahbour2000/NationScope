import { endpoints } from "@/lib/api/endpoints";
import { getApiClient } from "@/lib/api/instance";
import { anyJson } from "@/lib/api/schemas";
import { readArchive } from "@/lib/domain/ranking-archive";
import { asRecord } from "@/lib/domain/parse";

/** GET /rankings/{board}/archive. `archive` is null when the response format is not recognised; `raw` is kept so the page can show it as returned. */
export async function getRankingArchive(board: string) {
  const e = endpoints.rankingArchive(board);
  const { data, meta } = await getApiClient().get(e.path, { schema: anyJson, query: e.query });
  const label = asRecord(asRecord(data).board).label;
  return { archive: readArchive(data), raw: data, boardLabel: typeof label === "string" ? label : null, meta };
}
