import { defineFormula } from './registry';
import {
  SKILL_IDS, SKILLS, MAX_LEVEL, cumulativeCost, exactLevelForPoints, isUnlocked,
  maxLevelForPoints, minLevelForPoints, minLevelForStat, skillValue, type Levels, type SkillId,
} from './skills';

export type ConstraintSpec =
  | { type: 'minLevel'; skill: SkillId; level: number }
  | { type: 'maxLevel'; skill: SkillId; level: number }
  | { type: 'exactLevel'; skill: SkillId; level: number }
  | { type: 'minPoints'; skill: SkillId; points: number }
  | { type: 'maxPoints'; skill: SkillId; points: number }
  | { type: 'exactPoints'; skill: SkillId; points: number }
  /** capability: the skill's stat value must be >= value (e.g. companySlots >= 3). Uses interpolated values (estimated). */
  | { type: 'minStat'; skill: SkillId; value: number }
  | { type: 'totalBudget'; points: number };

/** mandatory = hard constraint, never violated. preference = soft, only reported / used as a tie-break. */
export interface Constraint {
  id: string;
  strength: 'mandatory' | 'preference';
  spec: ConstraintSpec;
  reason?: string;
}

export type ConflictCode =
  | 'BOUNDS_CONTRADICT' | 'SKILL_LOCKED' | 'EXACT_POINTS_UNATTAINABLE'
  | 'STAT_UNREACHABLE' | 'BUDGET_EXCEEDED' | 'INVALID_CONSTRAINT';
export interface Conflict { code: ConflictCode; constraintIds: string[]; message: string; details?: Record<string, number | string> }

export interface Bounds { lo: number; hi: number }
export type ResolveResult =
  | { ok: true; bounds: Record<SkillId, Bounds>; budget: number; minimumPointsRequired: number; usedFormulas: string[] }
  | { ok: false; conflicts: Conflict[] };

defineFormula({
  id: 'constraints.resolve', kind: 'algorithm', version: 1, status: 'documented',
  summary: 'Mandatory constraints are folded into per-skill [lo,hi] level bounds and a point budget before search; contradictions yield a conflict report.',
  source: 'project requirement (spec §2.2, §3.4)', inputs: ['constraints', 'playerLevel', 'totalPoints'],
  outputs: ['bounds', 'budget'], dependsOn: ['skills.cost', 'skills.unlock'], tests: ['constraint resolution', 'conflicts'],
});

export interface ResolveContext { playerLevel: number; totalPoints: number }

export function resolveConstraints(constraints: Constraint[], ctx: ResolveContext): ResolveResult {
  const conflicts: Conflict[] = [];
  const bounds = {} as Record<SkillId, Bounds>;
  const loBy = {} as Record<SkillId, string[]>;
  const hiBy = {} as Record<SkillId, string[]>;
  for (const s of SKILL_IDS) {
    bounds[s] = { lo: 0, hi: isUnlocked(s, ctx.playerLevel) ? MAX_LEVEL : 0 };
    loBy[s] = []; hiBy[s] = [];
  }
  let budget = ctx.totalPoints;
  const budgetBy: string[] = [];
  const bad = (c: Constraint, msg: string) => conflicts.push({ code: 'INVALID_CONSTRAINT', constraintIds: [c.id], message: msg });
  const raiseLo = (c: Constraint, s: SkillId, v: number) => { if (v > bounds[s].lo) bounds[s].lo = v; if (v > 0) loBy[s].push(c.id); };
  const lowerHi = (c: Constraint, s: SkillId, v: number) => { bounds[s].hi = Math.min(bounds[s].hi, v); hiBy[s].push(c.id); };

  for (const c of constraints.filter((x) => x.strength === 'mandatory')) {
    const sp = c.spec;
    if (sp.type === 'totalBudget') {
      if (sp.points < 0) { bad(c, 'Budget cannot be negative.'); continue; }
      if (sp.points < budget) { budget = sp.points; budgetBy.push(c.id); }
      continue;
    }
    if ('level' in sp && (!Number.isInteger(sp.level) || sp.level < 0 || sp.level > MAX_LEVEL)) { bad(c, `Level must be an integer 0-${MAX_LEVEL}.`); continue; }
    if ('points' in sp && sp.points < 0) { bad(c, 'Points cannot be negative.'); continue; }
    switch (sp.type) {
      case 'minLevel': raiseLo(c, sp.skill, sp.level); break;
      case 'maxLevel': lowerHi(c, sp.skill, sp.level); break;
      case 'exactLevel': raiseLo(c, sp.skill, sp.level); lowerHi(c, sp.skill, sp.level); break;
      case 'minPoints': {
        const l = minLevelForPoints(sp.points);
        if (l === null) conflicts.push({ code: 'EXACT_POINTS_UNATTAINABLE', constraintIds: [c.id], message: `A skill can hold at most 49 points; ${sp.points} requested.` });
        else raiseLo(c, sp.skill, l);
        break;
      }
      case 'maxPoints': lowerHi(c, sp.skill, maxLevelForPoints(sp.points)); break;
      case 'exactPoints': {
        const l = exactLevelForPoints(sp.points);
        if (l === null) conflicts.push({ code: 'EXACT_POINTS_UNATTAINABLE', constraintIds: [c.id], message: `No level of ${sp.skill} costs exactly ${sp.points} points (cumulative costs: 0,1,2,4,7,11,16,22,30,39,49).` });
        else { raiseLo(c, sp.skill, l); lowerHi(c, sp.skill, l); }
        break;
      }
      case 'minStat': {
        const l = minLevelForStat(sp.skill, sp.value);
        if (l === null) conflicts.push({ code: 'STAT_UNREACHABLE', constraintIds: [c.id], message: `${sp.skill} cannot reach ${sp.value} (max ${SKILLS[sp.skill].level10}).` });
        else raiseLo(c, sp.skill, l);
        break;
      }
    }
  }
  for (const s of SKILL_IDS) {
    const b = bounds[s];
    if (b.lo > 0 && !isUnlocked(s, ctx.playerLevel)) {
      conflicts.push({ code: 'SKILL_LOCKED', constraintIds: [...loBy[s]], message: `${s} unlocks at player level ${SKILLS[s].unlockLevel} (player is ${ctx.playerLevel}).` });
    } else if (b.lo > b.hi) {
      conflicts.push({ code: 'BOUNDS_CONTRADICT', constraintIds: [...loBy[s], ...hiBy[s]], message: `${s}: required minimum level ${b.lo} exceeds allowed maximum ${b.hi}.`, details: { lo: b.lo, hi: b.hi } });
    }
  }
  if (conflicts.length) return { ok: false, conflicts };
  const need = SKILL_IDS.reduce((t, s) => t + cumulativeCost(bounds[s].lo), 0);
  if (need > budget) {
    const ids = SKILL_IDS.flatMap((s) => (bounds[s].lo > 0 ? loBy[s] : []));
    return { ok: false, conflicts: [{
      code: 'BUDGET_EXCEEDED', constraintIds: [...new Set([...ids, ...budgetBy])],
      message: `Mandatory minimums need ${need} points but only ${budget} are available. Relax at least ${need - budget} point(s).`,
      details: { required: need, available: budget, shortfall: need - budget },
    }] };
  }
  return { ok: true, bounds, budget, minimumPointsRequired: need, usedFormulas: ['constraints.resolve', 'skills.cost', 'skills.unlock'] };
}

/** Does a finished build satisfy this constraint? (used for preferences and as a final safety check) */
export function satisfies(spec: ConstraintSpec, levels: Levels, spent: number): boolean {
  switch (spec.type) {
    case 'minLevel': return levels[spec.skill] >= spec.level;
    case 'maxLevel': return levels[spec.skill] <= spec.level;
    case 'exactLevel': return levels[spec.skill] === spec.level;
    case 'minPoints': return cumulativeCost(levels[spec.skill]) >= spec.points;
    case 'maxPoints': return cumulativeCost(levels[spec.skill]) <= spec.points;
    case 'exactPoints': return cumulativeCost(levels[spec.skill]) === spec.points;
    case 'minStat': return skillValue(spec.skill, levels[spec.skill]) >= spec.value;
    case 'totalBudget': return spent <= spec.points;
  }
}

/** Helper: keep existing companies running (slots) and workers employable (leadership). Mandatory. */
export function companyCapabilityConstraints(companies: number, workers = 0): Constraint[] {
  const out: Constraint[] = [];
  if (companies > 0) out.push({ id: 'cap:companies', strength: 'mandatory', spec: { type: 'minStat', skill: 'companySlots', value: companies }, reason: `Keep ${companies} company slot(s)` });
  if (workers > 0) out.push({ id: 'cap:workers', strength: 'mandatory', spec: { type: 'minStat', skill: 'leadership', value: workers }, reason: `Keep leadership for ${workers} worker(s)` });
  return out;
}
/** Helper: skills may only be raised in game, so "no reset" means every current level is a mandatory floor. */
export function noReduceConstraints(current: Levels): Constraint[] {
  return SKILL_IDS.filter((s) => current[s] > 0).map((s) => ({
    id: `keep:${s}`, strength: 'mandatory' as const, spec: { type: 'minLevel' as const, skill: s, level: current[s] }, reason: 'Do not reduce (avoids a skill reset)',
  }));
}
