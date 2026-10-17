import type { z } from "zod";
import { buildApiUrl } from "@/lib/config/environments";
import { ApiError, isDegradable } from "./errors";
import type { RateLimiter } from "./limiter";

export type ApiSource = "live" | "cache" | "stale";

export interface ApiResultMeta {
  environment: string;
  host: string;
  source: ApiSource;
  /** ISO 8601 UTC time the upstream response was received by this server. */
  fetchedAt: string;
  ageMs: number;
  /** Set when source is "stale": why the live request failed. */
  staleReason?: string;
}

export interface ApiResult<T> {
  data: T;
  meta: ApiResultMeta;
}

export interface ApiClientOptions {
  environment: string;
  origin: string;
  pathPrefix: string;
  timeoutMs: number;
  cacheTtlMs: number;
  staleMaxAgeMs: number;
  limiter: RateLimiter;
  maxRetries?: number;
  maxRetryDelayMs?: number;
  maxCacheEntries?: number;
  fetchImpl?: typeof fetch;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
}

export interface GetOptions<T> {
  schema: z.ZodType<T>;
  query?: Record<string, string | number | boolean | undefined>;
  ttlMs?: number;
}

interface Entry {
  raw: unknown;
  storedAt: number;
}

const SAFE_PATH = /^\/[A-Za-z0-9/_%.-]*$/;
/** Percent-encoding is allowed (usernames), but never an encoded separator, traversal, or a control byte. */
const isSafePath = (p: string): boolean => SAFE_PATH.test(p) && !p.includes("..") && !p.includes("//") && !/%(2f|5c|00)/i.test(p);
const MAX_BODY_CHARS = 5_000_000;

export function parseRetryAfter(value: string | null, now: number): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.round(seconds * 1000);
  const date = Date.parse(value);
  return Number.isNaN(date) ? undefined : Math.max(0, date - now);
}

/**
 * Read-only GET client bound to ONE environment origin. It has no knowledge of any
 * other origin, so it cannot fall back to another environment.
 */
export class ApiClient {
  private readonly cache = new Map<string, Entry>();
  private readonly inflight = new Map<string, Promise<Entry>>();
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly random: () => number;
  private readonly maxRetries: number;
  private readonly maxRetryDelayMs: number;
  private readonly maxCacheEntries: number;
  private readonly host: string;

  constructor(private readonly o: ApiClientOptions) {
    this.fetchImpl = o.fetchImpl ?? ((...args) => fetch(...args));
    this.now = o.now ?? Date.now;
    this.sleep = o.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.random = o.random ?? Math.random;
    this.maxRetries = o.maxRetries ?? 2;
    this.maxRetryDelayMs = o.maxRetryDelayMs ?? 5000;
    this.maxCacheEntries = o.maxCacheEntries ?? 200;
    this.host = new URL(o.origin).host;
  }

  async get<T>(path: string, opts: GetOptions<T>): Promise<ApiResult<T>> {
    const url = this.buildUrl(path, opts.query);
    const ttl = opts.ttlMs ?? this.o.cacheTtlMs;
    const hit = this.cache.get(url);

    if (hit && this.now() - hit.storedAt < ttl) return this.finish(opts.schema, hit, "cache");

    try {
      const entry = await this.dedupe(url);
      return this.finish(opts.schema, entry, "live");
    } catch (error) {
      if (
        hit &&
        error instanceof ApiError &&
        isDegradable(error) &&
        this.now() - hit.storedAt <= this.o.staleMaxAgeMs
      ) {
        return this.finish(opts.schema, hit, "stale", error.kind);
      }
      throw error;
    }
  }

  private buildUrl(path: string, query?: GetOptions<unknown>["query"]): string {
    if (!isSafePath(path) || path === this.o.pathPrefix || path.startsWith(`${this.o.pathPrefix}/`)) {
      throw new ApiError("invalid_request", "Invalid API path.");
    }
    const params = new URLSearchParams();
    for (const key of Object.keys(query ?? {}).sort()) {
      const value = query?.[key];
      if (value !== undefined) params.set(key, String(value));
    }
    const qs = params.toString();
    return `${buildApiUrl(this.o.origin, this.o.pathPrefix, path)}${qs ? `?${qs}` : ""}`;
  }

  private finish<T>(schema: z.ZodType<T>, entry: Entry, source: ApiSource, staleReason?: string): ApiResult<T> {
    const parsed = schema.safeParse(entry.raw);
    if (!parsed.success) {
      throw new ApiError("validation", "Response did not match the expected schema.", { cause: parsed.error });
    }
    return {
      data: parsed.data,
      meta: {
        environment: this.o.environment,
        host: this.host,
        source,
        fetchedAt: new Date(entry.storedAt).toISOString(),
        ageMs: Math.max(0, this.now() - entry.storedAt),
        ...(staleReason ? { staleReason } : {}),
      },
    };
  }

  private dedupe(url: string): Promise<Entry> {
    const existing = this.inflight.get(url);
    if (existing) return existing;
    const promise = this.fetchWithRetry(url)
      .then((raw) => {
        const entry = { raw, storedAt: this.now() };
        this.remember(url, entry);
        return entry;
      })
      .finally(() => this.inflight.delete(url));
    this.inflight.set(url, promise);
    return promise;
  }

  private remember(url: string, entry: Entry): void {
    this.cache.delete(url);
    this.cache.set(url, entry);
    while (this.cache.size > this.maxCacheEntries) {
      const oldest = this.cache.keys().next().value;
      if (oldest === undefined) break;
      this.cache.delete(oldest);
    }
  }

  private async fetchWithRetry(url: string): Promise<unknown> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.fetchOnce(url);
      } catch (error) {
        if (!(error instanceof ApiError) || attempt >= this.maxRetries) throw error;
        const delay = this.retryDelay(error, attempt);
        if (delay === null) throw error;
        await this.sleep(delay);
      }
    }
  }

  /** Returns ms to wait before retrying, or null if the error should not be retried. */
  private retryDelay(error: ApiError, attempt: number): number | null {
    if (error.local) return null;
    if (error.kind === "rate_limited") {
      if (error.retryAfterMs === undefined) return this.backoff(attempt);
      return error.retryAfterMs <= this.maxRetryDelayMs ? error.retryAfterMs : null;
    }
    const transient =
      error.kind === "network" ||
      error.kind === "timeout" ||
      (error.kind === "http" && [502, 503, 504].includes(error.status ?? 0));
    return transient ? this.backoff(attempt) : null;
  }

  /** Exponential backoff with full jitter. */
  private backoff(attempt: number): number {
    const cap = Math.min(300 * 2 ** attempt, this.maxRetryDelayMs);
    return Math.round(this.random() * cap);
  }

  private async fetchOnce(url: string): Promise<unknown> {
    if (!this.o.limiter.tryAcquire()) {
      throw new ApiError("rate_limited", "Local request budget exhausted.", {
        retryAfterMs: this.o.limiter.msUntilAvailable(),
        local: true,
      });
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.o.timeoutMs);
    try {
      const res = await this.fetchImpl(url, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: controller.signal,
        cache: "no-store",
      });

      if (res.status === 429) {
        throw new ApiError("rate_limited", "Upstream rate limit reached.", {
          status: 429,
          retryAfterMs: parseRetryAfter(res.headers.get("retry-after"), this.now()),
        });
      }
      if (!res.ok) throw new ApiError("http", `HTTP ${res.status}`, { status: res.status });

      const text = await res.text();
      if (text.length > MAX_BODY_CHARS) throw new ApiError("invalid_response", "Response too large.");
      try {
        return JSON.parse(text) as unknown;
      } catch (cause) {
        throw new ApiError("invalid_response", "Response was not valid JSON.", { cause });
      }
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (controller.signal.aborted) throw new ApiError("timeout", "Request timed out.", { cause: error });
      throw new ApiError("network", "Network request failed.", { cause: error });
    } finally {
      clearTimeout(timer);
    }
  }
}
