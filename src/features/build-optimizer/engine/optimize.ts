import { computeHit, horizon, type CombatInput, type Horizon, type HitModel, type Prices } from './combat';
import { companyCapabilityConstraints, noReduceConstraints, resolveConstraints, satisfies, type Conflict, type Constraint } from './constraints';
import { combineGroups, enumerateGroup, paretoFront, solve, type Candidate } from './solver';
import { pointsEarned, resetCost, SKILL_IDS, totalCost, type Levels, type SkillId } from './skills';
import { defineFormula } from './registry';
import { dailyEconomy, totalCompanies, type EconomyInput, type EconomyResult } from './economy';
import { lootExpectation, type Floors } from './rewards';
import { skillValue } from './skills';
import { analysePill, type PillAnalysisResult, type PillPlanInput } from './pill';

export type Objective =
  | { type: 'maxDamagePerHit' }
  /** bounty income - ammo cost (+ expected loot value when includeLoot, which needs `loot` floors) over `hits` */
  | { type: 'maxNetValue'; includeLoot?: boolean }
  | { type: 'maxEconomy' }
  /** maximize damage while keeping daily economic net >= minDailyNet (outcome floor; hard) */
  | { type: 'hybrid'; mode: 'constrained'; minDailyNet: number }
  /** weighted sum of damage and daily net, each normalised by its solo optimum under the same constraints (weights are exposed) */
  | { type: 'hybrid'; mode: 'weighted'; weightCombat: number; weightEconomy: number };

defineFormula({ id: 'objective.maxDamagePerHit', version: 1, status: 'estimated',
  summary: 'Score = expected damage per hit (pre-rounding). Decision skills: attack, accuracy, critChance, critDamage.',
  source: 'engine design on combat.* formulas', inputs: ['levels', 'gear', 'ammo', 'war'], outputs: ['score'], dependsOn: ['combat.hitOutcomes'], tests: ['objective damage'] });
defineFormula({ id: 'objective.maxNetValue', version: 1, status: 'estimated',
  summary: 'Score = bounty income - ammo cost (+ expected loot value if enabled) over N hits; adds lootChance as a decision skill when loot is included.',
  source: 'engine design', inputs: ['hits', 'prices', 'bounty', 'floors'], outputs: ['score'], dependsOn: ['combat.bounty', 'rewards.loot', 'combat.hitOutcomes'], tests: ['objective net value', 'looter objective'] });
defineFormula({ id: 'objective.maxEconomy', version: 1, status: 'estimated',
  summary: 'Score = modelled daily net gold (econ.dailyNet). Decision skills: production, business, energy, leadership. Companies in the model are auto-protected via a mandatory company-slot constraint.',
  source: 'engine design on econ.* formulas', inputs: ['levels', 'economy'], outputs: ['score'], dependsOn: ['econ.dailyNet'], tests: ['economic objective'] });
defineFormula({ id: 'objective.hybrid', version: 1, status: 'estimated',
  summary: 'Two independent skill groups (combat, economy) solved exactly via Pareto fronts and combined: constrained (damage subject to economy floor) or weighted (normalised, weights exposed).',
  source: 'engine design', inputs: ['combat', 'economy', 'mode'], outputs: ['score'], dependsOn: ['solver.twoGroup', 'objective.maxDamagePerHit', 'objective.maxEconomy'], tests: ['hybrid constrained', 'hybrid weighted'] });

export interface OptimizeRequest {
  player: { level: number; prestigeCount?: number; totalPoints?: number; currentLevels?: Levels; firstResetFree?: boolean };
  objective: Objective;
  constraints?: Constraint[];
  /** false => current levels become mandatory floors (skills can only be raised without a reset). */
  allowReset?: boolean;
  combat: Omit<CombatInput, 'levels'>;
  economy?: EconomyInput;
  loot?: Floors;
  hits?: number;
  prices?: Prices;
  topK?: number;
  /** Optional Pill analysis attached to every returned build (timing-dependent; never folded into the skill score). */
  pill?: Omit<PillPlanInput, 'combat'>;
}
export interface BuildResult {
  levels: Levels; pointsSpent: number; pointsRemaining: number; score: number;
  hit: HitModel; horizon: Horizon; economy: EconomyResult | null; pill: PillAnalysisResult | null;
  loot: { expectedCrates: number; expectedValue: number | null } | null;
  resetRequired: boolean; resetCostGold: number | null;
  mandatoryPreserved: string[]; preferencesSatisfied: string[]; preferencesViolated: string[];
  deltaVsCurrent: Partial<Record<SkillId, number>> | null;
}
export type OptimizeResult =
  | { ok: true; builds: BuildResult[]; assumptions: string[]; exhaustive: boolean; evaluations: number; minimumPointsRequired: number; totalPoints: number }
  | { ok: false; reason: 'conflict'; conflicts: Conflict[] }
  | { ok: false; reason: 'unsupported' | 'missing-input' | 'infeasible'; message: string };

const COMBAT: SkillId[] = ['attack', 'accuracy', 'critChance', 'critDamage'];
const ECON: SkillId[] = ['production', 'business', 'energy', 'leadership'];
const INFEASIBLE = -1e15;

export function optimizeBuild(req: OptimizeRequest): OptimizeResult {
  const assumptions: string[] = [];
  const obj = req.objective;
  const needsEcon = obj.type === 'maxEconomy' || obj.type === 'hybrid';
  if (needsEcon && !req.economy) return { ok: false, reason: 'missing-input', message: 'This objective needs an `economy` input (companies, prices, taxes, workers/job).' };
  if (obj.type === 'maxNetValue' && req.prices?.leadPerUnit === undefined && req.combat.ammo !== 'none')
    return { ok: false, reason: 'missing-input', message: 'maxNetValue needs prices.leadPerUnit for the chosen ammo.' };
  if (obj.type === 'maxNetValue' && obj.includeLoot && !req.loot) return { ok: false, reason: 'missing-input', message: 'includeLoot needs `loot` floor prices (weapon/armor floors for every rarity).' };

  let totalPoints = req.player.totalPoints;
  if (totalPoints === undefined) {
    totalPoints = pointsEarned(req.player.level, req.player.prestigeCount ?? 0);
    assumptions.push(`Earned skill points are a LOWER BOUND (${totalPoints} = 4*(level-1)+4*prestige with prestige ${req.player.prestigeCount === undefined ? 'unknown, 0 used' : req.player.prestigeCount}); supply the real total (the Prestige count is not exposed by the API).`);
  }
  const hits = req.hits ?? 1000;
  const all: Constraint[] = [...(req.constraints ?? [])];
  const cur = req.player.currentLevels;
  if (req.allowReset === false) {
    if (!cur) return { ok: false, reason: 'missing-input', message: 'allowReset=false needs player.currentLevels.' };
    all.push(...noReduceConstraints(cur));
  }
  if (needsEcon && totalCompanies(req.economy!.companies) > 0 && !all.some((c) => c.id.startsWith('cap:companies'))) {
    all.push(...companyCapabilityConstraints(totalCompanies(req.economy!.companies)).map((c) => ({ ...c, id: 'cap:companies:auto' })));
    assumptions.push(`Existing companies (${totalCompanies(req.economy!.companies)}) are protected by a mandatory company-slot constraint.`);
  }
  const res = resolveConstraints(all, { playerLevel: req.player.level, totalPoints });
  if (!res.ok) return { ok: false, reason: 'conflict', conflicts: res.conflicts };
  const prefs = all.filter((c) => c.strength === 'preference');
  const topK = req.topK ?? 3;

  const combatMetric = (l: Levels): number => computeHit({ ...req.combat, levels: l }).expected;
  const netMetric = (l: Levels): number => {
    const hit = computeHit({ ...req.combat, levels: l });
    const h = horizon(hit, req.combat.ammo, hits, req.prices ?? {}, req.combat.war);
    if (h.net === null) return INFEASIBLE;
    const lootV = obj.type === 'maxNetValue' && obj.includeLoot ? lootExpectation(hits, skillValue('lootChance', l.lootChance), req.loot).expectedValue : 0;
    return lootV === null ? INFEASIBLE : h.net + lootV;
  };
  const econMetric = (l: Levels): number => dailyEconomy(l, req.economy!).net ?? INFEASIBLE;

  let candidates: Candidate[] = []; let exhaustive = true; let evaluations = 0;
  if (obj.type === 'maxDamagePerHit' || obj.type === 'maxNetValue') {
    const skills = obj.type === 'maxNetValue' && obj.includeLoot ? [...COMBAT, 'lootChance' as SkillId] : COMBAT;
    const s = solve({ bounds: res.bounds, budget: res.budget, decisionSkills: skills, score: obj.type === 'maxDamagePerHit' ? combatMetric : netMetric, preferences: prefs, topK });
    candidates = s.candidates; exhaustive = s.exhaustive; evaluations = s.evaluations;
    if (obj.type === 'maxNetValue') candidates = candidates.filter((c) => c.score > INFEASIBLE / 2);
  } else if (obj.type === 'maxEconomy') {
    const s = solve({ bounds: res.bounds, budget: res.budget, decisionSkills: ECON, score: econMetric, preferences: prefs, topK });
    candidates = s.candidates.filter((c) => c.score > INFEASIBLE / 2); exhaustive = s.exhaustive; evaluations = s.evaluations;
  } else {
    const a = enumerateGroup(res.bounds, COMBAT, combatMetric);
    const b = enumerateGroup(res.bounds, ECON, econMetric);
    b.entries = b.entries.filter((e) => e.metric > INFEASIBLE / 2);
    exhaustive = a.exhaustive && b.exhaustive; evaluations = a.entries.length + b.entries.length;
    let combine: (ma: number, mb: number) => number;
    if (obj.mode === 'constrained') combine = (ma, mb) => (mb >= obj.minDailyNet ? ma : Number.NEGATIVE_INFINITY);
    else {
      const norm = (entries: { metric: number }[]) => { const m = Math.max(...entries.map((e) => e.metric)); return Math.abs(m) > 1e-9 ? Math.abs(m) : 1; };
      const na = norm(paretoFront(a.entries)), nb = b.entries.length ? norm(paretoFront(b.entries)) : 1;
      combine = (ma, mb) => obj.weightCombat * (ma / na) + obj.weightEconomy * (mb / nb);
      assumptions.push(`Weighted hybrid normalises damage by ${na.toFixed(2)} and daily net by ${nb.toFixed(2)} (each solo optimum, ignoring the shared point budget).`);
    }
    if (!b.entries.length) return { ok: false, reason: 'infeasible', message: 'No economy build is feasible (check prices, company slots and constraints).' };
    candidates = combineGroups({ entries: a.entries, skills: COMBAT }, { entries: b.entries, skills: ECON }, res.bounds, res.budget, combine, { topK, preferences: prefs });
  }
  if (!candidates.length) return { ok: false, reason: 'infeasible', message: obj.type === 'hybrid' && obj.mode === 'constrained' ? 'No build reaches the required daily economic net within the point budget.' : 'No feasible build found (missing prices or budget).' };

  const mandatory = all.filter((c) => c.strength === 'mandatory');
  const curSpent = cur ? totalCost(cur) : 0;
  const builds: BuildResult[] = candidates.map((cand) => {
    for (const m of mandatory) if (!satisfies(m.spec, cand.levels, cand.pointsSpent)) throw new Error(`Internal error: mandatory constraint ${m.id} violated`);
    const hit = computeHit({ ...req.combat, levels: cand.levels });
    const resetRequired = !!cur && SKILL_IDS.some((s) => cand.levels[s] < cur[s]);
    return {
      levels: cand.levels, pointsSpent: cand.pointsSpent, pointsRemaining: totalPoints - cand.pointsSpent, score: cand.score,
      hit, horizon: horizon(hit, req.combat.ammo, hits, req.prices ?? {}, req.combat.war),
      economy: req.economy ? dailyEconomy(cand.levels, req.economy) : null,
      pill: req.pill ? analysePill({ ...req.pill, combat: { ...req.combat, levels: cand.levels } }) : null,
      loot: obj.type === 'maxNetValue' && obj.includeLoot ? lootExpectation(hits, skillValue('lootChance', cand.levels.lootChance), req.loot) : null,
      resetRequired, resetCostGold: resetRequired ? resetCost(curSpent, req.player.firstResetFree ?? false) : cur ? 0 : null,
      mandatoryPreserved: mandatory.map((m) => m.id),
      preferencesSatisfied: cand.preferencesSatisfied, preferencesViolated: cand.preferencesViolated,
      deltaVsCurrent: cur ? Object.fromEntries(SKILL_IDS.filter((s) => cand.levels[s] !== cur[s]).map((s) => [s, cand.levels[s] - cur[s]])) : null,
    };
  });
  if (req.player.firstResetFree === undefined && builds.some((b) => b.resetRequired)) assumptions.push('firstResetFree unknown: reset cost assumes the free reset is already used.');
  return { ok: true, builds, assumptions, exhaustive, evaluations, minimumPointsRequired: res.minimumPointsRequired, totalPoints };
}
