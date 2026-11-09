import { z } from "zod";
import { endpoints } from "@/lib/api/endpoints";
import { getApiClient } from "@/lib/api/instance";
import { anyJson } from "@/lib/api/schemas";
import { parseRows } from "@/lib/domain/parse";
import { battleSchema, type Battle } from "@/lib/domain/world";
import { getTournaments } from "@/lib/data/world";
import type { Endpoint } from "@/lib/api/endpoints";

const get = (e: Endpoint) => getApiClient().get(e.path, { schema: anyJson, query: e.query });

const entrantSchema = z.object({ id: z.string(), entrantId: z.string(), seed: z.number().nullish(), name: z.string().nullish(), registrarName: z.string().nullish() }).passthrough();
const editionBase = z.object({
  id: z.string(), kind: z.string(), name: z.string().nullish(), status: z.string().nullish(), periodKey: z.string().nullish(), startsAt: z.string().nullish(), registrationOpensAt: z.string().nullish(),
  rarityCap: z.string().nullish(), totalRounds: z.number().nullish(), winnerId: z.string().nullish(), runnerUpId: z.string().nullish(), finishedAt: z.string().nullish(), cancelReason: z.string().nullish(), registrationOpen: z.boolean().nullish(),
}).passthrough();
const editionSchema = editionBase.extend({ registrations: z.array(z.unknown()).nullish() });
export type TournamentEdition = z.infer<typeof editionBase> & { entrants: z.infer<typeof entrantSchema>[] };

const rec = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

/** Accepts the edition at the top level or wrapped ({ edition } / { tournament }). Returns null for any other shape: nothing is guessed. */
export function parseEdition(data: unknown): TournamentEdition | null {
  const o = rec(data);
  for (const cand of [o, rec(o.edition), rec(o.tournament)]) {
    const r = editionSchema.safeParse(cand);
    if (r.success) { const { registrations, ...rest } = r.data; return { ...rest, entrants: parseRows(registrations ?? [], entrantSchema).rows }; }
  }
  return null;
}

export interface TournamentDetail {
  edition: TournamentEdition | null;
  /** Where the edition came from: its own endpoint, or (when that is unavailable) the list endpoint. */
  source: "detail" | "list" | null;
  /** Top-level keys the detail response carried beyond the edition fields NationScope understands (shown in the limitations note, never rendered as data). */
  unknownKeys: string[];
}

/** GET /tournaments/{id}; falls back to the edition inside GET /tournaments (current or history) when the detail endpoint fails or has an unrecognised shape. */
export async function getTournamentDetail(id: string): Promise<TournamentDetail & { meta: Awaited<ReturnType<typeof get>>["meta"] | null }> {
  try {
    const { data, meta } = await get(endpoints.tournament(id));
    const edition = parseEdition(data);
    if (edition) {
      const known = new Set([...Object.keys(editionSchema.shape), "edition", "tournament"]);
      return { edition, source: "detail", unknownKeys: Object.keys(rec(data)).filter((k) => !known.has(k)), meta };
    }
  } catch { /* fall back to the list */ }
  try {
    const list = await getTournaments();
    const hit: Record<string, unknown> | undefined = [list.current, ...list.history].find((x) => x && x.id === id) as Record<string, unknown> | undefined;
    if (hit) {
      // `current` already carries parsed entrants; history rows carry raw `registrations` (possibly none).
      const edition = parseEdition({ ...hit, registrations: Array.isArray(hit.registrations) ? hit.registrations : [] });
      if (edition) return { edition: { ...edition, entrants: Array.isArray(hit.entrants) ? (hit.entrants as TournamentEdition["entrants"]) : edition.entrants }, source: "list", unknownKeys: [], meta: list.meta };
    }
    return { edition: null, source: null, unknownKeys: [], meta: list.meta };
  } catch { return { edition: null, source: null, unknownKeys: [], meta: null }; }
}

/**
 * Tournament battles (type=tournament) whose two sides are both entrants of the edition and that started inside its window.
 * The API puts no edition id on a battle, so this link is DERIVED from participants and dates (and labelled as such on the page); it is not a bracket.
 */
export async function getEditionBattles(edition: TournamentEdition): Promise<{ battles: Battle[]; derived: true }> {
  const ids = new Set(edition.entrants.map((e) => e.entrantId));
  if (ids.size === 0) return { battles: [], derived: true };
  const [a, f] = await Promise.allSettled([get(endpoints.battles({ type: "tournament", limit: 100 })), get(endpoints.battles({ type: "tournament", status: "finished", limit: 100 }))]);
  const rows: Battle[] = [];
  for (const r of [a, f]) if (r.status === "fulfilled") { const d = r.value.data; rows.push(...parseRows(Array.isArray(d) ? d : rec(d).battles, battleSchema).rows); }
  const start = edition.startsAt ? Date.parse(edition.startsAt) : NaN, end = edition.finishedAt ? Date.parse(edition.finishedAt) : Infinity;
  const seen = new Set<string>();
  const battles = rows.filter((b) => {
    if (seen.has(b.id) || b.type !== "tournament") return false;
    seen.add(b.id);
    const x = String(b.attackerMuId ?? b.attackerCountryId ?? ""), y = String(b.defenderMuId ?? b.defenderCountryId ?? "");
    if (!ids.has(x) || !ids.has(y)) return false;
    const t = b.startedAt ? Date.parse(b.startedAt) : NaN;
    return Number.isFinite(t) ? t >= (Number.isFinite(start) ? start : -Infinity) && t <= end : false;
  });
  battles.sort((p, q) => Date.parse(p.startedAt ?? "") - Date.parse(q.startedAt ?? ""));
  return { battles, derived: true };
}
