import { MONEY_SCALE } from "@/lib/money";
import { PlannerInputError } from "./skills";

/**
 * Equipment selection by exact Pareto frontier over (cost, score), one item per slot.
 * `score` must be ADDITIVE across slots. A ruleset whose effects are not additive must not use this
 * (or must pre-compute marginal scores); that is a modelling decision outside this module.
 */
export interface Item {
  id: string;
  slot: string;
  /** Money in 1/10,000 gold units, exact. */
  cost: bigint;
  score: number;
  owned?: boolean;
}

export interface Loadout {
  picks: Readonly<Record<string, Item | null>>;
  /** Effective cost: owned items count as 0 when ownedFree is on. */
  cost: bigint;
  score: number;
}

export interface SelectInput {
  items: readonly Item[];
  /** Slots to fill. Defaults to every slot present in `items`. */
  slots?: readonly string[];
  budget?: bigint;
  ownedOnly?: boolean;
  /** Owned items cost nothing to use (default true). */
  ownedFree?: boolean;
  /** Best Value only considers loadouts reaching this share of the max score (default 0.8). */
  minPerformanceShare?: number;
  /** Safety cap on frontier size; exceeding it sets exact=false (default 20,000). */
  maxFrontier?: number;
}

export interface SelectResult {
  /** Highest score within budget; lowest cost among ties. */
  maxPerformance: Loadout | null;
  /** Best score-per-gold among loadouts reaching minPerformanceShare of max (free loadouts win outright). */
  bestValue: Loadout | null;
  /** Every non-dominated loadout, cost ascending. This is the trade-off curve. */
  frontier: Loadout[];
  exact: boolean;
}

export function selectEquipment(input: SelectInput): SelectResult {
  const ownedFree = input.ownedFree ?? true;
  const share = input.minPerformanceShare ?? 0.8;
  const maxFrontier = input.maxFrontier ?? 20_000;
  if (share < 0 || share > 1) throw new PlannerInputError("minPerformanceShare must be 0..1.");
  if (input.budget !== undefined && input.budget < 0n) throw new PlannerInputError("budget must not be negative.");

  const eff = (i: Item): bigint => (i.owned && ownedFree ? 0n : i.cost);
  const pool = input.items.filter((i) => !input.ownedOnly || i.owned);
  for (const i of pool) {
    if (i.cost < 0n) throw new PlannerInputError(`Item ${i.id} has a negative cost.`);
    if (!Number.isFinite(i.score)) throw new PlannerInputError(`Item ${i.id} has a non-finite score.`);
  }
  const slots = input.slots ?? [...new Set(input.items.map((i) => i.slot))];
  const bySlot = new Map<string, Item[]>(slots.map((s) => [s, pool.filter((i) => i.slot === s)]));

  let exact = true;
  let states: Loadout[] = [{ picks: {}, cost: 0n, score: 0 }];
  for (const slot of slots) {
    const options: (Item | null)[] = [null, ...(bySlot.get(slot) ?? [])];
    const next: Loadout[] = [];
    for (const st of states) {
      for (const opt of options) {
        const cost = st.cost + (opt ? eff(opt) : 0n);
        if (input.budget !== undefined && cost > input.budget) continue;
        next.push({ picks: { ...st.picks, [slot]: opt }, cost, score: st.score + (opt ? opt.score : 0) });
      }
    }
    next.sort((a, b) => (a.cost < b.cost ? -1 : a.cost > b.cost ? 1 : b.score - a.score));
    const kept: Loadout[] = [];
    let best = -Infinity;
    for (const l of next) {
      if (l.score > best) { kept.push(l); best = l.score; }
    }
    if (kept.length > maxFrontier) {
      exact = false;
      const step = Math.ceil(kept.length / maxFrontier);
      states = kept.filter((_, idx) => idx % step === 0 || idx === kept.length - 1);
    } else {
      states = kept;
    }
  }

  const frontier = states;
  const maxPerformance = frontier.length ? frontier[frontier.length - 1]! : null;
  let bestValue: Loadout | null = null;
  if (maxPerformance) {
    const threshold = maxPerformance.score * share;
    const eligible = frontier.filter((l) => l.score >= threshold);
    const free = eligible.filter((l) => l.cost === 0n);
    if (free.length) {
      bestValue = free.reduce((a, b) => (b.score > a.score ? b : a));
    } else {
      bestValue = eligible.reduce((a, b) => (scorePerGold(b)! > scorePerGold(a)! ? b : a));
    }
  }
  return { maxPerformance, bestValue, frontier, exact };
}

/** Score per whole gold spent; null when the loadout costs nothing. Display-only (float). */
export function scorePerGold(l: Loadout): number | null {
  return l.cost === 0n ? null : l.score / (Number(l.cost) / Number(MONEY_SCALE));
}
