import { getConfig } from "@/lib/config/env";
import { ApiClient } from "./client";
import { RateLimiter } from "./limiter";

const g = globalThis as unknown as { __nationscopeClient?: { key: string; client: ApiClient } };

/** One client (and one cache/limiter) per process and per environment configuration. */
export function getApiClient(): ApiClient {
  const c = getConfig();
  const key = `${c.environment}|${c.origin}|${c.pathPrefix}|${c.timeoutMs}|${c.maxRequestsPerMinute}|${c.cacheTtlMs}|${c.staleMaxAgeMs}`;
  if (g.__nationscopeClient?.key !== key) {
    g.__nationscopeClient = {
      key,
      client: new ApiClient({
        environment: c.environment,
        origin: c.origin,
        pathPrefix: c.pathPrefix,
        timeoutMs: c.timeoutMs,
        cacheTtlMs: c.cacheTtlMs,
        staleMaxAgeMs: c.staleMaxAgeMs,
        limiter: new RateLimiter(c.maxRequestsPerMinute),
      }),
    };
  }
  return g.__nationscopeClient.client;
}
