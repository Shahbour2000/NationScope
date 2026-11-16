import { endpoints, type Endpoint } from "@/lib/api/endpoints";
import { getApiClient } from "@/lib/api/instance";
import { anyJson } from "@/lib/api/schemas";
import { readHistory, readOrderBook, readTrades } from "@/lib/domain/market-item";

const get = (e: Endpoint) => getApiClient().get(e.path, { schema: anyJson, query: e.query });

/** Each loader returns the parsed view model (null when unrecognised) AND the raw body, so the page can fall back to showing it as returned. */
export async function getItemOrders(item: string) {
  const { data, meta } = await get(endpoints.marketOrders(item));
  return { book: readOrderBook(data), raw: data, meta };
}
export async function getItemHistory(item: string, hours = 168) {
  const { data, meta } = await get(endpoints.marketHistory(item, { hours }));
  return { history: readHistory(data), raw: data, meta };
}
export async function getItemTrades(item: string, limit = 50) {
  const { data, meta } = await get(endpoints.marketTrades(item, { limit }));
  return { ...readTrades(data), raw: data, meta };
}
