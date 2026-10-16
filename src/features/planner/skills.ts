/**
 * Skill allocation search. Game-agnostic: the game's skill rules and effect formulas are INPUTS
 * (SkillDef.cumulativeCost and the objective). Nothing here encodes Age of Nations mechanics.
 */
export class PlannerInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlannerInputError";
  }
}

export interface SkillDef {
  id: string;
  maxLevel: number;
  /** Total points needed to hold `level` (level 0 costs 0). Must be non-decreasing. */
  cumulativeCost: (level: number) => number;
}

export type Levels = Readonly<Record<string, number>>;

export interface AllocationInput {
  skills: readonly SkillDef[];
  /** Total skill points available, INCLUDING points already invested in `floor`. */
  points: number;
  /** Levels that cannot be reduced (already invested). Defaults to 0. */
  floor?: Levels;
  objective: (levels: Levels) => number;
  /** How many ranked alternatives to keep (default 5). */
  top?: number;
  /** Stop after this many complete allocations are scored (default 2,000,000). */
  maxEvaluations?: number;
}

export interface Allocation {
  levels: Levels;
  spent: number;
  score: number;
}

export interface AllocationResult {
  best: Allocation | null;
  /** Ranked by score desc, then fewer points spent. Includes `best` first. */
  ranked: Allocation[];
  evaluated: number;
  /** True only if every feasible allocation was scored. Optimality is relative to the supplied model. */
  exhaustive: boolean;
}

export function allocateSkills(input: AllocationInput): AllocationResult {
  const { skills, points, objective } = input;
  const top = input.top ?? 5;
  const maxEval = input.maxEvaluations ?? 2_000_000;
  if (!Number.isInteger(points) || points < 0) throw new PlannerInputError("points must be a non-negative integer.");
  if (new Set(skills.map((s) => s.id)).size !== skills.length) throw new PlannerInputError("Skill ids must be unique.");

  const floor: Record<string, number> = {};
  let floorCost = 0;
  for (const s of skills) {
    if (!Number.isInteger(s.maxLevel) || s.maxLevel < 0) throw new PlannerInputError(`Invalid max level for ${s.id}.`);
    for (let l = 1; l <= s.maxLevel; l++) {
      if (s.cumulativeCost(l) < s.cumulativeCost(l - 1)) throw new PlannerInputError(`Cost for ${s.id} must not decrease.`);
    }
    if (s.cumulativeCost(0) !== 0) throw new PlannerInputError(`Level 0 of ${s.id} must cost 0.`);
    const f = input.floor?.[s.id] ?? 0;
    if (!Number.isInteger(f) || f < 0 || f > s.maxLevel) throw new PlannerInputError(`Floor for ${s.id} is outside 0..${s.maxLevel}.`);
    floor[s.id] = f;
    floorCost += s.cumulativeCost(f);
  }
  for (const id of Object.keys(input.floor ?? {})) if (!(id in floor)) throw new PlannerInputError(`Unknown skill in floor: ${id}.`);
  if (floorCost > points) throw new PlannerInputError("Already-invested levels cost more than the available points.");

  const ranked: Allocation[] = [];
  let evaluated = 0;
  let exhaustive = true;
  const current: Record<string, number> = {};

  const record = (spent: number): void => {
    const levels = { ...current };
    const score = objective(levels);
    if (!Number.isFinite(score)) throw new PlannerInputError("Objective returned a non-finite value.");
    evaluated++;
    const a: Allocation = { levels, spent, score };
    let i = ranked.length;
    while (i > 0 && (ranked[i - 1]!.score < score || (ranked[i - 1]!.score === score && ranked[i - 1]!.spent > spent))) i--;
    if (i < top) {
      ranked.splice(i, 0, a);
      if (ranked.length > top) ranked.pop();
    }
  };

  const walk = (index: number, spent: number): void => {
    if (!exhaustive) return;
    const skill = skills[index];
    if (!skill) {
      if (evaluated >= maxEval) { exhaustive = false; return; }
      record(spent);
      return;
    }
    const base = skill.cumulativeCost(floor[skill.id]!);
    for (let level = floor[skill.id]!; level <= skill.maxLevel; level++) {
      const next = spent - base + skill.cumulativeCost(level);
      if (next > points) break; // costs are non-decreasing
      current[skill.id] = level;
      walk(index + 1, next);
      if (!exhaustive) return;
    }
  };

  walk(0, floorCost);
  return { best: ranked[0] ?? null, ranked, evaluated, exhaustive };
}
