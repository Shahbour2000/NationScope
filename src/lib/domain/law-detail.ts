import { z } from "zod";
import { asRecord, parseRows } from "./parse";

/** GET /laws/{id}. Written from the real capture API/samples/politics/Law proposal details.txt. */
const s = z.string();
const n = z.number();
export const lawDetailSchema = z.object({
  id: s.min(1), scope: s.nullish(), scopeId: s.nullish(), lawCode: s.nullish(), params: z.record(z.string(), z.unknown()).nullish(),
  proposerId: s.nullish(), proposerName: s.nullish(), status: s.nullish(), paperCost: n.nullish(), costItem: s.nullish(), refunded: z.boolean().nullish(),
  yes: n.nullish(), no: n.nullish(), electorateSize: n.nullish(),
  opensAt: s.nullish(), closesAt: s.nullish(), closedAt: s.nullish(), executedAt: s.nullish(), failureReason: s.nullish(), counterpartCountryId: s.nullish(), counterpartDecidedBy: z.unknown().nullish(),
  law: z.object({ label: s.nullish(), description: s.nullish(), bilateral: z.boolean().nullish() }).passthrough().nullish(),
  passRule: z.object({ kind: s.nullish(), ratio: n.nullish(), earlyAt: n.nullish() }).passthrough().nullish(),
  electorate: z.array(z.unknown()).nullish(), ballots: z.array(z.unknown()).nullish(),
}).passthrough();
export type LawDetail = z.infer<typeof lawDetailSchema>;
export const parseLawDetail = (raw: unknown): LawDetail | null => { const r = lawDetailSchema.safeParse(raw); return r.success ? r.data : null; };

export const electorateSchema = z.object({ id: s, name: s.nullish(), voted: z.boolean().nullish() }).passthrough();
export const ballotSchema = z.object({ voterId: s, choice: s, onBehalfOf: z.unknown().nullish(), createdAt: s.nullish(), username: s.nullish(), avatarUrl: s.nullish() }).passthrough();
export const readElectorate = (l: LawDetail) => parseRows(l.electorate, electorateSchema);
export const readBallots = (l: LawDetail) => parseRows(l.ballots, ballotSchema);

/** Parameters that are plain scalars, as [key, text]; nested values are skipped (their shape is not documented). */
export function scalarParams(p: LawDetail["params"]): [string, string][] {
  return Object.entries(asRecord(p)).flatMap(([k, v]) => (typeof v === "string" || typeof v === "number" || typeof v === "boolean" ? [[k, String(v)] as [string, string]] : []));
}

export interface VoteSummary { yes: number; no: number; cast: number; electorate: number | null; yesPct: number | null; turnoutPct: number | null; absent: number | null }
/** Percentages are calculated here (not reported by the API): yes share of cast votes, turnout of the electorate. */
export function voteSummary(l: Pick<LawDetail, "yes" | "no" | "electorateSize">): VoteSummary {
  const yes = l.yes ?? 0, no = l.no ?? 0, cast = yes + no, el = l.electorateSize ?? null;
  return { yes, no, cast, electorate: el, yesPct: cast > 0 ? (yes / cast) * 100 : null, turnoutPct: el ? (cast / el) * 100 : null, absent: el !== null ? Math.max(0, el - cast) : null };
}
