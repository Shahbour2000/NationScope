import { PlannerInputError } from "./skills";

/**
 * Hit-damage pipeline. The STAGE ORDER below was confirmed by the game developer (Battles wiki page):
 * attack, personal boosts, precision and graze, critical, luck spread, battle bonuses, bonus caps.
 * The per-stage FORMULAS are not encoded here: none has been read from an official source yet, so every
 * stage must be supplied explicitly and reports either "verified" (with its source) or "unverified".
 * A result is only "exact" when every stage is verified; otherwise it is "incomplete" and names what is missing.
 */
export const DAMAGE_STAGES = ["attack", "personalBoosts", "precisionGraze", "critical", "luckSpread", "battleBonuses", "bonusCaps"] as const;
export type StageId = (typeof DAMAGE_STAGES)[number];

export type StageOutcome<S> =
  | { status: "verified"; state: S; /** Where the rule was read from (page/endpoint). */ source: string }
  | { status: "unverified"; missing: string[] };

export interface Stage<S, C> {
  id: StageId;
  run: (state: S, ctx: C) => StageOutcome<S>;
}

export type PipelineResult<S> =
  | { status: "exact"; state: S; sources: Record<StageId, string> }
  | { status: "incomplete"; partial: S; verifiedStages: StageId[]; blocked: { stage: StageId; missing: string[] }; notEvaluated: StageId[] };

/** A stage whose formula is not yet known. Keeps the pipeline honest instead of guessing. */
export function unverifiedStage<S, C>(id: StageId, missing: string[]): Stage<S, C> {
  return { id, run: () => ({ status: "unverified", missing }) };
}

export function runDamagePipeline<S, C>(stages: readonly Stage<S, C>[], initial: S, ctx: C): PipelineResult<S> {
  if (stages.length !== DAMAGE_STAGES.length || stages.some((s, i) => s.id !== DAMAGE_STAGES[i])) {
    throw new PlannerInputError(`Stages must be exactly, in order: ${DAMAGE_STAGES.join(", ")}.`);
  }
  let state = initial;
  const verified: StageId[] = [];
  const sources: Partial<Record<StageId, string>> = {};
  for (let i = 0; i < stages.length; i++) {
    const stage = stages[i]!;
    const out = stage.run(state, ctx);
    if (out.status === "unverified") {
      return { status: "incomplete", partial: state, verifiedStages: verified, blocked: { stage: stage.id, missing: out.missing }, notEvaluated: DAMAGE_STAGES.slice(i + 1) };
    }
    state = out.state;
    verified.push(stage.id);
    sources[stage.id] = out.source;
  }
  return { status: "exact", state, sources: sources as Record<StageId, string> };
}
