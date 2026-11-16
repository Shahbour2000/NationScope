import { z } from "zod";
import { asRecord, parseRows } from "./parse";

/** GET /game: live rule tables, verified against the real capture API/samples/game/Game information.txt. Unknown keys are kept as labelled values. */
export type RuleValue = string | number | boolean;
export interface RuleRow { key: string; value: RuleValue }
const scalarRows = (o: unknown): RuleRow[] => Object.entries(asRecord(o)).flatMap(([key, value]) => (typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? [{ key, value }] : []));

export const boardSchema = z.object({
  id: z.string().min(1), label: z.string(), subjectType: z.string().nullish(), metric: z.string().nullish(), grain: z.string().nullish(), periods: z.array(z.string()).nullish(),
  archived: z.boolean().nullish(), reset: z.string().nullish(), visibility: z.string().nullish(), countryScope: z.boolean().nullish(),
}).passthrough();
export type Board = z.infer<typeof boardSchema>;

export interface GameRules {
  serverTime: string | null; rulesetVersion: string | null;
  battle: RuleRow[]; tickPoints: { from: number; points: number }[]; contract: RuleRow[]; auction: RuleRow[]; reputation: RuleRow[];
  boards: Board[]; boardsSkipped: number; historyTypes: string[];
}

export function parseGameRules(raw: unknown): GameRules | null {
  const o = asRecord(raw);
  if (!o.battleRules && !o.contractRules && !o.leaderboards) return null;
  const br = asRecord(o.battleRules), cr = asRecord(o.contractRules);
  const ticks = Object.entries(asRecord(br.tickPoints)).flatMap(([k, v]) => (/^\d+$/.test(k) && typeof v === "number" ? [{ from: Number(k), points: v }] : [])).sort((a, b) => a.from - b.from);
  const lb = parseRows(o.leaderboards, boardSchema);
  return {
    serverTime: typeof o.serverTime === "string" ? o.serverTime : null, rulesetVersion: typeof o.rulesetVersion === "string" ? o.rulesetVersion : null,
    battle: scalarRows(br), tickPoints: ticks, contract: scalarRows(cr), auction: scalarRows(cr.auction), reputation: scalarRows(cr.reputation),
    boards: lb.rows, boardsSkipped: lb.skipped, historyTypes: Array.isArray(o.historyTypes) ? o.historyTypes.filter((x): x is string => typeof x === "string") : [],
  };
}
