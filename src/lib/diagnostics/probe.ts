import type { ApiSource } from "@/lib/api/client";
import { ApiError, describeError } from "@/lib/api/errors";
import { PROBE_ENDPOINTS, isKnownPath, type Endpoint, type Query } from "@/lib/api/endpoints";
import { getApiClient } from "@/lib/api/instance";
import { anyJson } from "@/lib/api/schemas";
import { shapeOf, type Shape } from "./shape";

export interface ProbeResult {
  path: string;
  query?: Query;
  ok: boolean;
  source?: ApiSource;
  ms: number;
  shape?: Shape;
  data?: unknown;
  error?: { kind: string; status?: number; title: string };
}

export function diagnosticsEnabled(): boolean {
  return process.env.NATIONSCOPE_DIAGNOSTICS === "true";
}

export async function probe(e: Endpoint): Promise<ProbeResult> {
  const started = Date.now();
  try {
    const { data, meta } = await getApiClient().get(e.path, { schema: anyJson, query: e.query });
    return { path: e.path, query: e.query, ok: true, source: meta.source, ms: Date.now() - started, shape: shapeOf(data), data };
  } catch (error) {
    const title = describeError(error).title;
    const err = error instanceof ApiError ? { kind: error.kind, status: error.status, title } : { kind: "unknown", title };
    return { path: e.path, query: e.query, ok: false, ms: Date.now() - started, error: err };
  }
}

/** Sequential on purpose: the shared limiter and upstream 60/min budget apply. */
export async function probeAll(list: readonly Endpoint[] = PROBE_ENDPOINTS): Promise<ProbeResult[]> {
  const out: ProbeResult[] = [];
  for (const e of list) out.push(await probe(e));
  return out;
}

const KEY = /^[A-Za-z]{1,20}$/;

/** Explorer input: only known spec paths, a handful of simple query params. */
export function parseExplorerInput(path: string | undefined, rawQuery: string | undefined): Endpoint | { error: string } {
  if (!path) return { error: "Enter a path such as /units" };
  if (!isKnownPath(path)) return { error: "That path is not in the published API spec." };
  const query: Query = {};
  if (rawQuery) {
    const params = new URLSearchParams(rawQuery);
    let n = 0;
    for (const [k, v] of params) {
      if (!KEY.test(k) || v.length > 80 || ++n > 6) return { error: "Query must be up to 6 simple key=value pairs." };
      query[k] = v;
    }
  }
  return { path, query: Object.keys(query).length ? query : undefined };
}
