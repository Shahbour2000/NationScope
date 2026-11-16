import { z } from "zod";
import { parseRows } from "./parse";

/** GET /elections/{id}. Written from the real captures API/samples/elections (presidential and congress, both finished). */
const s = z.string();
const n = z.number();
export const candidateSchema = z.object({
  id: s, userId: s, username: s, avatarUrl: s.nullish(), level: n.nullish(), partyId: s.nullish(), partyName: s.nullish(), statement: s.nullish(), articleId: s.nullish(),
  registeredAt: s.nullish(), withdrawn: z.boolean().nullish(), votes: n.nullish(), elected: z.boolean().nullish(), disqualified: z.boolean().nullish(),
}).passthrough();
export type Candidate = z.infer<typeof candidateSchema>;

export const electionDetailSchema = z.object({
  id: s.min(1), kind: s.nullish(), label: s.nullish(), countryId: s.nullish(), partyId: s.nullish(), partyName: s.nullish(), periodKey: s.nullish(), status: s.nullish(), seats: n.nullish(),
  candidacyOpensAt: s.nullish(), votingOpensAt: s.nullish(), closesAt: s.nullish(), finishedAt: s.nullish(), ballotsCast: n.nullish(), tallyHidden: z.boolean().nullish(),
  outcome: s.nullish(), tieBreak: s.nullish(), rules: z.record(z.string(), z.unknown()).nullish(), candidates: z.array(z.unknown()).nullish(),
}).passthrough();
export type ElectionDetail = z.infer<typeof electionDetailSchema>;
export const parseElectionDetail = (raw: unknown): ElectionDetail | null => { const r = electionDetailSchema.safeParse(raw); return r.success ? r.data : null; };

/** Candidates ordered for display: elected first, then by votes (when counts are visible), then by registration time. Withdrawn and disqualified are kept but sorted last. */
export function readCandidates(e: ElectionDetail): { rows: Candidate[]; skipped: number } {
  const { rows, skipped } = parseRows(e.candidates, candidateSchema);
  const rank = (c: Candidate) => (c.withdrawn || c.disqualified ? 2 : c.elected ? 0 : 1);
  rows.sort((a, b) => rank(a) - rank(b) || (b.votes ?? -1) - (a.votes ?? -1) || (a.registeredAt ?? "").localeCompare(b.registeredAt ?? ""));
  return { rows, skipped };
}

/** Share of ballots a candidate received, one decimal, or null when counts are hidden/missing. Calculated, not reported. */
export const voteSharePct = (c: Pick<Candidate, "votes">, e: Pick<ElectionDetail, "ballotsCast" | "tallyHidden" | "seats">): number | null => {
  if (e.tallyHidden || c.votes == null || !e.ballotsCast) return null;
  // With several seats each voter may back more than one candidate, so a share of ballots can exceed what a single-seat reading suggests; it is still votes / ballots.
  return Math.round((c.votes / e.ballotsCast) * 1000) / 10;
};
