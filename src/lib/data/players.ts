import { z } from "zod";
import { classifyBuild, type BuildResult } from "@/features/builds/classify";
import { getApiClient } from "@/lib/api/instance";
import { endpoints } from "@/lib/api/endpoints";
import { getConfig } from "@/lib/config/env";
import { parsePlayer } from "@/lib/domain/player";
import { getCitizens } from "@/lib/data/world";

export async function getPlayerProfile(id: string) {
  const e = endpoints.player(id);
  const { data, meta } = await getApiClient().get(e.path, { schema: z.unknown(), query: e.query });
  return { player: parsePlayer(data, getConfig().origin), meta };
}

/**
 * Server-side build census cache. Only the small classification result is kept (not whole profiles), per server instance, for 10 minutes
 * (failures for 1 minute so a broken profile is not re-requested on every render). Serverless instances do not share this cache.
 */
const OK_TTL = 10 * 60_000, FAIL_TTL = 60_000;
const cache = new Map<string, { at: number; result: BuildResult | null }>();

export interface BuildLoad {
  results: Map<string, BuildResult>;
  /** Profiles requested in this call. */
  fetched: number;
  /** Unique ids skipped because the per-render request cap was reached (they fill in on later visits). */
  pending: number;
  /** Unique ids whose profile request failed or had no usable skills data. */
  failed: number;
}

/**
 * Classifies the given players while bounding API usage: cached results are reused, and at most `maxFetch` new profiles are requested per call
 * (small worker pool). Everything not loaded is reported, never silently counted.
 */
type Fetcher = (id: string) => Promise<{ player: ReturnType<typeof parsePlayer> }>;

export async function loadBuilds(ids: readonly string[], opts: { maxFetch?: number; concurrency?: number } = {}, fetchPlayer: Fetcher = getPlayerProfile): Promise<BuildLoad> {
  const maxFetch = opts.maxFetch ?? 24, conc = opts.concurrency ?? 4, now = Date.now();
  const unique = [...new Set(ids)];
  const results = new Map<string, BuildResult>();
  const todo: string[] = [];
  let failed = 0;
  for (const id of unique) {
    const hit = cache.get(id);
    const fresh = hit && now - hit.at < (hit.result ? OK_TTL : FAIL_TTL);
    if (fresh) { if (hit.result) results.set(id, hit.result); else failed++; } else todo.push(id);
  }
  const batch = todo.slice(0, maxFetch);
  let next = 0, fetched = 0;
  const worker = async () => {
    while (next < batch.length) {
      const id = batch[next++]!;
      fetched++;
      try {
        const { player } = await fetchPlayer(id);
        const r = player && player.hasSkills ? classifyBuild(player.skills) : null;
        cache.set(id, { at: Date.now(), result: r });
        if (r) results.set(id, r); else failed++;
      } catch {
        cache.set(id, { at: Date.now(), result: null });
        failed++;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(conc, batch.length) }, worker));
  return { results, fetched, pending: todo.length - batch.length, failed };
}

/** Test helper: clears the in-memory census cache. */
export const _resetBuildCache = () => cache.clear();

/** Ids of a country's ACTIVE citizens (first 100 returned by the API; inactive accounts are excluded so the mix reflects players who still play). */
export async function getActiveCitizenIds(countryId: string): Promise<string[]> {
  const r = await getCitizens(countryId, { offset: 0, limit: 100 });
  return r.rows.filter((c) => c.active).map((c) => c.id);
}
