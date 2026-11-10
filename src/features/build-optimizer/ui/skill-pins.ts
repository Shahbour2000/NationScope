import { SKILL_IDS, cumulativeCost, isUnlocked, MAX_LEVEL, type SkillId } from '../engine/skills';
import { LIMITS } from '../api-schema';
import type { ConstraintForm } from './form';

/**
 * Pure helpers behind the Skill Builder grid. A "pin" is a mandatory MINIMUM level for one skill and is stored as an ordinary
 * `min` entry of `form.constraints`, so it travels through the existing request body, validation and engine unchanged.
 * Max / exact rules are never touched here; they stay editable in the "Must-keep rules" section.
 */
const level = (c: ConstraintForm): number | null => { const v = Number(c.level.trim().replace(',', '.')); return c.level.trim() !== '' && Number.isInteger(v) && v >= 0 && v <= MAX_LEVEL ? v : null; };

/** The pinned minimum for a skill (highest valid `min` rule), or null when the skill is not pinned. */
export function pinOf(cs: ConstraintForm[], skill: SkillId): number | null {
  let best: number | null = null;
  for (const c of cs) if (c.skill === skill && c.kind === 'min') { const v = level(c); if (v !== null && v > 0 && (best === null || v > best)) best = v; }
  return best;
}
/** Max / exact rules on a skill (managed in the rules section, only displayed by the grid). */
export function otherRules(cs: ConstraintForm[], skill: SkillId): ConstraintForm[] { return cs.filter((c) => c.skill === skill && c.kind !== 'min'); }

/** Set (level 1-10) or clear (null / 0) the pin on a skill. Returns `null` when adding would exceed the request limit, so the caller can tell the user. */
export function setPin(cs: ConstraintForm[], skill: SkillId, lvl: number | null): ConstraintForm[] | null {
  const without = cs.filter((c) => !(c.skill === skill && c.kind === 'min'));
  if (lvl === null || lvl <= 0) return without;
  if (!Number.isInteger(lvl) || lvl > MAX_LEVEL) return null;
  if (without.length + 1 > LIMITS.constraints) return null;
  return [...without, { skill, kind: 'min', level: String(lvl) }];
}
export const clearPins = (cs: ConstraintForm[]): ConstraintForm[] => cs.filter((c) => c.kind !== 'min');

/** Pin every unlocked skill at its current level (a "do not go below what I have" shortcut). Null when the request limit would be exceeded. */
export function pinCurrent(cs: ConstraintForm[], current: Partial<Record<SkillId, number | null>>, playerLevel: number | null): ConstraintForm[] | null {
  let out = clearPins(cs);
  for (const id of SKILL_IDS) {
    const v = current[id]; if (v === null || v === undefined || v <= 0 || isLocked(id, playerLevel)) continue;
    const next = setPin(out, id, v); if (next === null) return null; out = next;
  }
  return out;
}
/** Points the pinned minimums reserve (cumulative cost of each pinned level). */
export function pinnedCost(cs: ConstraintForm[]): number { return SKILL_IDS.reduce((s, id) => { const p = pinOf(cs, id); return s + (p === null ? 0 : cumulativeCost(p)); }, 0); }
/** Locked only when the player level is KNOWN and below the unlock level; unknown level never locks (and never claims unlocked). */
export const isLocked = (id: SkillId, playerLevel: number | null): boolean => playerLevel !== null && !isUnlocked(id, playerLevel);
