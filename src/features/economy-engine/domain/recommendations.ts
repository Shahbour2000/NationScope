import type { Analysis } from "./engine";
import type { Opportunity } from "./opportunities";
import type { UpgradeRoi } from "./upgrades";

export type Severity = "good" | "info" | "warn" | "bad";
export type Rec =
  | { kind: "offer-wage"; severity: "good"; scenario: "conservative" | "balanced" | "competitive"; wage: bigint; profit: bigint }
  | { kind: "not-profitable"; severity: "bad" }
  | { kind: "switch-product"; severity: "info"; item: string; vpp: bigint; gainPct: number }
  | { kind: "automation"; severity: "good" | "info"; paybackDays: number; cost: bigint }
  | { kind: "storage"; severity: "warn"; cost: bigint | null }
  | { kind: "unsold"; severity: "warn"; unsold: number; produced: number }
  | { kind: "capital-short"; severity: "warn"; affordablePP: bigint; neededPP: bigint }
  | { kind: "no-capacity"; severity: "info" };

/** Payback at or under this many days is called "quick". It is a NationScope rule of thumb, not a game rule. */
export const QUICK_PAYBACK_DAYS = 30;
export const SWITCH_GAIN_PCT = 10;

export interface RecInput {
  analysis: Analysis;
  upgrades: readonly UpgradeRoi[];
  currentItem: string;
  currentVpp: bigint | null;
  best: Opportunity | null;
  affordablePP: bigint | null;
  neededPP: bigint;
}
export function recommend(i: RecInput): Rec[] {
  const out: Rec[] = [];
  const a = i.analysis;
  if (!a.ok) return out;
  if (i.neededPP <= 0n) out.push({ kind: "no-capacity", severity: "info" });
  const viable = a.outcomes.filter((o) => o.rec.viable && o.plan.profit > 0n);
  const pick = viable.find((o) => o.rec.id === "balanced") ?? viable[0];
  if (pick) out.push({ kind: "offer-wage", severity: "good", scenario: pick.rec.id, wage: pick.rec.wage, profit: pick.plan.profit });
  else if (i.neededPP > 0n) out.push({ kind: "not-profitable", severity: "bad" });
  const first = a.outcomes[0];
  if (first && first.plan.unitsUnsold > 0) out.push({ kind: "unsold", severity: "warn", unsold: first.plan.unitsUnsold, produced: first.plan.unitsAfterProductionTax });
  if (i.affordablePP !== null && i.affordablePP < i.neededPP) out.push({ kind: "capital-short", severity: "warn", affordablePP: i.affordablePP, neededPP: i.neededPP });
  if (i.best && i.best.item !== i.currentItem && i.best.vppInstant !== null && i.currentVpp !== null && i.currentVpp > 0n) {
    const gain = Number(((i.best.vppInstant - i.currentVpp) * 10000n) / i.currentVpp) / 100;
    if (gain >= SWITCH_GAIN_PCT) out.push({ kind: "switch-product", severity: "info", item: i.best.item, vpp: i.best.vppInstant, gainPct: gain });
  } else if (i.best && i.best.item !== i.currentItem && i.best.vppInstant !== null && i.currentVpp !== null && i.currentVpp <= 0n && i.best.vppInstant > 0n) {
    out.push({ kind: "switch-product", severity: "info", item: i.best.item, vpp: i.best.vppInstant, gainPct: Number.POSITIVE_INFINITY });
  }
  const eng = i.upgrades.find((u) => u.code === "automatedEngine" && u.paybackDays !== null && u.cost !== null);
  if (eng && eng.paybackDays !== null && eng.cost !== null) out.push({ kind: "automation", severity: eng.paybackDays <= QUICK_PAYBACK_DAYS ? "good" : "info", paybackDays: eng.paybackDays, cost: eng.cost });
  const st = i.upgrades.find((u) => u.code === "storage" && u.binding === true);
  if (st) out.push({ kind: "storage", severity: "warn", cost: st.cost });
  return out;
}
