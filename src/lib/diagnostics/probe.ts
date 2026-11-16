import type { ApiSource } from "@/lib/api/client";
import { isApiError, describeError } from "@/lib/api/errors";
import { PROBE_ENDPOINTS, isKnownPath, type Endpoint, type Query } from "@/lib/api/endpoints";
import { getApiClient } from "@/lib/api/instance";
import { anyJson } from "@/lib/api/schemas";
import { shapeOf, type Shape } from "./shape";
import { DISCOVERY_SOURCES, countryScopedSources, discoverIds, idProbes, type Discovered, type SourceKey, type Sources } from "./discover";

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
    const err = isApiError(error) ? { kind: error.kind, status: error.status, title } : { kind: "unknown", title };
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

export interface IdProbeResult extends ProbeResult { kind: string; id: string | null; label: string; skipped?: string }
export interface DiscoveryRun { discovered: Discovered; sources: { key: SourceKey; ok: boolean; error?: string }[]; probes: IdProbeResult[]; page: number; pages: number; total: number }
export const DISCOVERY_PAGE_SIZE = 14;

/**
 * Discovers ids from the list endpoints, then requests every ID-requiring endpoint once. Sequential, so it respects the shared
 * request budget. The list requests are cached (30 s), so each page costs about 15 list + 14 detail requests at most; run the pages one after another.
 */
export async function discoverAndProbe(page = 1): Promise<DiscoveryRun> {
  const srcData: Sources = {};
  const sources: DiscoveryRun["sources"] = [];
  const load = async ([key, e]: readonly [SourceKey, Endpoint]) => {
    const r = await probe(e);
    sources.push({ key, ok: r.ok, ...(r.ok ? {} : { error: r.error?.title }) });
    if (r.ok) srcData[key] = r.data;
  };
  for (const s of DISCOVERY_SOURCES) await load(s);
  const country = discoverIds(srcData).ids.country[0];
  if (country) for (const s of countryScopedSources(country)) await load(s);
  const discovered = discoverIds(srcData);
  const all = idProbes(discovered);
  const pages = Math.max(1, Math.ceil(all.length / DISCOVERY_PAGE_SIZE));
  const pg = Math.min(Math.max(1, Math.floor(page) || 1), pages);
  const probes: IdProbeResult[] = [];
  for (const p of all.slice((pg - 1) * DISCOVERY_PAGE_SIZE, pg * DISCOVERY_PAGE_SIZE)) {
    if (!p.endpoint) { probes.push({ path: "", ok: false, ms: 0, kind: p.kind, id: p.id, label: p.label, skipped: p.skipped }); continue; }
    probes.push({ ...(await probe(p.endpoint)), kind: p.kind, id: p.id, label: p.label });
  }
  return { discovered, sources, probes, page: pg, pages, total: all.length };
}
