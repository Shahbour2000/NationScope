/**
 * Evidence gate for game formulas. A candidate formula is NEVER "verified" because it looks plausible:
 * it must reproduce observed results across a controlled, varied sample. The planner should label any
 * output with the confidence returned here and refuse "optimal" claims below "verified".
 */
export interface Observation {
  /** Everything that could influence the result (levels, gear stats, energy, ...). */
  inputs: Readonly<Record<string, number>>;
  /** What the game actually produced (for example one hit's damage). */
  observed: number;
}

export interface CandidateFormula {
  id: string;
  description: string;
  predict: (inputs: Readonly<Record<string, number>>) => number;
}

export type Confidence = "unsupported" | "weak" | "estimate" | "verified";

export interface FormulaAssessment {
  id: string;
  samples: number;
  /** Observations reproduced within `tolerance`. */
  matches: number;
  maxAbsError: number;
  maxRelError: number;
  distinctValuesPerInput: Record<string, number>;
  confidence: Confidence;
  reasons: string[];
}

export interface AssessOptions {
  /** Absolute tolerance for an exact match (default 0.5: correct after integer rounding). */
  tolerance?: number;
  minSamples?: number;
  /** Each input named in `variedInputs` must take at least this many distinct values. */
  minDistinct?: number;
  /** Inputs the formula claims to depend on; defaults to all inputs seen. */
  variedInputs?: readonly string[];
  /** Relative error ceiling for "estimate" (default 0.05). */
  estimateRelError?: number;
}

export function assessFormula(f: CandidateFormula, obs: readonly Observation[], o: AssessOptions = {}): FormulaAssessment {
  const tolerance = o.tolerance ?? 0.5;
  const minSamples = o.minSamples ?? 30;
  const minDistinct = o.minDistinct ?? 3;
  const estimateRel = o.estimateRelError ?? 0.05;

  const names = o.variedInputs ?? [...new Set(obs.flatMap((x) => Object.keys(x.inputs)))];
  const distinct: Record<string, number> = {};
  for (const n of names) distinct[n] = new Set(obs.map((x) => x.inputs[n])).size;

  let matches = 0, maxAbs = 0, maxRel = 0;
  for (const x of obs) {
    const p = f.predict(x.inputs);
    if (!Number.isFinite(p) || !Number.isFinite(x.observed)) {
      maxAbs = Infinity; maxRel = Infinity;
      continue;
    }
    const abs = Math.abs(p - x.observed);
    const rel = x.observed === 0 ? (abs === 0 ? 0 : Infinity) : abs / Math.abs(x.observed);
    if (abs <= tolerance) matches++;
    maxAbs = Math.max(maxAbs, abs);
    maxRel = Math.max(maxRel, rel);
  }

  const reasons: string[] = [];
  const n = obs.length;
  const allMatch = n > 0 && matches === n;
  const lowVariety = names.filter((k) => (distinct[k] ?? 0) < minDistinct);
  if (n < minSamples) reasons.push(`Only ${n} samples; verification needs at least ${minSamples}.`);
  if (lowVariety.length) reasons.push(`Not enough variation in: ${lowVariety.join(", ")} (need ${minDistinct}+ distinct values each).`);
  if (!allMatch && n > 0) reasons.push(`${n - matches} of ${n} observations are not reproduced (max abs error ${maxAbs}).`);

  let confidence: Confidence;
  if (n < 3) confidence = "unsupported";
  else if (allMatch && n >= minSamples && lowVariety.length === 0) confidence = "verified";
  else if (maxRel <= estimateRel && n >= 10) confidence = "estimate";
  else if (allMatch) confidence = "weak"; // fits, but evidence too thin or too uniform to trust
  else confidence = "weak";
  if (maxRel === Infinity && !allMatch) confidence = n < 3 ? "unsupported" : "weak";

  return { id: f.id, samples: n, matches, maxAbsError: maxAbs, maxRelError: maxRel, distinctValuesPerInput: distinct, confidence, reasons };
}

/** Rank candidates: higher confidence first, then fewer mismatches, then smaller error. */
export function rankFormulas(fs: readonly CandidateFormula[], obs: readonly Observation[], o?: AssessOptions): FormulaAssessment[] {
  const order: Record<Confidence, number> = { verified: 3, estimate: 2, weak: 1, unsupported: 0 };
  return fs
    .map((f) => assessFormula(f, obs, o))
    .sort((a, b) => order[b.confidence] - order[a.confidence] || (b.matches - a.matches) || a.maxRelError - b.maxRelError);
}

export interface ControlledPair {
  from: Observation;
  to: Observation;
  /** Change in the isolated input; every other input is identical in both observations. */
  deltaInput: number;
  deltaObserved: number;
}

/** Controlled comparison: pairs of observations that differ ONLY in `input`. */
export function controlledPairs(obs: readonly Observation[], input: string): ControlledPair[] {
  const groups = new Map<string, Observation[]>();
  for (const x of obs) {
    if (!(input in x.inputs)) continue;
    const rest = Object.keys(x.inputs).filter((k) => k !== input).sort().map((k) => `${k}=${x.inputs[k]}`).join("|");
    const g = groups.get(rest);
    if (g) g.push(x); else groups.set(rest, [x]);
  }
  const out: ControlledPair[] = [];
  for (const g of groups.values()) {
    const sorted = [...g].sort((a, b) => a.inputs[input]! - b.inputs[input]!);
    for (let i = 1; i < sorted.length; i++) {
      const a = sorted[i - 1]!, b = sorted[i]!;
      if (a.inputs[input] === b.inputs[input]) continue;
      out.push({ from: a, to: b, deltaInput: b.inputs[input]! - a.inputs[input]!, deltaObserved: b.observed - a.observed });
    }
  }
  return out;
}

/** Marginal effect per unit of `input` from controlled pairs; `constant` means every pair agrees (a linear effect). */
export function marginalEffect(obs: readonly Observation[], input: string): { pairs: number; perUnit: number[]; constant: boolean } {
  const perUnit = controlledPairs(obs, input).map((p) => p.deltaObserved / p.deltaInput);
  const constant = perUnit.length > 0 && perUnit.every((v) => Math.abs(v - perUnit[0]!) < 1e-9);
  return { pairs: perUnit.length, perUnit, constant };
}
