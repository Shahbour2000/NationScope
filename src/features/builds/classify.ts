/**
 * PROVISIONAL player build classification (War / Eco / Hybrid) from the `skills` array of GET /players/{id}.
 * Skill fields are verified (code, level, maxLevel). The skill -> category mapping and ALL thresholds below are a proposal, NOT official game rules.
 * Nothing but skills is used: no damage, equipment, badges, jobs, companies or trade volume.
 */
export type BuildKind = "war" | "eco" | "hybrid" | "unclassified" | "insufficient";

export const BUILD_RULES = {
  /** Provisional mapping (user-supplied; not confirmed by the API or game documentation). */
  war: ["attack", "criticalChance", "criticalDamages", "armor", "precision", "dodge", "health", "lootChance"],
  eco: ["production", "entrepreneurship", "companies", "management"],
  /** Shared/supporting skills are NOT scored, so they can never be double-counted. */
  shared: ["energy", "stamina", "hunger"],
  dominantScore: 60,
  dominantMargin: 15,
  hybridMinScore: 50,
  hybridMaxGap: 15,
  /** Design decision (not from the brief): need at least half of each category's skills to have valid data, else "insufficient". */
  minEligibleWar: 4,
  minEligibleEco: 2,
} as const;

export interface BuildResult {
  kind: BuildKind;
  /** Mean of level / maxLevel * 100 over eligible skills of the category, rounded to 2 decimals; null if none eligible. */
  warScore: number | null;
  ecoScore: number | null;
  warEligible: number;
  ecoEligible: number;
}

const r2 = (n: number): number => Math.round(n * 100) / 100;

/** A skill counts only if code is a string, maxLevel is a finite number > 0 and 0 <= level <= maxLevel. The first entry per code wins. */
function eligibleProgress(skills: unknown): Map<string, number> {
  const out = new Map<string, number>();
  if (!Array.isArray(skills)) return out;
  for (const s of skills) {
    if (typeof s !== "object" || s === null) continue;
    const { code, level, maxLevel } = s as Record<string, unknown>;
    if (typeof code !== "string" || out.has(code)) continue;
    if (typeof level !== "number" || typeof maxLevel !== "number" || !Number.isFinite(level) || !Number.isFinite(maxLevel) || maxLevel <= 0 || level < 0 || level > maxLevel) continue;
    out.set(code, (level / maxLevel) * 100);
  }
  return out;
}

function score(progress: Map<string, number>, codes: readonly string[]): { score: number | null; n: number } {
  const v = codes.map((c) => progress.get(c)).filter((x): x is number => x !== undefined);
  return { score: v.length ? r2(v.reduce((a, b) => a + b, 0) / v.length) : null, n: v.length };
}

/**
 * Evaluation order (first match wins, rules are mutually exclusive):
 * 1 insufficient data -> 2 War -> 3 Eco -> 4 Hybrid -> 5 Unclassified.
 * War:    war >= 60 and war - eco >= 15      Eco:    eco >= 60 and eco - war >= 15
 * Hybrid: war >= 50 and eco >= 50 and |war - eco| < 15
 * Scores are rounded to 2 decimals before comparison, so a difference of exactly 15.00 counts as War/Eco, never Hybrid.
 */
export function classifyBuild(skills: unknown): BuildResult {
  const p = eligibleProgress(skills);
  const w = score(p, BUILD_RULES.war), e = score(p, BUILD_RULES.eco);
  const base = { warScore: w.score, ecoScore: e.score, warEligible: w.n, ecoEligible: e.n };
  if (w.score === null || e.score === null || w.n < BUILD_RULES.minEligibleWar || e.n < BUILD_RULES.minEligibleEco) return { kind: "insufficient", ...base };
  const diff = r2(w.score - e.score);
  if (w.score >= BUILD_RULES.dominantScore && diff >= BUILD_RULES.dominantMargin) return { kind: "war", ...base };
  if (e.score >= BUILD_RULES.dominantScore && -diff >= BUILD_RULES.dominantMargin) return { kind: "eco", ...base };
  if (w.score >= BUILD_RULES.hybridMinScore && e.score >= BUILD_RULES.hybridMinScore && Math.abs(diff) < BUILD_RULES.hybridMaxGap) return { kind: "hybrid", ...base };
  return { kind: "unclassified", ...base };
}

export interface BuildCounts { total: number; war: number; eco: number; hybrid: number; unclassified: number; insufficient: number; unknown: number }

/** Counts UNIQUE player ids. Ids without a result (profile not loaded or request failed) are `unknown`, never counted as a build or as zero skills. */
export function summarizeBuilds(ids: readonly string[], results: ReadonlyMap<string, BuildResult>): BuildCounts {
  const c: BuildCounts = { total: 0, war: 0, eco: 0, hybrid: 0, unclassified: 0, insufficient: 0, unknown: 0 };
  for (const id of new Set(ids)) {
    c.total++;
    const r = results.get(id);
    if (!r) c.unknown++; else c[r.kind]++;
  }
  return c;
}
