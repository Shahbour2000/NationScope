import type { Evidence } from "./evidence";

export interface SkillRow { code: string; level: number; maxLevel: number }
export interface SkillRead { rows: SkillRow[]; issues: string[] }

const rec = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

/**
 * Reads `skills: [{code, level, maxLevel}]` from a /players/{id} (or /players/by-name/{username}) response.
 * Independent from the Build Optimizer's parser on purpose. Rows that are not valid are reported and skipped;
 * a code that appears twice with different levels is treated as unknown (never "first row wins").
 */
export function readSkills(raw: unknown): SkillRead {
  const root = rec(raw);
  const list = Array.isArray(root.skills) ? root.skills : Array.isArray(rec(root.player).skills) ? (rec(root.player).skills as unknown[]) : null;
  if (!list) return { rows: [], issues: ["no-skills-array"] };
  const seen = new Map<string, SkillRow | null>(); const issues: string[] = [];
  for (const x of list) {
    const o = rec(x);
    if (typeof o.code !== "string" || !o.code || typeof o.level !== "number" || !Number.isInteger(o.level) || o.level < 0 || o.level > 100) { issues.push("invalid-row"); continue; }
    const maxLevel = typeof o.maxLevel === "number" && Number.isInteger(o.maxLevel) && o.maxLevel >= 0 ? o.maxLevel : 10;
    const prev = seen.get(o.code);
    if (prev === undefined) seen.set(o.code, { code: o.code, level: o.level, maxLevel });
    else if (prev === null || prev.level !== o.level) { seen.set(o.code, null); issues.push(`conflict:${o.code}`); }
  }
  return { rows: [...seen.values()].filter((r): r is SkillRow => r !== null), issues };
}
export const levelOf = (rows: readonly SkillRow[], code: string): number | null => rows.find((r) => r.code === code)?.level ?? null;

/**
 * Skill effects. The wiki only gives level 0 and level 10 values; levels in between are assumed LINEAR (flagged `inferred`).
 *  production  10 -> 50 PP per shift      energy 30 -> 150      entrepreneurship ("Business") 30 -> 130
 */
export interface Derived<T> { value: T; evidence: Evidence }
const lin = (lvl: number, a: number, b: number): number => a + ((b - a) * Math.min(10, Math.max(0, lvl))) / 10;

export const productionPerShift = (level: number): Derived<number> => ({ value: Math.round(lin(level, 10, 50)), evidence: "inferred" });
export const maxEnergy = (level: number): Derived<number> => ({ value: Math.round(lin(level, 30, 150)), evidence: "inferred" });
export const maxInitiative = (level: number): Derived<number> => ({ value: Math.round(lin(level, 30, 130)), evidence: "inferred" });

/**
 * Sustained shifts per day for a bar with maximum `max`: it refills 10% of max per hour (= 2.4 x max per day) and a shift costs 10.
 * Wiki-confirmed rules; ignores the one-off starting stock.
 */
export const sustainedShiftsPerDay = (max: number): number => Math.floor((max * 24) / 100);
