/** Pure grouping of a player's skills for display (combat / economy / neutral / other), using the same mapping and validity rules as the classifier. */
import { BUILD_RULES } from "./classify";
import type { PlayerSkill } from "@/lib/domain/player";

export type SkillGroupKey = "war" | "eco" | "shared" | "other";
export interface SkillRow extends PlayerSkill { pct: number }
export interface SkillGroup { key: SkillGroupKey; skills: SkillRow[]; levels: number; capacity: number }

const valid = (s: PlayerSkill) => Number.isFinite(s.level) && Number.isFinite(s.maxLevel) && s.maxLevel > 0 && s.level >= 0 && s.level <= s.maxLevel;
const groupOf = (code: string): SkillGroupKey =>
  (BUILD_RULES.war as readonly string[]).includes(code) ? "war" : (BUILD_RULES.eco as readonly string[]).includes(code) ? "eco" : (BUILD_RULES.shared as readonly string[]).includes(code) ? "shared" : "other";

/** Valid skills only, first entry per code; each group sorted by fill (high first) then code. Empty groups are omitted. */
export function groupSkills(skills: readonly PlayerSkill[]): SkillGroup[] {
  const seen = new Set<string>();
  const by: Record<SkillGroupKey, SkillRow[]> = { war: [], eco: [], shared: [], other: [] };
  for (const s of skills) {
    if (seen.has(s.code) || !valid(s)) continue;
    seen.add(s.code);
    by[groupOf(s.code)].push({ ...s, pct: (s.level / s.maxLevel) * 100 });
  }
  return (["war", "eco", "shared", "other"] as const)
    .filter((k) => by[k].length > 0)
    .map((key) => {
      const rows = by[key].sort((a, b) => b.pct - a.pct || a.code.localeCompare(b.code));
      return { key, skills: rows, levels: rows.reduce((n, r) => n + r.level, 0), capacity: rows.reduce((n, r) => n + r.maxLevel, 0) };
    });
}
