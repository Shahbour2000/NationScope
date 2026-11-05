import { defineFormula } from './registry';
import { SKILL_IDS, cumulativeCost, type Levels, type SkillId } from './skills';
import type { Bounds, Constraint } from './constraints';
import { satisfies } from './constraints';

defineFormula({
  id: 'solver.exhaustive', kind: 'algorithm', version: 1, status: 'documented',
  summary: 'Deterministic exhaustive DFS over the decision skills within bounds and budget. Non-decision skills sit at their mandatory minimum. Optimal for the supplied score function when exhaustive=true.',
  source: 'engine design', inputs: ['bounds', 'budget', 'decisionSkills', 'score'], outputs: ['ranked candidates'], dependsOn: ['skills.cost'],
  tests: ['solver optimality vs brute force', 'solver determinism'],
});

export interface SolveInput {
  bounds: Record<SkillId, Bounds>;
  budget: number;
  decisionSkills: SkillId[];
  score: (levels: Levels) => number;
  preferences?: Constraint[];
  topK?: number;
  maxEvaluations?: number;
}
export interface Candidate { levels: Levels; pointsSpent: number; score: number; preferencesSatisfied: string[]; preferencesViolated: string[] }
export interface SolveResult { candidates: Candidate[]; evaluations: number; exhaustive: boolean }

function cmp(a: Candidate, b: Candidate): number {
  if (a.score !== b.score) return b.score - a.score;
  if (a.preferencesSatisfied.length !== b.preferencesSatisfied.length) return b.preferencesSatisfied.length - a.preferencesSatisfied.length;
  if (a.pointsSpent !== b.pointsSpent) return a.pointsSpent - b.pointsSpent;
  for (const s of SKILL_IDS) if (a.levels[s] !== b.levels[s]) return a.levels[s] - b.levels[s];
  return 0;
}

export function solve(input: SolveInput): SolveResult {
  const { bounds, budget, decisionSkills } = input;
  const topK = input.topK ?? 3;
  const cap = input.maxEvaluations ?? 5_000_000;
  const prefs = input.preferences ?? [];
  const levels = {} as Levels;
  let base = 0;
  for (const s of SKILL_IDS) { levels[s] = bounds[s].lo; base += cumulativeCost(bounds[s].lo); }
  if (base > budget) return { candidates: [], evaluations: 0, exhaustive: true };
  const best: Candidate[] = [];
  let evals = 0, exhaustive = true;

  const visit = (i: number, spent: number): void => {
    if (!exhaustive) return;
    if (i === decisionSkills.length) {
      if (++evals > cap) { exhaustive = false; return; }
      const score = input.score(levels);
      if (Number.isNaN(score)) throw new Error('score function returned NaN');
      const ok: string[] = [], bad: string[] = [];
      for (const p of prefs) (satisfies(p.spec, levels, spent) ? ok : bad).push(p.id);
      const cand: Candidate = { levels: { ...levels }, pointsSpent: spent, score, preferencesSatisfied: ok, preferencesViolated: bad };
      best.push(cand); best.sort(cmp); if (best.length > topK) best.length = topK;
      return;
    }
    const s = decisionSkills[i]!;
    const { lo, hi } = bounds[s];
    const loCost = cumulativeCost(lo);
    for (let l = lo; l <= hi; l++) {
      const extra = cumulativeCost(l) - loCost;
      if (spent + extra > budget) break;
      levels[s] = l;
      visit(i + 1, spent + extra);
    }
    levels[s] = lo;
  };
  visit(0, base);
  return { candidates: best, evaluations: Math.min(evals, cap), exhaustive };
}

// ---------------------------------------------------------------------------
// Two-group exact solver (for objectives that combine independent skill groups,
// e.g. hybrid combat+economy). Exact when the combiner is monotone non-decreasing
// in both metrics: dominated (higher cost, no better metric) options can then never win.
// ---------------------------------------------------------------------------
defineFormula({
  id: 'solver.twoGroup', kind: 'algorithm', version: 1, status: 'documented',
  summary: 'Enumerate each disjoint skill group exhaustively, keep the (cost, metric) Pareto front, then combine pairs within budget. Exact for combiners monotone in both metrics.',
  source: 'engine design', inputs: ['bounds', 'budget', 'groupA', 'groupB', 'combine'], outputs: ['ranked candidates'], dependsOn: ['skills.cost', 'solver.exhaustive'],
  tests: ['two-group matches brute force'],
});
export interface GroupEntry { levels: Levels; extraCost: number; metric: number }
export function enumerateGroup(bounds: Record<SkillId, Bounds>, skills: SkillId[], metric: (l: Levels) => number, maxEvaluations = 5_000_000): { entries: GroupEntry[]; exhaustive: boolean } {
  const levels = {} as Levels;
  for (const s of SKILL_IDS) levels[s] = bounds[s].lo;
  const entries: GroupEntry[] = [];
  let evals = 0, ok = true;
  const go = (i: number, extra: number): void => {
    if (!ok) return;
    if (i === skills.length) {
      if (++evals > maxEvaluations) { ok = false; return; }
      const m = metric(levels);
      if (Number.isNaN(m)) throw new Error('metric returned NaN');
      entries.push({ levels: { ...levels }, extraCost: extra, metric: m });
      return;
    }
    const s = skills[i]!; const { lo, hi } = bounds[s]; const loCost = cumulativeCost(lo);
    for (let l = lo; l <= hi; l++) { levels[s] = l; go(i + 1, extra + cumulativeCost(l) - loCost); }
    levels[s] = lo;
  };
  go(0, 0);
  return { entries, exhaustive: ok };
}
export function paretoFront(entries: GroupEntry[]): GroupEntry[] {
  const sorted = [...entries].sort((a, b) => a.extraCost - b.extraCost || b.metric - a.metric);
  const out: GroupEntry[] = []; let best = Number.NEGATIVE_INFINITY;
  for (const e of sorted) if (e.metric > best) { out.push(e); best = e.metric; }
  return out;
}
export function combineGroups(
  a: { entries: GroupEntry[]; skills: SkillId[] }, b: { entries: GroupEntry[]; skills: SkillId[] },
  bounds: Record<SkillId, Bounds>, budget: number, combine: (ma: number, mb: number) => number,
  opts: { topK?: number; preferences?: Constraint[] } = {},
): Candidate[] {
  let base = 0; for (const s of SKILL_IDS) base += cumulativeCost(bounds[s].lo);
  const avail = budget - base;
  const fa = paretoFront(a.entries), fb = paretoFront(b.entries);
  const best: Candidate[] = [];
  for (const ea of fa) for (const eb of fb) {
    if (ea.extraCost + eb.extraCost > avail) continue;
    const score = combine(ea.metric, eb.metric);
    if (!Number.isFinite(score)) continue;
    const levels = { ...ea.levels };
    for (const s of b.skills) levels[s] = eb.levels[s];
    const spent = base + ea.extraCost + eb.extraCost;
    const ok: string[] = [], bad: string[] = [];
    for (const p of opts.preferences ?? []) (satisfies(p.spec, levels, spent) ? ok : bad).push(p.id);
    best.push({ levels, pointsSpent: spent, score, preferencesSatisfied: ok, preferencesViolated: bad });
    best.sort(cmp); if (best.length > (opts.topK ?? 3)) best.length = opts.topK ?? 3;
  }
  return best;
}
