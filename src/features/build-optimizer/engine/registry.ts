/**
 * Formula registry: every calculation declares its identity, evidence status and source.
 * Status order (strongest -> weakest): verified > documented > estimated > unverified.
 *  - verified:   confirmed against observed game behaviour (none yet; needs in-game fixtures)
 *  - documented: stated in the official wiki supplied with the project
 *  - estimated:  a modelling choice we made (e.g. linear interpolation between documented endpoints)
 *  - unverified: wiki is ambiguous or silent; implemented behind a configurable switch
 */
export type EvidenceStatus = 'verified' | 'documented' | 'estimated' | 'unverified';

export interface FormulaSpec {
  id: string;
  /** 'mechanic' (default): a game rule or model of one, whose status is evidence-based. 'algorithm': engine design (search, constraint folding, objective definitions) whose correctness is covered by tests, not by game evidence. */
  kind?: 'mechanic' | 'algorithm';
  version: number;
  status: EvidenceStatus;
  summary: string;
  source: string;
  inputs: string[];
  outputs: string[];
  dependsOn: string[];
  /** names of tests that cover the formula (checked by registry.test.ts) */
  tests: string[];
}

const FORMULAS = new Map<string, FormulaSpec>();
const RANK: Record<EvidenceStatus, number> = { verified: 0, documented: 1, estimated: 2, unverified: 3 };

export function defineFormula(spec: FormulaSpec): FormulaSpec {
  if (FORMULAS.has(spec.id)) throw new Error(`Formula already defined: ${spec.id}`);
  FORMULAS.set(spec.id, Object.freeze({ ...spec }));
  return spec;
}
export function getFormula(id: string): FormulaSpec {
  const f = FORMULAS.get(id);
  if (!f) throw new Error(`Unknown formula: ${id}`);
  return f;
}
export function listFormulas(): FormulaSpec[] {
  return [...FORMULAS.values()].sort((a, b) => a.id.localeCompare(b.id));
}
/** Weakest evidence among the given formulas, including their dependencies. */
export function weakestStatus(ids: string[]): EvidenceStatus {
  const seen = new Set<string>();
  let worst: EvidenceStatus = 'verified';
  const visit = (id: string) => {
    if (seen.has(id)) return;
    seen.add(id);
    const f = getFormula(id);
    if (RANK[f.status] > RANK[worst]) worst = f.status;
    f.dependsOn.forEach(visit);
  };
  ids.forEach(visit);
  return worst;
}
