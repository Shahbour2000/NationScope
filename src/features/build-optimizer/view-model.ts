import { getFormula, type EvidenceStatus } from './engine/registry';
import { ECON_SKILLS, SKILL_IDS, WAR_SKILLS, isInterpolated, skillValue, type Levels, type SkillId } from './engine/skills';
import type { PillAnalysisResult } from './engine/pill';
import type { SustainableBuild } from './engine/sustainable';
import type { WarBuild } from './engine/war-build';
import type { BuildResult } from './engine/optimize';
import type { GearInput } from './engine/combat';
import type { SlotKey } from './api-schema';

/** JSON-safe shapes sent to the browser. Nothing here can hold Infinity/undefined; unknown numbers are null (never 0). */
export type Evidence = EvidenceStatus | 'unknown';
export interface SkillRowVM { id: SkillId; group: 'war' | 'economic'; current: number | null; proposed: number; proposedValue: number; interpolated: boolean }
export interface GearRowVM { slot: SlotKey; id: string | null; stats: Record<string, number | boolean> | null; durability: number | null; estimated: boolean; owned: boolean }
export interface CostVM { acquisition: number; ammo: number; food: number; replacement: number; total: number; lowerBound: boolean; missing: string[] }
export interface CombatVM { perHit: number; hits: number; damage: number; damageLow: number | null; damageHigh: number | null; cleanChancePct: number; critChancePct: number; lossPerHit: number; meals: number; hungerAvailable: number; crates: number; lootChancePct: number }
export interface SessionVM { hits: number; limiting: string; damage: number; perHit: number; mealsTotal: number; hungerLeft: number; lossPerHit: number }
export interface EconomyVM { net: number; ownProfit: number | null; workerMargin: number | null; jobIncome: number; ownPointsPerDay: number; ownWorksPerDay: number; effectiveWorkers: number }
export interface BuildVM {
  role: 'primary' | 'max-damage' | 'best-value' | 'lowest-cost';
  skills: SkillRowVM[]; pointsSpent: number; pointsRemaining: number; reset: { required: boolean; costGold: number | null };
  gear: GearRowVM[] | null; ammo: string | null; food: { type: string; meals: number } | null;
  combat: CombatVM | null; session: SessionVM | null; economy: EconomyVM | null;
  cost: CostVM | null; costPer1000: number | null; net: number | null; netUpperBound: boolean;
  evidence: Evidence; preserved: string[];
}
export interface CurrentVM { perHit: number | null; damage: number | null; hits: number | null; lossPerHit: number | null; economyNet: number | null; missing: string[] }
export interface PillPlanVM { label: string; useAtMinutes: number | null; totalDamage: number; deltaDamage: number; goldCost: number | null; net: number | null; costPer1000Extra: number | null; hitsInBuff: number; hitsInDebuff: number }
export type PillVM = { ok: true; stateUsed: string; baselineDamage: number; best: string; plans: PillPlanVM[]; assumptions: string[]; evidence: Evidence } | { ok: false; reason: string; message: string };
export interface FormulaVM { id: string; status: EvidenceStatus; kind: 'mechanic' | 'algorithm'; summary: string }
export interface ResultOk {
  ok: true; kind: 'war' | 'sustainable' | 'economic' | 'hybrid'; objective: string;
  builds: BuildVM[]; current: CurrentVM | null; pill: PillVM | null;
  assumptions: string[]; notes: string[]; formulas: FormulaVM[]; evidence: Evidence;
  totalPoints: number; pointsExact: boolean; estimatedGear: boolean; lowerBoundCost: boolean;
}
export type ResultVM = ResultOk | { ok: false; reason: 'conflict' | 'missing-input' | 'infeasible' | 'too-large' | 'error'; message: string; details: string[] };

const finite = (n: number): number | null => (Number.isFinite(n) ? n : null);
const WAR_SET = new Set<SkillId>(WAR_SKILLS), ECON_SET = new Set<SkillId>(ECON_SKILLS);
export const SKILL_GROUP = (id: SkillId): 'war' | 'economic' => (WAR_SET.has(id) ? 'war' : ECON_SET.has(id) ? 'economic' : 'war');

export function skillRows(levels: Levels, current: Levels | null): SkillRowVM[] {
  return SKILL_IDS.map((id) => ({ id, group: SKILL_GROUP(id), current: current ? current[id] : null, proposed: levels[id], proposedValue: skillValue(id, levels[id]), interpolated: isInterpolated(levels[id]) }));
}
export function formulaRows(ids: string[]): FormulaVM[] {
  return [...new Set(ids)].sort().map((id) => { const f = getFormula(id); return { id, status: f.status, kind: f.kind ?? 'mechanic', summary: f.summary }; });
}
export function weakest(list: Evidence[]): Evidence {
  const rank: Record<Evidence, number> = { verified: 0, documented: 1, estimated: 2, unverified: 3, unknown: 4 };
  return list.reduce<Evidence>((w, e) => (rank[e] > rank[w] ? e : w), 'verified');
}
const gearSlots: SlotKey[] = ['weapon', 'helmet', 'gloves', 'chest', 'legs', 'boots'];

export function mapWarBuild(b: WarBuild, current: Levels | null): BuildVM {
  return {
    role: b.role, skills: skillRows(b.levels, current), pointsSpent: b.pointsSpent, pointsRemaining: b.pointsRemaining, reset: { required: b.resetRequired, costGold: b.resetCostGold },
    gear: gearSlots.map((s) => { const g = b.gear.find((x) => x.slot === s)!; return { slot: s, id: g.id, stats: g.stats, durability: g.durability, estimated: g.estimated, owned: g.owned }; }),
    ammo: b.ammo, food: b.food ? { type: b.food.type, meals: b.food.meals } : null,
    combat: { perHit: b.hit.expected, hits: b.hits, damage: b.expectedDamage, damageLow: b.damageRange?.low ?? null, damageHigh: b.damageRange?.high ?? null, cleanChancePct: b.hit.cleanChance * 100, critChancePct: b.hit.critChance * 100, lossPerHit: b.survival.lossPerHit, meals: b.survival.meals, hungerAvailable: b.survival.hungerAvailable, crates: b.loot.expectedCrates, lootChancePct: b.loot.chancePct },
    session: null, economy: null,
    cost: { acquisition: b.cost.acquisition, ammo: b.cost.ammo, food: b.cost.food, replacement: b.cost.replacement, total: b.cost.total, lowerBound: b.costIsLowerBound, missing: b.cost.missingPrices },
    costPer1000: b.costPer1000Damage, net: b.net, netUpperBound: b.netIsUpperBound, evidence: b.evidence, preserved: b.mandatoryPreserved,
  };
}
function gearFromInput(g: GearInput, ids: Record<string, string | null>, owned: (s: SlotKey) => boolean): GearRowVM[] {
  return gearSlots.map((s) => {
    const it = g[s] as { kind: string; stats?: Record<string, number | boolean> } | undefined;
    return { slot: s, id: ids[s] ?? null, stats: it?.kind === 'item' ? { ...it.stats } as Record<string, number | boolean> : null, durability: null, estimated: false, owned: owned(s) };
  });
}
export function mapSustainBuild(b: SustainableBuild, role: BuildVM['role'], current: Levels | null, owned: (s: SlotKey) => boolean): BuildVM {
  const s = b.session;
  return {
    role, skills: skillRows(b.levels, current), pointsSpent: b.pointsSpent, pointsRemaining: b.pointsRemaining, reset: { required: b.resetRequired, costGold: null },
    gear: gearFromInput(b.gear, b.gearIds, owned), ammo: b.ammo, food: s.meals.length ? { type: s.meals.map((m) => `${m.type}×${m.meals}`).join(', '), meals: s.mealsTotal } : null,
    combat: null,
    session: { hits: s.sustainableHits, limiting: s.limitingFactor, damage: s.expectedDamage, perHit: s.hit.expected, mealsTotal: s.mealsTotal, hungerLeft: s.hungerLeft, lossPerHit: s.lossPerHit },
    economy: null, cost: { acquisition: b.acquisition, ammo: s.cost.ammo, food: s.cost.food, replacement: s.cost.replacement, total: b.totalCost, lowerBound: b.costIsLowerBound, missing: s.cost.missing },
    costPer1000: s.expectedDamage > 0 ? (b.totalCost / s.expectedDamage) * 1000 : null, net: null, netUpperBound: false, evidence: s.evidence, preserved: b.mandatoryPreserved,
  };
}
export function mapOptimizeBuild(b: BuildResult, current: Levels | null, withCombat: boolean): BuildVM {
  const e = b.economy;
  return {
    role: 'primary', skills: skillRows(b.levels, current), pointsSpent: b.pointsSpent, pointsRemaining: b.pointsRemaining, reset: { required: b.resetRequired, costGold: b.resetCostGold },
    gear: null, ammo: null, food: null,
    combat: withCombat ? { perHit: b.hit.expected, hits: 1, damage: b.hit.expected, damageLow: null, damageHigh: null, cleanChancePct: b.hit.cleanChance * 100, critChancePct: b.hit.critChance * 100, lossPerHit: b.hit.healthLossPerHit, meals: 0, hungerAvailable: 0, crates: 0, lootChancePct: 0 } : null,
    session: null,
    economy: e && e.net !== null ? { net: e.net, ownProfit: e.ownProfit, workerMargin: e.workerMargin, jobIncome: e.jobIncome, ownPointsPerDay: e.ownPointsPerDay, ownWorksPerDay: e.ownWorksPerDay, effectiveWorkers: e.effectiveWorkers } : null,
    cost: null, costPer1000: null, net: null, netUpperBound: false, evidence: withCombat ? b.hit.evidence : 'estimated', preserved: b.mandatoryPreserved,
  };
}
export function mapPill(p: PillAnalysisResult | null | undefined): PillVM | null {
  if (!p) return null;
  if (!p.ok) return { ok: false, reason: p.reason, message: p.message };
  const plan = (x: typeof p.baseline): PillPlanVM => ({ label: x.label, useAtMinutes: x.useAtMinutes, totalDamage: x.totalDamage, deltaDamage: x.deltaDamage, goldCost: x.goldCost, net: x.net, costPer1000Extra: x.costPer1000ExtraDamage, hitsInBuff: x.hitsInBuff, hitsInDebuff: x.hitsInDebuff });
  return { ok: true, stateUsed: p.stateUsed.kind === 'none' ? 'none' : `${p.stateUsed.kind} ${p.stateUsed.remainingMinutes}m`, baselineDamage: p.baseline.totalDamage, best: p.best.label, plans: p.plans.map(plan), assumptions: p.assumptions, evidence: p.evidence };
}
export { finite };

// ---------------------------------------------------------------- import preview
import type { BuildImport } from './adapter/import';
import { recipeForMarketCode } from './adapter/codes';
export type SourceTag = 'api' | 'derived' | 'user' | 'unavailable';
export interface ImportVM {
  player: { id: string; name: string; countryId: string | null; level: number | null; damageTotal: string | null; rankName: string | null; rankBonusPct: number | null };
  provenance: { level: SourceTag; skills: SourceTag; rank: SourceTag; companies: SourceTag; stats: SourceTag; gear: SourceTag; pill: SourceTag; prestige: SourceTag };
  skills: SkillRowVM[] | null;
  points: { earned: number | null; invested: number | null; available: number | null; exact: boolean; basis: string | null; impliedMinPrestige: number | null; note: string | null; consistent: boolean | null };
  companies: { count: number | null; products: { code: string; count: number; modelled: boolean }[] };
  market: { loaded: boolean; items: number };
  offers: { total: number; perSlot: Record<string, number> } | null;
  failures: Record<string, string>; warnings: string[]; missing: string[]; inferredMappings: string[];
}
export function importViewModel(imp: BuildImport): ImportVM {
  const s = imp.state; const levels = s.skills.levels.value;
  const counts = new Map<string, number>();
  for (const c of s.companies.items) counts.set(c.itemCode, (counts.get(c.itemCode) ?? 0) + 1);
  const perSlot: Record<string, number> = {};
  if (imp.candidates) { const c = imp.candidates.candidates; for (const [k, v] of Object.entries(c)) perSlot[k] = (v as unknown[] | undefined)?.length ?? 0; }
  return {
    player: { id: s.id, name: s.name, countryId: s.countryId, level: s.level.value, damageTotal: s.damage.total, rankName: s.rank.name.value, rankBonusPct: s.rank.bonusPct.value },
    provenance: { level: s.level.source, skills: s.skills.levels.source, rank: s.rank.bonusPct.source, companies: s.companies.source, stats: s.stats.source, gear: s.gear.source, pill: s.pill.source, prestige: s.prestigeCount.source },
    skills: levels ? skillRows(levels, levels) : null,
    points: { earned: s.skillPoints.earned.value, invested: s.skillPoints.invested, available: s.skillPoints.available.value, exact: s.skillPoints.exact, basis: s.skillPoints.basis, impliedMinPrestige: s.skillPoints.impliedMinPrestige, note: s.skillPoints.earned.note ?? null, consistent: s.skillPoints.consistent },
    companies: { count: s.companies.count, products: [...counts.entries()].map(([code, count]) => ({ code, count, modelled: recipeForMarketCode(code) !== null })) },
    market: { loaded: imp.market !== null, items: imp.market ? Object.keys(imp.market.ask).length : 0 },
    offers: imp.candidates ? { total: Object.values(perSlot).reduce((a, b) => a + b, 0), perSlot } : null,
    failures: imp.failures, warnings: s.warnings, missing: s.missing, inferredMappings: s.skills.inferredMappings,
  };
}
