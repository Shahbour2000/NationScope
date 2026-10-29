/**
 * NationScope's analytical build classification (War / Eco / Hybrid) from the `skills` array of GET /players/{id}.
 * Verified API fields: code, level, maxLevel. The skill -> category mapping is a PROVISIONAL proposal (the game documents no mapping), and the
 * result is NOT an official in-game rating. Pure module: no I/O, no React.
 *
 * Method (see docs/build-classification.md):
 *   fill(category)  = sum(level) / sum(maxLevel) over the category's valid skills      (how much of that category's capacity is used)
 *   warShare        = fill(war) / (fill(war) + fill(eco)) * 100                         (share of the player's relevant investment)
 *   War  if warShare >= 70      Eco if ecoShare >= 70      otherwise Hybrid
 * Shares always add up to 100, so at most one side can reach the threshold and every classifiable player gets exactly one of the three kinds.
 */
export type BuildKind = "war" | "eco" | "hybrid";

/** Why a result has no kind. These are data states, NOT build categories. */
export type BuildAvailability = "ok" | "no_investment" | "incomplete";

export const BUILD_RULES = {
  /** Provisional mapping (user-supplied; not confirmed by the API or game documentation). */
  war: ["attack", "criticalChance", "criticalDamages", "armor", "precision", "dodge", "health", "lootChance"],
  eco: ["production", "entrepreneurship", "companies", "management"],
  /** Shared/supporting skills are neutral: never scored, so they can never be double-counted. */
  shared: ["energy", "stamina", "hunger"],
  /** A side needs at least this percentage of the relevant investment to be War / Eco. Inclusive. */
  dominancePct: 70,
  /** Design decision: at least half of each category's skills must carry valid data, else the data is `incomplete`. */
  minEligibleWar: 4,
  minEligibleEco: 2,
} as const;

export interface BuildResult {
  /** null exactly when `availability` is not "ok". */
  kind: BuildKind | null;
  availability: BuildAvailability;
  /** Percent of the relevant investment (capacity-normalised) that is combat / economic; 2 decimals, sum to 100. null unless availability is "ok". */
  warShare: number | null;
  ecoShare: number | null;
  /** Percent of each category's maximum capacity that is filled (0-100, 2 decimals). null when the category has no valid skills. */
  warFill: number | null;
  ecoFill: number | null;
  /** Raw observed levels and capacities of the valid skills (what the fills are computed from). */
  warLevels: number;
  ecoLevels: number;
  warCapacity: number;
  ecoCapacity: number;
  warEligible: number;
  ecoEligible: number;
}

const r2 = (n: number): number => Math.round(n * 100) / 100;
const EPS = 1e-9;

interface Valid { level: number; maxLevel: number }

/** A skill counts only if code is a string, maxLevel is a finite number > 0 and 0 <= level <= maxLevel. The first entry per code wins. */
function validSkills(skills: unknown): Map<string, Valid> {
  const out = new Map<string, Valid>();
  if (!Array.isArray(skills)) return out;
  for (const s of skills) {
    if (typeof s !== "object" || s === null) continue;
    const { code, level, maxLevel } = s as Record<string, unknown>;
    if (typeof code !== "string" || out.has(code)) continue;
    if (typeof level !== "number" || typeof maxLevel !== "number" || !Number.isFinite(level) || !Number.isFinite(maxLevel) || maxLevel <= 0 || level < 0 || level > maxLevel) continue;
    out.set(code, { level, maxLevel });
  }
  return out;
}

function sum(valid: Map<string, Valid>, codes: readonly string[]) {
  let levels = 0, capacity = 0, n = 0;
  for (const c of codes) { const v = valid.get(c); if (v) { levels += v.level; capacity += v.maxLevel; n++; } }
  return { levels, capacity, n };
}

export function classifyBuild(skills: unknown): BuildResult {
  const valid = validSkills(skills);
  const w = sum(valid, BUILD_RULES.war), e = sum(valid, BUILD_RULES.eco);
  const base = {
    warFill: w.capacity > 0 ? r2((w.levels / w.capacity) * 100) : null, ecoFill: e.capacity > 0 ? r2((e.levels / e.capacity) * 100) : null,
    warLevels: w.levels, ecoLevels: e.levels, warCapacity: w.capacity, ecoCapacity: e.capacity, warEligible: w.n, ecoEligible: e.n,
  };
  const none = { kind: null, warShare: null, ecoShare: null };
  if (w.n < BUILD_RULES.minEligibleWar || e.n < BUILD_RULES.minEligibleEco) return { ...none, availability: "incomplete", ...base };
  // share = fill_w / (fill_w + fill_e) = W*Ce / (W*Ce + E*Cw): cross-multiplied so no division happens before the comparison (exact for integer levels).
  const wTerm = w.levels * e.capacity, eTerm = e.levels * w.capacity, total = wTerm + eTerm;
  if (total <= 0) return { ...none, availability: "no_investment", ...base };
  const warShare = r2((wTerm / total) * 100), ecoShare = r2(100 - warShare);
  const need = BUILD_RULES.dominancePct;
  const kind: BuildKind = wTerm * 100 + EPS >= need * total ? "war" : eTerm * 100 + EPS >= need * total ? "eco" : "hybrid";
  return { kind, availability: "ok", warShare, ecoShare, ...base };
}

/**
 * Group counts over UNIQUE player ids.
 *  - war / eco / hybrid: classified players.
 *  - pending: profile not loaded yet (request cap / not requested) - will fill in on later visits.
 *  - unavailable: profile failed, or its skill data cannot support a classification (incomplete data or no invested points).
 * These two are data states, never build types. classified = war + eco + hybrid; total = classified + pending + unavailable.
 */
export interface BuildCounts { total: number; war: number; eco: number; hybrid: number; classified: number; pending: number; unavailable: number }

export function summarizeBuilds(ids: readonly string[], results: ReadonlyMap<string, BuildResult | null>): BuildCounts {
  const c: BuildCounts = { total: 0, war: 0, eco: 0, hybrid: 0, classified: 0, pending: 0, unavailable: 0 };
  for (const id of new Set(ids)) {
    c.total++;
    if (!results.has(id)) { c.pending++; continue; }
    const r = results.get(id);
    if (!r || r.kind === null) { c.unavailable++; continue; }
    c[r.kind]++; c.classified++;
  }
  return c;
}
