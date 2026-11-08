import { defineFormula, weakestStatus, type EvidenceStatus } from './registry';
import { computeHit, type CombatInput } from './combat';
import { RECIPES } from './economy';

/** Pill (stimulant, "بيل"): +50% attack for 6 h after use, then -50% for the next 12 h, then no modifier. */
export const PILL = { buffMinutes: 360, debuffMinutes: 720, buffPct: 50, debuffPct: -50 } as const;

defineFormula({ id: 'pill.timeline', version: 1, status: 'documented',
  summary: 'After use: attack +50% for 360 min, then -50% for the next 720 min, then no effect (Wiki 01-basics §3.6). The percentage is one of the personal boosts summed with ammo and rank (03-war §1.6 step 2). A new Pill cannot be used until both phases end. The modifier depends on WHEN each hit happens, never a permanent bonus.',
  source: 'wiki 01-basics §3.6; wiki 03-war §1.6 step 2 (timeline also described by the project owner 2026-10-31)', inputs: ['state', 'useAtMin', 'battle window'], outputs: ['phase share'], dependsOn: [], tests: ['pill timeline'] });
defineFormula({ id: 'pill.plan', version: 1, status: 'estimated',
  summary: 'Expected damage per battle = sum over phases (share of hits in phase x per-hit damage computed with that phase\'s stimulant percentage in the full hit model). Hits are spread uniformly over the battle window unless explicit hit times are given.',
  source: 'engine design', inputs: ['combat', 'schedule', 'plan'], outputs: ['damage', 'delta', 'cost'], dependsOn: ['pill.timeline', 'combat.hitOutcomes', 'combat.booster'], tests: ['pill plans'] });

export type PillState =
  | { kind: 'none' }
  | { kind: 'buff'; remainingMinutes: number }
  | { kind: 'debuff'; remainingMinutes: number }
  /** Not exposed by the API; must be supplied or explicitly assumed. */
  | { kind: 'unknown' };
export type Phase = 'none' | 'buff' | 'debuff';
interface Piece { from: number; to: number; phase: Phase }

/** Minutes (from now) at which the current cycle is completely over and a new Pill may be used. */
export function earliestNewUse(state: Exclude<PillState, { kind: 'unknown' }>): number {
  if (state.kind === 'none') return 0;
  if (state.kind === 'debuff') return state.remainingMinutes;
  return state.remainingMinutes + PILL.debuffMinutes;
}
function statePieces(state: Exclude<PillState, { kind: 'unknown' }>): Piece[] {
  if (state.kind === 'buff') return [{ from: 0, to: state.remainingMinutes, phase: 'buff' }, { from: state.remainingMinutes, to: state.remainingMinutes + PILL.debuffMinutes, phase: 'debuff' }];
  if (state.kind === 'debuff') return [{ from: 0, to: state.remainingMinutes, phase: 'debuff' }];
  return [];
}
const makePillPieces = (t: number): Piece[] => [{ from: t, to: t + PILL.buffMinutes, phase: 'buff' }, { from: t + PILL.buffMinutes, to: t + PILL.buffMinutes + PILL.debuffMinutes, phase: 'debuff' }];
export const phaseAt = (pieces: Piece[], t: number): Phase => pieces.find((p) => t >= p.from && t < p.to)?.phase ?? 'none';

export interface Battle { startMinutes: number; durationMinutes: number; hits: number; /** optional explicit hit times (minutes from battle start); default uniform */ hitOffsetsMinutes?: number[] }
/** Share of the battle's hits that fall in each phase. */
export function phaseShares(pieces: Piece[], b: Battle): Record<Phase, number> {
  const out: Record<Phase, number> = { none: 0, buff: 0, debuff: 0 };
  if (b.hitOffsetsMinutes && b.hitOffsetsMinutes.length) {
    for (const o of b.hitOffsetsMinutes) out[phaseAt(pieces, b.startMinutes + o)] += 1 / b.hitOffsetsMinutes.length;
    return out;
  }
  const D = Math.max(b.durationMinutes, 1e-9), s = b.startMinutes, e = s + D;
  let covered = 0;
  for (const p of pieces) { const ov = Math.max(0, Math.min(e, p.to) - Math.max(s, p.from)); out[p.phase] += ov / D; covered += ov / D; }
  out.none += Math.max(0, 1 - covered);
  return out;
}

export interface PillCost { mode: 'buy' | 'craft' | 'owned'; /** gold per Pill from the market (buy) */ marketPrice?: number | null; /** gold per coca unit (craft) */ cocaPrice?: number | null }
export function pillCost(c: PillCost): { gold: number | null; productionPoints: number; basis: string } {
  const r = RECIPES.stimulant!;
  if (c.mode === 'owned') return { gold: 0, productionPoints: 0, basis: 'already owned (sunk cost; the Pill could still be sold)' };
  if (c.mode === 'buy') return { gold: c.marketPrice ?? null, productionPoints: 0, basis: 'market purchase' };
  const coca = r.ingredients[0]!.qty;
  return { gold: c.cocaPrice == null ? null : coca * c.cocaPrice, productionPoints: r.pointsPerUnit, basis: `craft: ${coca} coca + ${r.pointsPerUnit} production points (own time not priced)` };
}

export interface PillPlanInput {
  /** Everything except `booster` (set per phase internally). */
  combat: Omit<CombatInput, 'booster'>;
  state: PillState;
  /** Battles to be fought, minutes from now. */
  schedule: Battle[];
  cost: PillCost;
  /** Gold earned per point of damage (e.g. bounty rate / 1000); omit if none. */
  goldPerDamage?: number;
  /** Explicit candidate use times (minutes from now); default: start of each battle (if allowed) and the earliest allowed time. */
  candidateUseTimes?: number[];
  /** Required when state is unknown: scenario to assume (reported as an assumption). */
  assumeState?: Exclude<PillState, { kind: 'unknown' }>;
}
export interface PillPlanOutcome {
  label: string; useAtMinutes: number | null; damagePerBattle: number[]; totalDamage: number;
  deltaDamage: number; goldCost: number | null; goldGain: number | null; net: number | null;
  costPer1000ExtraDamage: number | null; hitsInDebuff: number; hitsInBuff: number;
}
export interface PillAnalysis {
  ok: true; stateUsed: Exclude<PillState, { kind: 'unknown' }>; assumptions: string[];
  baseline: PillPlanOutcome; plans: PillPlanOutcome[]; best: PillPlanOutcome;
  /** weakest evidence among the Pill formulas and the damage formulas the numbers rest on (e.g. the unverified crit multiplier) */
  evidence: EvidenceStatus; usedFormulas: string[];
}
export type PillAnalysisResult = PillAnalysis | { ok: false; reason: 'state-unknown' | 'invalid'; message: string };

export function analysePill(input: PillPlanInput): PillAnalysisResult {
  const assumptions: string[] = [];
  let state: Exclude<PillState, { kind: 'unknown' }>;
  if (input.state.kind === 'unknown') {
    if (!input.assumeState) return { ok: false, reason: 'state-unknown', message: 'The current Pill phase is not exposed by the API. Supply it (none / buff + remaining minutes / debuff + remaining minutes) or pass assumeState.' };
    state = input.assumeState; assumptions.push(`Current Pill state assumed: ${JSON.stringify(state)}.`);
  } else state = input.state;
  if (!input.schedule.length) return { ok: false, reason: 'invalid', message: 'schedule needs at least one battle.' };
  for (const b of input.schedule) if (!(b.hits > 0) || !(b.durationMinutes > 0) || b.startMinutes < 0) return { ok: false, reason: 'invalid', message: 'Each battle needs hits > 0, durationMinutes > 0 and startMinutes >= 0.' };
  const earliest = earliestNewUse(state);
  const times = new Set<number>();
  for (const t of input.candidateUseTimes ?? [earliest, ...input.schedule.map((b) => b.startMinutes)]) if (t >= earliest) times.add(t);
  if (times.size === 0) assumptions.push(`No Pill can be used before minute ${earliest} (current cycle still running).`);
  const cost = pillCost(input.cost);
  const gpd = input.goldPerDamage ?? 0;

  // Per-hit damage in each phase: only the stimulant percentage in the personal-boost sum differs between phases.
  const hits = (booster: 'none' | 'positive' | 'negative') => computeHit({ ...input.combat, booster });
  const hn = hits('none'), hb = hits('positive'), hd = hits('negative');
  const E = { none: hn.expected, buff: hb.expected, debuff: hd.expected };
  const evalPlan = (label: string, useAt: number | null): PillPlanOutcome => {
    const pieces = [...statePieces(state), ...(useAt === null ? [] : makePillPieces(useAt))];
    let total = 0, inDebuff = 0, inBuff = 0;
    const per = input.schedule.map((b) => {
      const s = phaseShares(pieces, b);
      const d = b.hits * (s.none * E.none + s.buff * E.buff + s.debuff * E.debuff);
      total += d; inDebuff += b.hits * s.debuff; inBuff += b.hits * s.buff; return d;
    });
    return { label, useAtMinutes: useAt, damagePerBattle: per, totalDamage: total, deltaDamage: 0, goldCost: useAt === null ? 0 : cost.gold, goldGain: null, net: null, costPer1000ExtraDamage: null, hitsInDebuff: inDebuff, hitsInBuff: inBuff };
  };
  const baseline = evalPlan('no new Pill', null);
  const plans = [...times].sort((a, b) => a - b).map((t) => evalPlan(`use Pill at +${t} min`, t));
  for (const p of [baseline, ...plans]) {
    p.deltaDamage = p.totalDamage - baseline.totalDamage;
    p.goldGain = p.deltaDamage * gpd;
    p.net = p.goldCost === null ? null : p.goldGain - p.goldCost;
    p.costPer1000ExtraDamage = p.goldCost === null || p.deltaDamage <= 0 || p.useAtMinutes === null ? null : (p.goldCost / p.deltaDamage) * 1000;
  }
  const best = [baseline, ...plans].reduce((a, b) => (b.totalDamage > a.totalDamage + 1e-9 ? b : a));
  assumptions.push('Hits assumed uniformly spread over each battle window unless explicit hit times were given.');
  const used = [...new Set(['pill.timeline', 'pill.plan', 'combat.booster', ...hb.usedFormulas, ...hn.usedFormulas])];
  return { ok: true, stateUsed: state, assumptions, baseline, plans, best, evidence: weakestStatus(used), usedFormulas: used };
}
