import { endpoints, type Endpoint } from "@/lib/api/endpoints";
import { getApiClient } from "@/lib/api/instance";
import { anyJson } from "@/lib/api/schemas";
import { parseArticleDetail, parseNewspaper } from "@/lib/domain/news-detail";

const get = (e: Endpoint) => getApiClient().get(e.path, { schema: anyJson, query: e.query });
/** GET /articles/{id}; `detail` is null when the body is not an article. `raw` is kept for diagnostics. */
export async function getArticleDetail(id: string) { const { data, meta } = await get(endpoints.article(id)); return { detail: parseArticleDetail(data), raw: data, meta }; }
/** GET /newspapers/{id}. */
export async function getNewspaperDetail(id: string) { const { data, meta } = await get(endpoints.newspaper(id)); return { paper: parseNewspaper(data), raw: data, meta }; }
