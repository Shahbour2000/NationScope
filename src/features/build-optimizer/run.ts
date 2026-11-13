import {
  computeHit, dailyEconomy, optimizeBuild, optimizeSustainableWarBuild, optimizeWarBuild, sustainableCombat, type GearInput, type Levels,
  type OptimizeRequest, type SustainableRequest, type WarCandidates, type WarObjective, type Constraint, type PillState,
} from './engine';
import { importForBuild, toOptimizeRequest, toWarBuildRequest, marketCodeOf, type BuildImport, type ImportDeps, type PlayerState, type UserInputs, type WarScenario, type Scenario } from './adapter';
import type { ApiSlot, OptimizeInput, SlotKey } from './api-schema';
import { SLOT_KEYS } from './api-schema';
import { formulaRows, mapOptimizeBuild, mapPill, mapSustainBuild, mapWarBuild, weakest, type BuildVM, type CurrentVM, type Evidence, type PillVM, type ResultVM } from './view-model';
import type { Candidates } from './engine/loadout';

/** Hard server-side limit for the Sustainable search (it enumerates equipment configurations explicitly). */
export const SUSTAINABLE_MAX_CONFIGS = 60;

const slotToGear = (k: SlotKey, s: ApiSlot): GearInput[keyof GearInput] => {
  if (!s.equipped) return { kind: 'empty' } as GearInput[keyof GearInput];
  const a = s.stat1 ?? 0;
  if (k === 'weapon') return { kind: 'item', stats: { attack: a, critChance: s.stat2 ?? 0, usesAmmo: s.usesAmmo ?? true } } as GearInput[keyof GearInput];
  if (k === 'helmet') return { kind: 'item', stats: { critDamage: a } } as GearInput[keyof GearInput];
  if (k === 'gloves') return { kind: 'item', stats: { accuracy: a } } as GearInput[keyof GearInput];
  if (k === 'boots') return { kind: 'item', stats: { dodge: a } } as GearInput[keyof GearInput];
  return { kind: 'item', stats: { armor: a } } as GearInput[keyof GearInput];
};
/** Slot-level view: every slot the user actually provided (an item or an explicit empty); omitted slots stay unknown. Never a complete loadout by itself. */
export function partialGearFromSlots(slots: Partial<Record<SlotKey, ApiSlot>>): GearInput | undefined {
  const g: Record<string, unknown> = {};
  for (const k of SLOT_KEYS) { const s = slots[k]; if (s) g[k] = slotToGear(k, s); }
  return Object.keys(g).length ? (g as unknown as GearInput) : undefined;
}
/** All six slots present -> a complete GearInput; otherwise null (unknown gear is never half-filled). */
export function gearFromSlots(slots: Partial<Record<SlotKey, ApiSlot>>): GearInput | null {
  if (!SLOT_KEYS.every((k) => slots[k])) return null;
  const g: Record<string, unknown> = {};
  for (const k of SLOT_KEYS) g[k] = slotToGear(k, slots[k]!);
  return g as unknown as GearInput;
}
export function ownedCandidates(slots: Partial<Record<SlotKey, ApiSlot>>): WarCandidates {
  const c: WarCandidates = {};
  for (const k of SLOT_KEYS) {
    const s = slots[k]; if (!s?.equipped || s.durability === undefined) continue;
    const g = slotToGear(k, s) as { kind: string; stats: never };
    const item = { id: `owned:${k}`, stats: g.stats, durability: s.durability };
    if (k === 'weapon') (c.weapons ??= []).push(item as never);
    else if (k === 'helmet') (c.helmets ??= []).push(item as never);
    else if (k === 'gloves') (c.gloves ??= []).push(item as never);
    else if (k === 'chest') (c.chests ??= []).push(item as never);
    else if (k === 'legs') (c.legs ??= []).push(item as never);
    else (c.boots ??= []).push(item as never);
  }
  return c;
}
export function pillStateOf(i: OptimizeInput): PillState | undefined {
  if (!i.pill.enabled) return undefined;
  const s = i.pill.state;
  if (s.kind === 'none') return { kind: 'none' };
  if (s.kind === 'buff' || s.kind === 'debuff') return { kind: s.kind, remainingMinutes: s.minutes ?? 0 };
  return { kind: 'unknown' };
}
export function userInputsOf(i: OptimizeInput): UserInputs {
  return { ...i.user, gear: i.mode === 'economic' ? undefined : partialGearFromSlots(i.war.fixedGear), pill: pillStateOf(i) };
}
export function constraintsOf(i: OptimizeInput): Constraint[] {
  return i.constraints.map((c) => ({ id: `user:${c.skill}:${c.kind}`, strength: 'mandatory' as const, spec: c.kind === 'min' ? { type: 'minLevel' as const, skill: c.skill, level: c.level } : c.kind === 'max' ? { type: 'maxLevel' as const, skill: c.skill, level: c.level } : { type: 'exactLevel' as const, skill: c.skill, level: c.level } }));
}
export function warObjectiveOf(i: OptimizeInput): WarObjective {
  const o = i.war.objective;
  if (o.kind === 'bestValue') return { type: 'bestValue', minDamageShare: o.minDamageSharePct === undefined ? undefined : o.minDamageSharePct / 100, budget: o.budget };
  if (o.kind === 'maxNet') return { type: 'maxNet', goldPerDamage: o.goldPerDamage, crateValue: o.crateValue, budget: o.budget };
  return { type: 'maxDamage', budget: o.budget };
}
/** Drop the most expensive item of the longest list until the explicit configuration count fits (reported to the user). */
export function trimCandidates(c: WarCandidates, ammoCount: number, max: number): { candidates: WarCandidates; trimmed: number } {
  const lists: (keyof WarCandidates)[] = ['weapons', 'helmets', 'gloves', 'chests', 'legs', 'boots'];
  const out: WarCandidates = { ...c }; let trimmed = 0;
  const count = () => lists.reduce((n, k) => n * (((out[k] as unknown[] | undefined)?.length ?? 0) + 1), 1) * ammoCount;
  while (count() > max) {
    let best: keyof WarCandidates | null = null, bl = 0;
    for (const k of lists) { const l = (out[k] as unknown[] | undefined)?.length ?? 0; if (l > bl) { best = k; bl = l; } }
    if (!best || bl < 1) break;
    (out as Record<string, unknown[]>)[best] = (out[best] as unknown[]).slice(0, bl - 1); trimmed++;
  }
  return { candidates: out, trimmed };
}
const fail = (reason: Extract<ResultVM, { ok: false }>['reason'], message: string, details: string[] = []): ResultVM => ({ ok: false, reason, message, details });

export async function loadAndRun(playerId: string, input: OptimizeInput, deps: ImportDeps): Promise<ResultVM | { ok: false; reason: 'not-found'; message: string; details: string[] }> {
  const imp = await importForBuild(playerId, deps, userInputsOf(input));
  if (!imp) return { ok: false, reason: 'not-found', message: 'player not found', details: [] };
  return runOptimization(imp, input);
}

export function runOptimization(imp: BuildImport, input: OptimizeInput): ResultVM {
  const state = imp.state;
  if (state.skills.levels.value === null || state.level.value === null) return fail('missing-input', 'The player profile does not include readable skills or level.', state.missing);
  if (input.mode === 'war') return runWar(imp, input);
  if (!imp.market) return fail('missing-input', 'Market prices could not be loaded, and the economic model needs them.', Object.entries(imp.failures).map(([k, v]) => `${k}: ${v}`));
  return runEconomic(imp, input);
}

function currentWar(state: PlayerState, input: OptimizeInput, rank: number | undefined): CurrentVM | null {
  const levels = state.skills.levels.value!;
  const gear = state.gear.value ?? gearFromSlots(input.war.fixedGear);
  if (!gear) return null;
  const ammo = input.war.ammo[0] ?? 'none';
  if (input.war.kind === 'sustainable') {
    const s = sustainableCombat({ levels, gear, ammo, rankBonusPct: rank, start: { healthFraction: input.war.start.healthPct === undefined ? undefined : input.war.start.healthPct / 100, hunger: input.war.start.hunger }, food: input.war.food.map((f) => ({ type: f.type, price: f.price, stock: f.stock })), ammoStock: input.war.leadStock });
    return { perHit: s.hit.expected, damage: s.expectedDamage, hits: s.sustainableHits, lossPerHit: s.lossPerHit, economyNet: null, missing: [] };
  }
  const h = computeHit({ levels, gear, ammo, booster: 'none', rankBonusPct: rank });
  return { perHit: h.expected, damage: h.expected * input.war.hits, hits: input.war.hits, lossPerHit: h.healthLossPerHit, economyNet: null, missing: h.missing };
}

function warScenario(imp: BuildImport, input: OptimizeInput, maxConfigs?: number): { sc: WarScenario; notes: string[] } {
  const notes: string[] = [];
  const pillCost = (): { mode: 'buy' | 'craft' | 'owned'; marketPrice?: number | null; cocaPrice?: number | null } => {
    if (!input.pill.enabled) return { mode: 'owned' };
    const c = input.pill.cost;
    if (c.mode === 'buy') { const p = c.price ?? imp.market?.ask[marketCodeOf('stimulant')] ?? undefined; if (c.price === undefined && p !== undefined) notes.push('Pill price taken from the lowest market offer.'); return { mode: 'buy', marketPrice: p }; }
    if (c.mode === 'craft') { const p = c.price ?? imp.market?.ask[marketCodeOf('coca')] ?? undefined; return { mode: 'craft', cocaPrice: p }; }
    return { mode: 'owned' };
  };
  let candidates: Candidates | undefined = input.war.useMarketOffers ? imp.candidates?.candidates : undefined;
  if (input.war.useMarketOffers && input.war.gearMode === 'optimize') {
    // Say what the market search could NOT see (never silently): slots whose offers failed to load, offers the API listed beyond the pages read, and offers rejected as unusable.
    const failedSlots = Object.keys(imp.failures).filter((k) => k.startsWith('equipment:')).map((k) => k.slice('equipment:'.length));
    if (failedSlots.length) notes.push(`Market offers could not be loaded for: ${failedSlots.join(', ')}. Those slots were searched without market offers.`);
    const partial = Object.entries(imp.offerCoverage ?? {}).filter(([, c]) => c.moreAvailable).map(([slot, c]) => `${slot} (${c.fetched} cheapest read in ${c.pages} page(s))`);
    if (partial.length) notes.push(`Only the cheapest market offers were read for: ${partial.join(', ')} (page limit, a stalled or failed page). The API lists more, so a stronger but pricier item may exist that this search did not see; the result is not exhaustive over the whole market.`);
    const capped = Object.entries(imp.candidates?.prunedAway ?? {}).map(([k, n]) => `${k} (${n} dropped)`);
    if (capped.length) notes.push(`The per-slot candidate cap dropped Pareto-optimal offers: ${capped.join(', ')}. The cheapest, the dearest and evenly spaced offers were kept; a dropped item could still have been the best for a particular budget.`);
    const rejected = imp.candidates?.skipped.length ?? 0;
    if (rejected) notes.push(`${rejected} market offer(s) were ignored as unusable (missing or invalid stats, price or durability, or duplicate ids).`);
  }
  const owned = ownedCandidates(input.war.ownedGear);
  let cand: WarCandidates | undefined = candidates as WarCandidates | undefined;
  if (maxConfigs && input.war.gearMode === 'optimize') {
    const merged: WarCandidates = { ...(cand ?? {}) };
    for (const k of ['weapons', 'helmets', 'gloves', 'chests', 'legs', 'boots'] as const) if (owned[k]?.length) (merged as Record<string, unknown[]>)[k] = [...((merged[k] as unknown[] | undefined) ?? []), ...(owned[k] as unknown[])];
    const t = trimCandidates(merged, input.war.ammo.length || 1, maxConfigs);
    if (t.trimmed) notes.push(`The Sustainable search was limited to ${maxConfigs} equipment combinations, so ${t.trimmed} of the most expensive market items were left out: the result is not exhaustive over all offers.`);
    cand = t.candidates; candidates = undefined;
  }
  const sc: WarScenario = {
    hits: input.war.hits, gearMode: input.war.gearMode, candidates: maxConfigs && input.war.gearMode === 'optimize' ? (cand as Candidates | undefined) : candidates,
    owned: maxConfigs && input.war.gearMode === 'optimize' ? undefined : owned, allowEmpty: input.war.allowEmpty, estimate: input.war.estimate, maxConfigs: input.war.gearMode === 'optimize' ? (maxConfigs ?? 4000) : undefined,
    ammoOptions: input.war.ammo, food: input.war.food.length ? input.war.food.map((f) => ({ type: f.type, price: f.price })) : undefined, leadStock: input.war.leadStock,
    market: imp.market ?? undefined, objective: warObjectiveOf(input), constraints: constraintsOf(input), allowReset: !input.keepCurrentSkills,
    pill: input.pill.enabled ? { include: true, state: pillStateOf(input) ?? { kind: 'unknown' }, schedule: input.pill.battles, cost: pillCost(), goldPerDamage: input.pill.goldPerDamage ?? (input.war.objective.goldPerDamage) } : { include: false },
  };
  return { sc, notes };
}

function runWar(imp: BuildImport, input: OptimizeInput): ResultVM {
  const state = imp.state; const cur = state.skills.levels.value!;
  const sustainable = input.war.kind === 'sustainable';
  const { sc, notes } = warScenario(imp, input, sustainable ? SUSTAINABLE_MAX_CONFIGS : undefined);
  const r = toWarBuildRequest(state, sc);
  if (!r.ok) return fail('missing-input', 'Some required player data is unavailable.', r.missing);
  notes.push(...r.notes);
  const current = currentWar(state, input, state.rank.bonusPct.value ?? undefined);
  const base = { current, notes, totalPoints: r.request.player.totalPoints, pointsExact: state.skillPoints.exact };
  const owned = (s: SlotKey) => input.war.ownedGear[s]?.equipped === true || input.war.gearMode === 'fixed';
  if (!sustainable) {
    const res = optimizeWarBuild(r.request);
    if (!res.ok) return res.reason === 'conflict' ? fail('conflict', 'The mandatory requirements cannot all be satisfied.', res.conflicts.map((c) => c.message)) : fail(res.reason, res.message);
    const builds: BuildVM[] = res.builds.map((b) => mapWarBuild(b, cur));
    const used = res.builds.flatMap((b) => b.usedFormulas);
    const pill: PillVM | null = res.pill ? mapPill(res.pill[0]) : null;
    return { ok: true, kind: 'war', objective: input.war.objective.kind, builds, pill, assumptions: res.assumptions, formulas: formulaRows(used), evidence: weakest(builds.map((b) => b.evidence)), estimatedGear: res.builds.some((b) => b.estimatedSlots.length > 0), lowerBoundCost: res.builds.some((b) => b.costIsLowerBound), ...base };
  }
  const w = r.request;
  const durab: Partial<Record<'weapon' | 'helmet' | 'gloves' | 'chest' | 'legs' | 'boots', number>> = {};
  if (input.war.gearMode === 'fixed') {
    const resolved = state.equipment.resolved; const fromProfile: string[] = [];
    for (const k of SLOT_KEYS) {
      const typed = input.war.fixedGear[k]?.durability; // the user's value always wins for its slot
      // Profile durability is used only for a slot that was resolved from the profile snapshot (never for a slot the user replaced) and only when it is a positive number: per Wiki 01-basics §3.4 an item at 0 durability is gone.
      const slot = resolved.slots[k]; const prof = slot.source === 'api' && slot.durability !== null && slot.durability > 0 ? slot.durability : undefined;
      const d = typed ?? prof;
      if (d !== undefined) durab[k] = d;
      if (typed === undefined && prof !== undefined) fromProfile.push(`${k} ${prof}`);
    }
    if (fromProfile.length) notes.push(`Durability taken from the profile equipment (wear per hit follows Wiki 01-basics §3.4): ${fromProfile.join(', ')}.`);
  }
  const req: SustainableRequest = {
    player: w.player, constraints: w.constraints, allowReset: w.allowReset,
    gear: w.gear.mode === 'fixed' ? { ...w.gear, durabilities: durab } : { ...w.gear, maxConfigs: SUSTAINABLE_MAX_CONFIGS },
    ammoOptions: w.ammoOptions, ammoStock: input.war.leadStock, leadPerUnit: w.prices?.leadPerUnit, buyAmmo: input.war.buyAmmo,
    start: { healthFraction: input.war.start.healthPct === undefined ? undefined : input.war.start.healthPct / 100, hunger: input.war.start.hunger },
    food: input.war.food.map((f) => ({ type: f.type, price: f.price, stock: f.stock })), rankBonusPct: w.rankBonusPct, war: w.war,
    objective: { type: 'maxSessionDamage', budget: input.war.objective.budget }, maxConfigs: SUSTAINABLE_MAX_CONFIGS, topK: 3,
  };
  const res = optimizeSustainableWarBuild(req);
  if (!res.ok) return res.reason === 'conflict' ? fail('conflict', 'The mandatory requirements cannot all be satisfied.', res.conflicts.map((c) => c.message)) : fail(res.reason, res.message);
  const roles: BuildVM['role'][] = ['primary', 'max-damage', 'best-value'];
  const builds = res.builds.map((b, i) => mapSustainBuild(b, roles[i] ?? 'primary', cur, owned));
  const used = res.builds.flatMap((b) => b.session.usedFormulas).concat(['sustain.search']);
  return { ok: true, kind: 'sustainable', objective: 'maxSessionDamage', builds, pill: null, assumptions: [...res.assumptions, ...res.builds[0]!.session.assumptions], formulas: formulaRows(used), evidence: weakest(builds.map((b) => b.evidence)), estimatedGear: false, lowerBoundCost: res.builds.some((b) => b.costIsLowerBound), ...base, notes: [...notes, ...(input.pill.enabled ? ['The Pill analysis is available for the fixed-hits mode only.'] : [])] };
}

function runEconomic(imp: BuildImport, input: OptimizeInput): ResultVM {
  const state = imp.state; const cur = state.skills.levels.value!;
  const hybrid = input.mode === 'hybrid';
  const objective: Scenario['objective'] = !hybrid ? { type: 'maxEconomy' }
    : input.hybrid.kind === 'constrained' ? { type: 'hybrid', mode: 'constrained', minDailyNet: input.hybrid.minDailyNet ?? 0 }
    : { type: 'hybrid', mode: 'weighted', weightCombat: input.hybrid.weightCombat ?? 1, weightEconomy: input.hybrid.weightEconomy ?? 1 };
  const e = input.economic;
  const sc: Scenario = {
    objective, hits: input.war.hits, ammo: input.war.ammo.find((a) => a !== 'none') ?? 'none', market: imp.market!, sellBasis: e.sellBasis,
    taxes: { marketPct: e.marketTaxPct, productionPct: e.productionTaxPct, incomePct: e.incomeTaxPct },
    job: e.jobWage === undefined ? undefined : { wagePerPoint: e.jobWage },
    workers: e.workerPointsPerDay !== undefined && e.workerWage !== undefined ? { pointsPerWorkerPerDay: e.workerPointsPerDay, wagePerPoint: e.workerWage } : undefined,
    constraints: constraintsOf(input), allowReset: !input.keepCurrentSkills, topK: 3,
  };
  const r = toOptimizeRequest(state, sc);
  if (!r.ok) return fail('missing-input', 'Some required player data is unavailable.', r.missing);
  const res = optimizeBuild(r.request);
  if (!res.ok) return res.reason === 'conflict' ? fail('conflict', 'The mandatory requirements cannot all be satisfied.', res.conflicts.map((c) => c.message)) : fail(res.reason === 'unsupported' ? 'error' : res.reason, res.message);
  const builds = res.builds.map((b) => mapOptimizeBuild(b, cur, hybrid));
  let current: CurrentVM | null = null;
  const economy = r.request.economy;
  if (economy) { const d = dailyEconomy(cur as Levels, economy); current = { perHit: null, damage: null, hits: null, lossPerHit: null, economyNet: d.net, missing: d.missing }; }
  if (hybrid && current) { const gear = state.gear.value; if (gear) current.perHit = computeHit({ ...(r.request as OptimizeRequest).combat, levels: cur }).expected; }
  const used = ['econ.dailyNet', 'econ.barRegen', 'econ.pointsPerWork', 'econ.unitValue', hybrid ? 'objective.hybrid' : 'objective.maxEconomy', ...(hybrid ? res.builds.flatMap((b) => b.hit.usedFormulas) : [])];
  return { ok: true, kind: hybrid ? 'hybrid' : 'economic', objective: hybrid ? `hybrid:${input.hybrid.kind}` : 'maxEconomy', builds, current, pill: null, assumptions: res.assumptions, notes: r.notes, formulas: formulaRows(used), evidence: weakest(builds.map((b) => b.evidence) as Evidence[]), totalPoints: res.totalPoints, pointsExact: state.skillPoints.exact, estimatedGear: false, lowerBoundCost: false };
}
