import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ApiClient, type ApiClientOptions } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { RateLimiter } from "@/lib/api/limiter";
import { unverifiedPayload } from "@/lib/api/schemas";

const ORIGIN = "https://main.example.test";
const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" }, ...init });

function make(
  responses: Array<Response | Error | (() => Promise<Response>)>,
  extra: Partial<ApiClientOptions> = {},
) {
  const urls: string[] = [];
  const sleeps: number[] = [];
  let t = 0;
  const queue = [...responses];
  const fetchImpl = (async (url: string) => {
    urls.push(url);
    const next = queue.shift();
    if (next === undefined) throw new Error("unexpected extra fetch");
    if (next instanceof Error) throw next;
    return typeof next === "function" ? next() : next;
  }) as unknown as typeof fetch;
  const client = new ApiClient({
    environment: "main",
    origin: ORIGIN,
    pathPrefix: "/api/v1",
    timeoutMs: 1000,
    cacheTtlMs: 1000,
    staleMaxAgeMs: 60_000,
    limiter: new RateLimiter(100),
    fetchImpl,
    now: () => t,
    sleep: async (ms) => void sleeps.push(ms),
    random: () => 0.5,
    ...extra,
  });
  return { client, urls, sleeps, advance: (ms: number) => (t += ms) };
}

describe("ApiClient", () => {
  it("fetches, validates, then serves from cache within the TTL", async () => {
    const { client, urls } = make([json({ a: 1 })]);
    const first = await client.get("/game", { schema: unverifiedPayload });
    const second = await client.get("/game", { schema: unverifiedPayload });
    expect(first.meta.source).toBe("live");
    expect(second.meta.source).toBe("cache");
    expect(urls).toEqual([`${ORIGIN}/api/v1/game`]);
  });

  it("deduplicates concurrent identical requests", async () => {
    const { client, urls } = make([json({ a: 1 })]);
    await Promise.all([1, 2, 3].map(() => client.get("/game", { schema: unverifiedPayload })));
    expect(urls).toHaveLength(1);
  });

  it("honors Retry-After on 429 and then succeeds", async () => {
    const { client, sleeps } = make([json({}, { status: 429, headers: { "retry-after": "2" } }), json({ ok: 1 })]);
    const r = await client.get("/game", { schema: unverifiedPayload });
    expect(r.meta.source).toBe("live");
    expect(sleeps).toEqual([2000]);
  });

  it("does not wait for an over-long Retry-After and surfaces rate_limited", async () => {
    const { client, sleeps, urls } = make([json({}, { status: 429, headers: { "retry-after": "120" } })]);
    await expect(client.get("/game", { schema: unverifiedPayload })).rejects.toMatchObject({ kind: "rate_limited", retryAfterMs: 120000 });
    expect(sleeps).toEqual([]);
    expect(urls).toHaveLength(1);
  });

  it("retries transient 5xx with jittered backoff, but never 4xx", async () => {
    const a = make([json({}, { status: 503 }), json({ ok: 1 })]);
    await a.client.get("/game", { schema: unverifiedPayload });
    expect(a.sleeps).toEqual([150]);
    const b = make([json({ error: "nf" }, { status: 404 })]);
    await expect(b.client.get("/game", { schema: unverifiedPayload })).rejects.toMatchObject({ kind: "http", status: 404 });
    expect(b.urls).toHaveLength(1);
  });

  it("times out hung requests", async () => {
    const hang = (url: string, init?: RequestInit) =>
      new Promise<Response>((_, reject) => init?.signal?.addEventListener("abort", () => reject(new Error("aborted"))));
    const client = new ApiClient({
      environment: "main", origin: ORIGIN, pathPrefix: "/api/v1", timeoutMs: 20, cacheTtlMs: 0, staleMaxAgeMs: 0,
      limiter: new RateLimiter(10), maxRetries: 0, fetchImpl: hang as unknown as typeof fetch,
    });
    await expect(client.get("/game", { schema: unverifiedPayload })).rejects.toMatchObject({ kind: "timeout" });
  });

  it("serves a stale copy, flagged, when the live request fails; otherwise errors", async () => {
    const { client, advance } = make([json({ a: 1 }), json({}, { status: 500 })], { maxRetries: 0 });
    await client.get("/game", { schema: unverifiedPayload });
    advance(5000);
    const r = await client.get("/game", { schema: unverifiedPayload });
    expect(r.meta).toMatchObject({ source: "stale", staleReason: "http", ageMs: 5000 });
    advance(120_000);
    const again = make([json({ a: 1 }), Error("down")], { maxRetries: 0, cacheTtlMs: 0 });
    await again.client.get("/game", { schema: unverifiedPayload });
    again.advance(120_000);
    await expect(again.client.get("/game", { schema: unverifiedPayload })).rejects.toMatchObject({ kind: "network" });
  });

  it("reports a validation error for unexpected shapes", async () => {
    const { client } = make([json([1, 2, 3])]);
    await expect(client.get("/game", { schema: unverifiedPayload })).rejects.toMatchObject({ kind: "validation" });
    const ok = make([json({ n: 1 })]);
    await expect(ok.client.get("/game", { schema: z.object({ n: z.string() }) })).rejects.toBeInstanceOf(ApiError);
  });

  it("reports invalid JSON bodies", async () => {
    const { client } = make([new Response("<html>", { status: 200 })], { maxRetries: 0 });
    await expect(client.get("/game", { schema: unverifiedPayload })).rejects.toMatchObject({ kind: "invalid_response" });
  });

  it("only ever contacts its configured origin, even when it fails", async () => {
    const { client, urls } = make([json({}, { status: 500 }), json({}, { status: 500 }), json({}, { status: 500 })]);
    await expect(client.get("/countries", { schema: unverifiedPayload, query: { limit: 5 } })).rejects.toBeInstanceOf(ApiError);
    expect(urls.length).toBeGreaterThan(0);
    expect(urls.every((u) => u.startsWith(`${ORIGIN}/api/v1/countries?limit=5`))).toBe(true);
  });

  it("stops at the local request budget without contacting upstream", async () => {
    const { client, urls } = make([json({ a: 1 })], { limiter: new RateLimiter(0), maxRetries: 0 });
    await expect(client.get("/game", { schema: unverifiedPayload })).rejects.toMatchObject({ kind: "rate_limited", local: true });
    expect(urls).toHaveLength(0);
  });

  it("rejects unsafe paths and a path that repeats the /api/v1 prefix", async () => {
    const { client } = make([]);
    await expect(client.get("/api/v1/units", { schema: unverifiedPayload })).rejects.toMatchObject({ kind: "invalid_request" });
    await expect(client.get("/../secret", { schema: unverifiedPayload })).rejects.toMatchObject({ kind: "invalid_request" });
    await expect(client.get("/players/by-name/a%2Fb", { schema: unverifiedPayload })).rejects.toMatchObject({ kind: "invalid_request" });
    await expect(client.get("//evil.test/x", { schema: unverifiedPayload })).rejects.toMatchObject({ kind: "invalid_request" });
  });
});
