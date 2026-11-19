import { grossForNet } from "./economics";
import { BP, floorDiv } from "./fixed";

export type ScenarioId = "conservative" | "balanced" | "competitive";
/** Approved scenario definitions: anchor percentile of competing NET wages per PP, and cap as a share of the break-even wage. */
export const SCENARIO_DEFS: Readonly<Record<ScenarioId, { percentile: number; capPct: number }>> = {
  conservative: { percentile: 25, capPct: 60 },
  balanced: { percentile: 50, capPct: 75 },
  competitive: { percentile: 75, capPct: 90 },
};
export const SCENARIO_ORDER: readonly ScenarioId[] = ["conservative", "balanced", "competitive"];

/** Nearest-rank percentile of an ascending list. Null for an empty list. */
export function percentile(sortedAsc: readonly bigint[], p: number): bigint | null {
  if (sortedAsc.length === 0) return null;
  const idx = Math.min(sortedAsc.length - 1, Math.max(0, Math.ceil((p / 100) * sortedAsc.length) - 1));
  return sortedAsc[idx]!;
}

export type Binding = "market" | "profit-cap" | "legal-max" | "legal-min" | "no-market-data";
export type Reason =
  | { code: "anchor"; percentile: number }
  | { code: "capped"; capPct: number }
  | { code: "legal-max" }
  | { code: "legal-min" }
  | { code: "no-offers" }
  | { code: "not-profitable" }
  | { code: "below-legal-min" };

export interface AllowedWage { min: bigint; max: bigint; median: bigint }
export interface WageInput {
  /** Net-per-point of currently open competing offers (any product: workers can choose any company). */
  offersNet: readonly bigint[];
  incomeBp: bigint;
  /** Gross break-even wage per PP (value per PP). */
  breakEven: bigint;
  allowed: AllowedWage | null;
  capPctOverride?: Partial<Record<ScenarioId, number>>;
}
export interface WageRecommendation {
  id: ScenarioId;
  /** Percentile anchor in net/PP (null when no offers). */
  anchorNet: bigint | null;
  anchorGross: bigint | null;
  capGross: bigint;
  /** Recommended gross wage per PP. */
  wage: bigint;
  binding: Binding;
  /** false when even the lowest legal wage exceeds the profit cap (or the product has no positive value). */
  viable: boolean;
  reasons: Reason[];
}

export function recommendWage(id: ScenarioId, i: WageInput): WageRecommendation {
  const def = SCENARIO_DEFS[id];
  const capPct = i.capPctOverride?.[id] ?? def.capPct;
  const sorted = [...i.offersNet].sort((a, b) => (a === b ? 0 : a < b ? -1 : 1));
  const anchorNet = percentile(sorted, def.percentile);
  const anchorGross = anchorNet === null ? null : grossForNet(anchorNet, i.incomeBp);
  const capGross = i.breakEven > 0n ? floorDiv(i.breakEven * BigInt(Math.round(capPct * 100)), BP) : 0n;
  const reasons: Reason[] = [];
  let wage: bigint, binding: Binding;
  if (anchorGross === null) { wage = capGross; binding = "no-market-data"; reasons.push({ code: "no-offers" }); }
  else if (anchorGross <= capGross) { wage = anchorGross; binding = "market"; reasons.push({ code: "anchor", percentile: def.percentile }); }
  else { wage = capGross; binding = "profit-cap"; reasons.push({ code: "anchor", percentile: def.percentile }, { code: "capped", capPct }); }
  let viable = i.breakEven > 0n;
  if (!viable) reasons.push({ code: "not-profitable" });
  if (i.allowed) {
    if (wage > i.allowed.max) { wage = i.allowed.max; binding = "legal-max"; reasons.push({ code: "legal-max" }); }
    if (wage < i.allowed.min) {
      if (capGross < i.allowed.min) { viable = false; reasons.push({ code: "below-legal-min" }); }
      wage = i.allowed.min; binding = "legal-min"; reasons.push({ code: "legal-min" });
    }
  }
  return { id, anchorNet, anchorGross, capGross, wage, binding, viable, reasons };
}
export function recommendAll(i: WageInput): WageRecommendation[] { return SCENARIO_ORDER.map((id) => recommendWage(id, i)); }
