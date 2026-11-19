import { roundDiv } from "./fixed";

/**
 * Agent rental model. GATED: agents are "coming soon" on the dev server (Agents.txt) and no API endpoint exposes them.
 * The base output of an agent in PP per hour is NOT documented, so it is an explicit INPUT (`basePPPerHour`) and every result
 * is only as good as that number. Documented multipliers only: +10% output per skill level (1..10) and the type factor
 * (specialist: 100% on its item / 60% similar / 40% other; all-rounder: 70% everywhere).
 */
export const AGENTS_ENABLED = false;
export type AgentFit = "specialist-own" | "specialist-similar" | "specialist-other" | "all-rounder";
export const FIT_PCT: Readonly<Record<AgentFit, number>> = { "specialist-own": 100, "specialist-similar": 60, "specialist-other": 40, "all-rounder": 70 };

export interface AgentInput { basePPPerHour: number; skill: number; fit: AgentFit }
/** PP per hour = base x (1 + 0.1 x skill) x fit. Returned in 1/100 PP to stay integer. */
export function agentPPPerHourCenti(a: AgentInput): bigint {
  if (!Number.isInteger(a.skill) || a.skill < 1 || a.skill > 10) throw new RangeError("Agent skill is 1..10.");
  if (!(a.basePPPerHour > 0)) throw new RangeError("Base output must be a positive number (it is an unverified input).");
  return (BigInt(Math.round(a.basePPPerHour * 100)) * BigInt(100 + 10 * a.skill) * BigInt(FIT_PCT[a.fit])) / 10_000n;
}
/** Most the hirer can pay per hour without losing money: output x value per PP (the agent tax comes out of the owner's side). */
export function maxHourlyWage(a: AgentInput, vppPerPP: bigint): bigint { return roundDiv(agentPPPerHourCenti(a) * vppPerPP, 100n); }
/** Net gain per hour for the hirer at `wage`. */
export function hourlyNet(a: AgentInput, vppPerPP: bigint, wage: bigint): bigint { return maxHourlyWage(a, vppPerPP) - wage; }
/** Wage per PP an agent effectively costs, comparable to worker wages. */
export function wagePerPP(a: AgentInput, hourlyWage: bigint): bigint { return roundDiv(hourlyWage * 100n, agentPPPerHourCenti(a)); }
/** Owner's take-home per hour after the agent tax (basis points). */
export function ownerNet(hourlyWage: bigint, agentTaxBp: bigint): bigint { return hourlyWage - roundDiv(hourlyWage * agentTaxBp, 10_000n); }
/** Gold that must be in the hirer's wallet to start a hire: 24 hours of wage (documented). */
export const hireDeposit = (hourlyWage: bigint): bigint => hourlyWage * 24n;
