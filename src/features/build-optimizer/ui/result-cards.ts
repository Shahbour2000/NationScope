import { cumulativeCost, type SkillId } from '../engine/skills';
import type { BuildVM, ResultOk } from '../view-model';

/**
 * Pure data mapping for the result cards and the Before / After matrix. Everything here is read from the engine response (`ResultOk`)
 * or derived from it by subtraction; nothing is estimated. A value is `null` (shown as an em dash, never 0) whenever the engine did not
 * return the "before" side. What the engine returns as "current": per-hit damage, damage over the same hits (or the sustainable
 * session), sustainable hits, health lost per hit, and the daily economic net, all computed for the player's CURRENT skills and gear.
 * It does NOT return a current cost, current gear rows or current food use, so those rows have no Before value.
 */
export type MetricId = 'perHit' | 'damage' | 'sustainHits' | 'lossPerHit' | 'dailyNet' | 'points' | 'totalCost';
export interface MetricDef { id: MetricId; digits: number; money: boolean; better: 'higher' | 'lower' | 'none' }
const DEFS: Record<MetricId, MetricDef> = {
  perHit: { id: 'perHit', digits: 1, money: false, better: 'higher' },
  damage: { id: 'damage', digits: 0, money: false, better: 'higher' },
  sustainHits: { id: 'sustainHits', digits: 0, money: false, better: 'higher' },
  lossPerHit: { id: 'lossPerHit', digits: 2, money: false, better: 'lower' },
  dailyNet: { id: 'dailyNet', digits: 0, money: true, better: 'higher' },
  points: { id: 'points', digits: 0, money: false, better: 'none' },
  totalCost: { id: 'totalCost', digits: 0, money: true, better: 'lower' },
};
export interface Cell { value: number | null; lowerBound?: boolean }
export interface MatrixRow { def: MetricDef; before: Cell; after: Cell[]; bestIndex: number | null }

const num = (v: number | null | undefined): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** Points the CURRENT skill levels cost (cumulative skill-point cost of each level); null when any current level is unknown. */
export function currentPointsSpent(b: BuildVM): number | null {
  let sum = 0; for (const s of b.skills) { if (s.current === null) return null; sum += cumulativeCost(s.current); } return sum;
}

/** Metric values for one build, in display order. `before` is null when the engine did not provide the current counterpart. */
function valuesOf(res: ResultOk, b: BuildVM): { id: MetricId; before: Cell; after: Cell }[] {
  const cur = res.current; const out: { id: MetricId; before: Cell; after: Cell }[] = [];
  const add = (id: MetricId, before: number | null | undefined, after: number | null | undefined, lowerBound?: boolean) => { const a = num(after); if (a !== null) out.push({ id, before: { value: num(before) }, after: { value: a, lowerBound } }); };
  if (b.session) { add('damage', cur?.damage, b.session.damage); add('sustainHits', cur?.hits, b.session.hits); add('perHit', cur?.perHit, b.session.perHit); add('lossPerHit', cur?.lossPerHit, b.session.lossPerHit); }
  else if (b.combat && res.kind === 'hybrid') add('perHit', cur?.perHit, b.combat.perHit); // hybrid: the engine returns a current per-hit and a current daily net only
  else if (b.combat) { add('damage', cur?.damage, b.combat.damage); add('perHit', cur?.perHit, b.combat.perHit); add('lossPerHit', cur?.lossPerHit, b.combat.lossPerHit); }
  if (b.economy) add('dailyNet', cur?.economyNet, b.economy.net);
  add('points', currentPointsSpent(b), b.pointsSpent);
  if (b.cost) add('totalCost', null, b.cost.total, b.cost.lowerBound);
  return out;
}

/** The Before / After matrix: one row per metric, one "after" cell per build. Rows keep the order of the first build; a build lacking a metric gets an empty cell. */
export function comparisonMatrix(res: ResultOk): MatrixRow[] {
  const per = res.builds.map((b) => valuesOf(res, b));
  const ids: MetricId[] = []; for (const list of per) for (const v of list) if (!ids.includes(v.id)) ids.push(v.id);
  return ids.map((id) => {
    const def = DEFS[id]; const found = per.map((l) => l.find((v) => v.id === id));
    const before = found.find((f) => f && f.before.value !== null)?.before ?? { value: null };
    const after = found.map((f) => f?.after ?? { value: null });
    let bestIndex: number | null = null;
    if (def.better !== 'none' && after.filter((c) => c.value !== null).length > 1) {
      const vals = after.map((c) => c.value); const target = def.better === 'higher' ? Math.max(...(vals.filter((v) => v !== null) as number[])) : Math.min(...(vals.filter((v) => v !== null) as number[]));
      const idx = vals.indexOf(target); if (vals.filter((v) => v === target).length === 1) bestIndex = idx; // ties get no badge
    }
    return { def, before, after, bestIndex };
  });
}

export type Tone = 'good' | 'bad' | 'neutral';
/** Change from before to after. Null when either side is unknown. `pct` only when before is positive (a percentage of a zero or negative base is meaningless). */
export function deltaOf(def: MetricDef, before: number | null, after: number | null): { delta: number; pct: number | null; tone: Tone } | null {
  if (before === null || after === null) return null;
  const delta = after - before; const eps = 10 ** -(def.digits + 1);
  const tone: Tone = Math.abs(delta) < eps || def.better === 'none' ? 'neutral' : (delta > 0) === (def.better === 'higher') ? 'good' : 'bad';
  return { delta, pct: before > 0 ? (delta / before) * 100 : null, tone };
}

export interface SkillChange { id: SkillId; group: 'war' | 'economic'; from: number; to: number }
export interface SkillSummary { changed: SkillChange[]; unchanged: number; unknownCurrent: number }
/** Skills whose proposed level differs from the current level. Skills with an unknown current level cannot be compared and are counted separately. */
export function skillSummary(b: BuildVM): SkillSummary {
  const changed: SkillChange[] = []; let unchanged = 0, unknownCurrent = 0;
  for (const s of b.skills) { if (s.current === null) unknownCurrent++; else if (s.current !== s.proposed) changed.push({ id: s.id, group: s.group, from: s.current, to: s.proposed }); else unchanged++; }
  return { changed, unchanged, unknownCurrent };
}

export interface GearSummary { owned: number; toBuy: number; empty: number; estimated: number }
/** Gear rows only say whether an item is one you own/wear or a market purchase; the engine does not return the current item per slot. */
export function gearSummary(b: BuildVM): GearSummary | null {
  if (!b.gear) return null; const g: GearSummary = { owned: 0, toBuy: 0, empty: 0, estimated: 0 };
  for (const r of b.gear) { if (r.id === null) g.empty++; else if (r.owned) g.owned++; else g.toBuy++; if (r.estimated) g.estimated++; }
  return g;
}

/** The headline metric of a card (what the goal is about), taken from the same cell list the matrix uses. */
export function headlineId(b: BuildVM): MetricId | null { return b.economy ? 'dailyNet' : b.session || b.combat ? 'damage' : null; }
