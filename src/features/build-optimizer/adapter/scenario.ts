import type { OptimizeRequest, Objective } from '../engine/optimize';
import type { AmmoType, BoosterPhase, WarContext } from '../engine/combat';
import type { Constraint } from '../engine/constraints';
import { companyCapabilityConstraints } from '../engine/constraints';
import type { Battle, PillCost } from '../engine/pill';
import type { EconomyInput, CompanyGroup } from '../engine/economy';
import { economyPrices, type MarketSnapshot, type SellBasis } from './market';
import { marketCodeOf, recipeForMarketCode } from './codes';
import type { PlayerState } from './player-state';
import type { WarBuildRequest, WarCandidates, WarObjective, FoodOption } from '../engine/war-build';
import type { Candidates } from '../engine/loadout';
import { goldFromMoney } from './market';

export interface Scenario {
  objective: Objective;
  hits?: number;
  ammo?: AmmoType;
  /** Pill phase for the FIRST battle when no pill plan is given; default 'none'. */
  booster?: BoosterPhase;
  war?: WarContext;
  market?: MarketSnapshot;
  sellBasis?: SellBasis;
  /** Taxes of the country that controls the player's companies / jobs (not imported; supply them). */
  taxes?: { marketPct?: number; productionPct?: number; incomePct?: number };
  job?: { wagePerPoint: number };
  workers?: { pointsPerWorkerPerDay: number; wagePerPoint: number };
  constraints?: Constraint[];
  allowReset?: boolean;
  /** Keep leadership high enough for workers currently employed in the player's companies. */
  keepCurrentWorkers?: boolean;
  topK?: number;
  pill?: { schedule: Battle[]; cost: PillCost; goldPerDamage?: number; assumeState?: Exclude<NonNullable<PlayerState['pill']['value']>, { kind: 'unknown' }> };
}
export type ScenarioResult = { ok: true; request: OptimizeRequest; notes: string[] } | { ok: false; missing: string[] };

/** Turns the imported PlayerState + a scenario into an OptimizeRequest. Refuses (and says why) rather than inventing required values. */
export function toOptimizeRequest(state: PlayerState, sc: Scenario): ScenarioResult {
  const missing: string[] = [], notes: string[] = [];
  if (state.level.value === null) missing.push('level');
  if (state.skills.levels.value === null) missing.push('skills');
  if (state.skillPoints.consistent === false) missing.push('consistent skill data (supplied skill-point information contradicts the invested points)');
  if (missing.length) return { ok: false, missing };
  const ammo = sc.ammo ?? 'none';
  const needsEcon = sc.objective.type === 'maxEconomy' || sc.objective.type === 'hybrid';

  let economy: EconomyInput | undefined;
  const constraints: Constraint[] = [...(sc.constraints ?? [])];
  if (state.companies.count && state.companies.count > 0) {
    constraints.push(...companyCapabilityConstraints(state.companies.count).map((c) => ({ ...c, id: 'cap:companies:owned', reason: `Keep all ${state.companies.count} companies you own active` })));
    if (sc.keepCurrentWorkers) {
      const w = state.companies.items.reduce((n, c) => n + (c.workers ?? 0), 0);
      if (w > 0) constraints.push(...companyCapabilityConstraints(0, w).map((c) => ({ ...c, id: 'cap:workers:current' })));
    }
  }
  if (needsEcon) {
    if (!sc.market) missing.push('market snapshot');
    if (state.companies.count === null) missing.push('companies');
    if (sc.taxes?.marketPct === undefined) notes.push('Market tax not supplied: 0% assumed and reported.');
    if (missing.length) return { ok: false, missing };
    const groups = new Map<string, CompanyGroup>();
    const unmodelled: string[] = [];
    for (const c of state.companies.items) {
      const r = recipeForMarketCode(c.itemCode);
      if (!r) { unmodelled.push(c.itemCode); continue; }
      const g = groups.get(r.itemCode) ?? { count: 0, product: r, productionBonusPct: 0 };
      g.count++; groups.set(r.itemCode, g);
    }
    if (unmodelled.length) notes.push(`Companies making products the economy model does not value (${[...new Set(unmodelled)].join(', ')}) still reserve slots but add no modelled income.`);
    notes.push('Per-company production bonuses (deposits, specialization, party) are not imported: 0% used.');
    economy = {
      companies: [...groups.values()], prices: economyPrices(sc.market!, sc.sellBasis ?? 'bid'),
      marketTaxPct: sc.taxes?.marketPct, productionTaxPct: sc.taxes?.productionPct, incomeTaxPct: sc.taxes?.incomePct,
      job: sc.job, workers: sc.workers && state.companies.items.length ? { count: state.companies.items.reduce((n, c) => n + (c.workers ?? 0), 0), ...sc.workers } : undefined,
    };
  }
  const lead = sc.market ? sc.market.ask[marketCodeOf('lead')] : undefined;
  if (state.gear.value === null) notes.push('Equipped gear unknown: gear slots are reported missing and contribute 0.');
  if (state.rank.bonusPct.value === null) notes.push('Rank bonus unknown.');
  const request: OptimizeRequest = {
    player: {
      level: state.level.value!, currentLevels: state.skills.levels.value!, totalPoints: state.skillPoints.earned.value ?? undefined,
      prestigeCount: state.prestigeCount.value ?? undefined, firstResetFree: state.firstResetFree.value ?? undefined,
    },
    objective: sc.objective, constraints, allowReset: sc.allowReset ?? true,
    combat: { gear: state.gear.value ?? {}, ammo, booster: sc.booster ?? 'none', rankBonusPct: state.rank.bonusPct.value ?? undefined, war: sc.war },
    economy, hits: sc.hits, prices: lead != null ? { leadPerUnit: lead } : undefined, topK: sc.topK,
    pill: sc.pill ? { state: state.pill.value ?? { kind: 'unknown' }, schedule: sc.pill.schedule, cost: sc.pill.cost, goldPerDamage: sc.pill.goldPerDamage, assumeState: sc.pill.assumeState } : undefined,
  };
  if (!state.skillPoints.exact) notes.push(`Skill points are a LOWER BOUND: ${state.skillPoints.earned.note}`);
  return { ok: true, request, notes };
}

export interface WarScenario {
  hits: number;
  /** 'fixed': the gear in the profile/user input is mandatory. 'optimize': choose from `candidates` (+ `owned`). */
  gearMode: 'fixed' | 'optimize';
  /** purchasable offers, e.g. offersToCandidates(...).candidates */
  candidates?: Candidates;
  /** gear the player already owns (price undefined = free), with known durability */
  owned?: WarCandidates;
  allowEmpty?: boolean; estimate?: 'low' | 'mid' | 'high'; maxConfigs?: number;
  ammoOptions?: AmmoType[]; food?: FoodOption[]; leadStock?: number;
  market?: MarketSnapshot; war?: WarContext; objective: WarObjective;
  constraints?: Constraint[]; allowReset?: boolean;
  pill?: { include: false } | ({ include: true } & NonNullable<OptimizeRequest['pill']>);
}
export type WarScenarioResult = { ok: true; request: WarBuildRequest; notes: string[] } | { ok: false; missing: string[] };

/** Imported PlayerState + scenario -> War Build request. Economic skills are never touched; Pill stays out of the search. */
export function toWarBuildRequest(state: PlayerState, sc: WarScenario): WarScenarioResult {
  const missing: string[] = [], notes: string[] = [];
  if (state.level.value === null) missing.push('level');
  if (state.skills.levels.value === null) missing.push('skills');
  if (state.skillPoints.consistent === false) missing.push('consistent skill data (supplied skill-point information contradicts the invested points)');
  if (sc.gearMode === 'fixed' && state.gear.value === null) missing.push('equipped gear (Fixed Gear needs the real equipment; user input)');
  if (sc.gearMode === 'optimize' && !sc.candidates && !sc.owned) missing.push('equipment candidates (market offers or owned items)');
  if (state.skillPoints.earned.value === null) missing.push('earned skill points');
  if (missing.length) return { ok: false, missing };
  const constraints: Constraint[] = [...(sc.constraints ?? [])];
  if (state.companies.count && state.companies.count > 0) constraints.push(...companyCapabilityConstraints(state.companies.count).map((c) => ({ ...c, id: 'cap:companies:owned', reason: `Keep all ${state.companies.count} companies you own active` })));
  const merged: WarCandidates = { ...(sc.candidates ?? {}) };
  for (const k of ['weapons', 'helmets', 'gloves', 'chests', 'legs', 'boots', 'rarityOnly'] as const) { const extra = sc.owned?.[k]; if (extra?.length) (merged as Record<string, unknown>)[k] = [...((merged as Record<string, unknown[]>)[k] ?? []), ...extra]; }
  const lead = sc.market?.ask[marketCodeOf('lead')];
  if (lead == null && (sc.ammoOptions ?? ['none']).some((a) => a !== 'none')) notes.push('Lead price unknown: ammo cost counted as 0 (lower bound).');
  if (state.rank.bonusPct.value === null) notes.push('Rank bonus unknown.');
  if (!state.skillPoints.exact) notes.push(`Skill points are a LOWER BOUND: ${state.skillPoints.earned.note}`);
  void goldFromMoney;
  const request: WarBuildRequest = {
    player: { level: state.level.value!, totalPoints: state.skillPoints.earned.value!, currentLevels: state.skills.levels.value!, firstResetFree: state.firstResetFree.value ?? undefined },
    constraints, allowReset: sc.allowReset ?? true, hits: sc.hits,
    gear: sc.gearMode === 'fixed' ? { mode: 'fixed', gear: state.gear.value! } : { mode: 'optimize', candidates: merged, allowEmpty: sc.allowEmpty, estimate: sc.estimate, maxConfigs: sc.maxConfigs },
    ammoOptions: sc.ammoOptions, food: sc.food ? { options: sc.food } : undefined,
    prices: { leadPerUnit: lead ?? undefined, leadStock: sc.leadStock }, rankBonusPct: state.rank.bonusPct.value ?? undefined, war: sc.war,
    objective: sc.objective,
    pill: sc.pill ? (sc.pill.include ? { ...sc.pill, state: state.pill.value ?? sc.pill.state ?? { kind: 'unknown' } } : sc.pill) : undefined,
  };
  return { ok: true, request, notes };
}
