import { emptyLevels, MAX_LEVEL, SKILL_IDS, skillPointLedger, totalCost, type Levels, type PointLedger, type SkillId } from '../engine/skills';
import { rankFromCode, rankFromDamage } from '../engine/ranks';
import type { GearInput } from '../engine/combat';
import type { PillState } from '../engine/pill';
import { API_SKILL_CODES } from './codes';
import { buildEquipmentSnapshot, resolveEquipment, type EquipmentRowIssue, type EquipmentSnapshot, type ResolvedEquipment } from './equipment-snapshot';

/** Structural shapes: what NationScope's parsePlayer / company parsers already return (kept structural so the engine never imports zod or Next). */
export interface ProfileLike {
  id: string; name: string; countryId: string | null; level: number | null;
  damage: { total: string | null; day: string | null; week: string | null; month: string | null };
  skills: { code: string; level: number; maxLevel: number }[]; hasSkills: boolean; rankCode: string | null;
  /** Optional for callers using legacy profile fixtures. API values are preserved separately from formulas. */
  prestige?: number | null; rankAttackBonusPercent?: number | null; rankMinDamage?: number | null;
  economy?: PlayerEconomyLike | null; equipment?: PlayerEquipmentLike[] | null;
  /** Profile equipment rows that failed validation upstream (reported as warnings, never dropped silently). */
  equipmentIssues?: EquipmentRowIssue[] | null;
  unit?: { id: string; name: string; role: string | null } | null; party?: { id: string; name: string; role: string | null } | null;
}
export interface PlayerEquipmentLike { slot: string; itemCode: string; rarity: string | null; stats: Record<string, number> | null; durability: number | null }
export interface PlayerMarketActivityLike { trades: number | null; units: number | null; value: string | number | null }
export interface PlayerEconomyPeriodLike { from: string | null; to: string | null; shiftsWorked: number | null; employeeShifts: number | null; unitsProduced: number | null; wagesEarned: string | number | null; marketBuys: PlayerMarketActivityLike | null; marketSells: PlayerMarketActivityLike | null }
export interface PlayerEconomyLike { lifetime: PlayerEconomyPeriodLike | null; recent: PlayerEconomyPeriodLike | null; companies: number | null }
export interface CompanyLike { id: string; name?: string; itemCode: string; regionId?: string | null; countryId?: string | null; storageLevel?: number | null; engineLevel?: number | null; breakRoomLevel?: number | null; workers?: number | null; level?: number | null }

export type Source = 'api' | 'derived' | 'user' | 'unavailable';
export interface Field<T> { value: T | null; source: Source; note?: string }
const f = <T>(value: T | null, source: Source, note?: string): Field<T> => ({ value, source, ...(note ? { note } : {}) });

/** Values the API cannot give (verified against the repo's recorded responses) or the user wants to override. User values always win and are labelled. */
export interface UserInputs {
  totalSkillPoints?: number; prestigeCount?: number; firstResetFree?: boolean;
  /** unspent skill points shown on the Skills page: with the invested points this fixes the earned total even if Prestige is unknown */ availableSkillPoints?: number;
  /** Slot-level equipment from the user: an item or `{kind:'empty'}` per slot. Each provided slot overrides/fills that slot only; omitted slots stay as the profile reports them (or unknown). */
  gear?: GearInput; pill?: PillState; rankBonusPct?: number;
  /** Only used when the API returned no usable skills. */
  skillLevels?: Partial<Levels>; level?: number;
}
export interface ImportInputs { profile: ProfileLike; companies?: CompanyLike[] | null; /** raw GET /players/{id}/stats body, shape not yet captured */ statsRaw?: unknown; user?: UserInputs }

export interface PlayerState {
  id: string; name: string; countryId: string | null;
  level: Field<number>; prestigeCount: Field<number>;
  skills: { levels: Field<Levels>; spentPoints: number | null; unmapped: string[]; unexpectedMaxLevel: string[]; inferredMappings: string[] };
  /** Earned, invested and available points are separate quantities. */
  skillPoints: { earned: Field<number>; earnedFromLevels: number | null; /** null = unknown, never assumed 0 */ prestigePoints: number | null; impliedMinPrestige: number | null; invested: number | null; available: Field<number>; /** false for 'lower-bound': the player may hold more points than the optimizer is allowed to spend */ exact: boolean; basis: PointLedger['basis'] | null; consistent: boolean | null };
  damage: ProfileLike['damage'];
  rank: { code: string | null; name: Field<string>; bonusPct: Field<number>; minDamage: Field<number> };
  companies: { items: CompanyLike[]; count: number | null; source: Source };
  stats: Field<Record<string, string>>;
  /** Profile-reported equipment snapshot. It is not a complete inventory or market candidate list. */
  equipmentSnapshot: Field<PlayerEquipmentLike[]>;
  /** Historical economy activity from the profile; retained as evidence, not used as a forecast input. */
  economy: Field<PlayerEconomyLike>;
  /** A complete, resolved loadout only (profile slots + user slot-level values); null whenever any slot is unresolved. Never a partial loadout. */
  gear: Field<GearInput>;
  /** Per-slot detail behind `gear`: profile snapshot completeness/status/durability and the merged resolution. */
  equipment: { snapshot: EquipmentSnapshot; resolved: ResolvedEquipment };
  pill: Field<PillState>; firstResetFree: Field<boolean>;
  currentHealthHunger: Field<never>;
  unit: ProfileLike['unit']; party: ProfileLike['party'];
  /** Things that block or weaken an optimization (never silently defaulted). */
  missing: string[]; warnings: string[];
}

function flatten(v: unknown, path = '', out: Record<string, string> = {}, depth = 0): Record<string, string> {
  if (depth > 4 || v === null || v === undefined) return out;
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') { out[path || 'value'] = String(v); return out; }
  if (Array.isArray(v)) { v.slice(0, 20).forEach((x, i) => flatten(x, `${path}[${i}]`, out, depth + 1)); return out; }
  if (typeof v === 'object') for (const [k, x] of Object.entries(v as Record<string, unknown>)) flatten(x, path ? `${path}.${k}` : k, out, depth + 1);
  return out;
}

export function buildPlayerState(inp: ImportInputs): PlayerState {
  const { profile: p, user = {} } = inp;
  const missing: string[] = [], warnings: string[] = [];

  // level
  const level: Field<number> = user.level !== undefined ? f(user.level, 'user') : p.level != null ? f(p.level, 'api') : f<number>(null, 'unavailable');
  if (level.value === null) missing.push('level');

  // skills (GET /players/{id} -> skills[{code, level, maxLevel}])
  const mapped: Partial<Levels> = {}; const unmapped: string[] = [], oddMax: string[] = [], inferred: string[] = [];
  const seen = new Set<string>();
  for (const s of p.skills) {
    if (seen.has(s.code)) continue; seen.add(s.code);
    const m = API_SKILL_CODES[s.code];
    if (!m) { unmapped.push(s.code); continue; }
    if (m.id === null) continue;
    if (!Number.isInteger(s.level) || s.level < 0 || s.level > MAX_LEVEL) { warnings.push(`Skill ${s.code} has an unusable level (${s.level}).`); continue; }
    if (s.maxLevel !== MAX_LEVEL) oddMax.push(`${s.code}:${s.maxLevel}`);
    if (m.confidence === 'inferred') inferred.push(`${s.code}->${m.id}`);
    mapped[m.id] = s.level;
  }
  const absent = SKILL_IDS.filter((id) => mapped[id] === undefined);
  let levels: Field<Levels>;
  if (absent.length === 0) levels = f({ ...emptyLevels(), ...mapped } as Levels, 'api');
  else if (user.skillLevels && SKILL_IDS.every((id) => (mapped[id] ?? user.skillLevels![id]) !== undefined)) {
    levels = f({ ...emptyLevels(), ...user.skillLevels, ...mapped } as Levels, 'user', `API lacked: ${absent.join(', ')}`);
  } else { levels = f<Levels>(null, 'unavailable', p.hasSkills ? `API skills missing: ${absent.join(', ')}` : 'profile has no skills array'); missing.push('skills'); }
  if (unmapped.length) warnings.push(`Unrecognised API skill codes ignored: ${unmapped.join(', ')}.`);
  if (oddMax.length) warnings.push(`Skills with maxLevel other than 10: ${oddMax.join(', ')}. The engine assumes 10 levels.`);
  const spent = levels.value ? totalCost(levels.value) : null;

  // Keep API Prestige visible, but do not feed it into the ledger: its effect on reset/preserved points is not verified.
  const prestige = user.prestigeCount !== undefined ? f(user.prestigeCount, 'user') : p.prestige != null ? f(p.prestige, 'api', 'profile value; excluded from the point ledger pending verification of post-Prestige point behavior') : f<number>(null, 'unavailable', 'not supplied by this profile');
  let earned: Field<number>, available: Field<number>, ledger: PointLedger | null = null;
  if (level.value !== null) {
    ledger = skillPointLedger({ level: level.value, prestigeCount: user.prestigeCount, invested: spent, totalOverride: user.totalSkillPoints, availablePoints: user.availableSkillPoints });
    const src: Source = ledger.basis === 'user-total' || ledger.basis === 'user-available' || ledger.basis === 'prestige-known' ? 'user' : 'derived';
    earned = f(ledger.earnedTotal, src, ledger.note + (ledger.exact ? '' : ' (LOWER BOUND, not a confirmed total)'));
    if (ledger.consistent === false) {
      const w = `Supplied information contradicts the invested skill points (${spent}): ${ledger.note}. Nothing was adjusted; recapture the profile or correct the input.`;
      warnings.push(w); available = f<number>(null, 'unavailable', w);
    } else available = ledger.available !== null ? f(ledger.available, src, ledger.exact ? 'earned - invested' : 'LOWER BOUND: earned may be higher if the player has more Prestige points') : f<number>(null, 'unavailable');
    if (!ledger.exact && ledger.impliedMinPrestige > 0) warnings.push(`Invested points (${spent}) exceed 4*(level-1)=${ledger.earnedFromLevels}: at least ${ledger.impliedMinPrestige} Prestige is implied by the invested points. The profile Prestige value is not used to infer the post-Prestige balance; supply totalSkillPoints or availableSkillPoints, otherwise the optimizer works with lower bound ${ledger.earnedTotal}.`);
  } else { earned = f<number>(null, 'unavailable'); available = f<number>(null, 'unavailable'); }
  if (!ledger?.exact) missing.push('exact skill-point ledger (API Prestige is recorded but not used to infer the post-Prestige point balance; supply totalSkillPoints or availableSkillPoints)');

  // rank
  const fromCode = rankFromCode(p.rankCode);
  const fromDmg = p.damage.total !== null ? rankFromDamage(p.damage.total) : null;
  let rankName: Field<string>, bonus: Field<number>;
  if (user.rankBonusPct !== undefined) { rankName = f(fromCode?.code ?? fromDmg?.code ?? p.rankCode ?? null, fromCode || p.rankCode ? 'api' : 'derived'); bonus = f(user.rankBonusPct, 'user'); }
  else if (p.rankAttackBonusPercent != null) {
    rankName = f(p.rankCode ?? fromCode?.code ?? fromDmg?.code ?? null, p.rankCode ? 'api' : 'derived');
    // Wiki 01-basics §2.6 defines the rank bonus by lifetime damage; the API only supplies the player's data and must not redefine the mechanic.
    if (fromDmg && fromDmg.bonusPct !== p.rankAttackBonusPercent) {
      bonus = f(fromDmg.bonusPct, 'derived', `Wiki rank table for lifetime damage (${fromDmg.code}); the API value ${p.rankAttackBonusPercent}% disagrees`);
      warnings.push(`API rank bonus ${p.rankAttackBonusPercent}% disagrees with the Wiki rank table (${fromDmg.bonusPct}% for ${fromDmg.code} at this lifetime damage). The Wiki value is used; enter the rank bonus yourself to override.`);
    } else bonus = f(p.rankAttackBonusPercent, 'api', fromDmg ? 'rank.attackBonusPercent from player profile; matches the Wiki rank table for lifetime damage' : 'rank.attackBonusPercent from player profile; lifetime damage unavailable, not cross-checked against the Wiki table');
  }
  else if (fromCode) { rankName = f(fromCode.code, 'api'); bonus = f(fromCode.bonusPct, 'derived', 'local rank table fallback; rank code came from API'); if (fromDmg && fromDmg.code !== fromCode.code) warnings.push(`API rank "${p.rankCode}" differs from rank implied by lifetime damage ("${fromDmg.code}").`); }
  else if (fromDmg) { rankName = f(fromDmg.code, 'derived', `API rank code ${JSON.stringify(p.rankCode)} not recognised; derived from lifetime damage`); bonus = f(fromDmg.bonusPct, 'derived'); }
  else { rankName = f<string>(null, 'unavailable'); bonus = f<number>(null, 'unavailable'); missing.push('rank bonus'); }

  // companies (GET /players/{id}/companies)
  const comps = inp.companies ?? null;
  if (comps === null) missing.push('companies (request failed or not loaded)');

  const stats = inp.statsRaw === undefined ? f<Record<string, string>>(null, 'unavailable', 'stats not loaded') : f(flatten(inp.statsRaw), 'api', 'GET /players/{id}/stats; field names not yet captured as a fixture');

  const snapshot = p.equipment ?? null;
  const eqSnapshot = buildEquipmentSnapshot(snapshot, p.equipmentIssues ?? []);
  const resolved = resolveEquipment(eqSnapshot, user.gear);
  const { api: fromApi, user: fromUser } = resolved.sources;
  const gear: Field<GearInput> = resolved.gear === null
    ? f<GearInput>(null, 'unavailable', `equipment is ${resolved.completeness}; unresolved slots (unknown, not empty): ${resolved.unresolved.join(', ')}`)
    : fromUser.length === 0 ? f(resolved.gear, 'api', 'all six slots mapped from the profile equipment snapshot; not asserted to be a complete inventory')
    : fromApi.length === 0 ? f(resolved.gear, 'user')
    : f(resolved.gear, 'derived', `merged slot by slot: ${fromUser.join(', ')} from user input, ${fromApi.join(', ')} from the profile snapshot`);
  if (!gear.value) missing.push(`usable equipped gear (profile equipment is ${resolved.completeness}; unresolved slots: ${resolved.unresolved.join(', ')}; user input may fill gaps)`);
  if (eqSnapshot.reported) warnings.push(...eqSnapshot.warnings);
  if (resolved.overridden.length) warnings.push(`User values replaced the profile equipment for: ${resolved.overridden.join(', ')}.`);
  const pill = user.pill ? f(user.pill, 'user') : f<PillState>(null, 'unavailable', 'Pill buff/debuff state is not exposed by the API');
  missing.push('current health/hunger (not exposed; optimizer assumes a full health bar and does not use current hunger)');

  return {
    id: p.id, name: p.name, countryId: p.countryId, level, prestigeCount: prestige,
    skills: { levels, spentPoints: spent, unmapped, unexpectedMaxLevel: oddMax, inferredMappings: inferred },
    skillPoints: { earned, earnedFromLevels: ledger?.earnedFromLevels ?? null, prestigePoints: ledger?.prestigePoints ?? null, impliedMinPrestige: ledger?.impliedMinPrestige ?? null, invested: spent, available, exact: ledger?.exact ?? false, basis: ledger?.basis ?? null, consistent: ledger?.consistent ?? null },
    damage: p.damage, rank: { code: p.rankCode, name: rankName, bonusPct: bonus, minDamage: p.rankMinDamage != null ? f(p.rankMinDamage, 'api', 'rank.minDamage from player profile') : f<number>(null, 'unavailable') },
    companies: { items: comps ?? [], count: comps === null ? null : comps.length, source: comps === null ? 'unavailable' : 'api' },
    stats, equipmentSnapshot: snapshot !== null ? f(snapshot, 'api', 'profile snapshot only; not asserted to be complete inventory') : f<PlayerEquipmentLike[]>(null, 'unavailable'),
    economy: p.economy ? f(p.economy, 'api', 'historical profile activity; not used as a predictive economy input') : f<PlayerEconomyLike>(null, 'unavailable'),
    gear, equipment: { snapshot: eqSnapshot, resolved }, pill, firstResetFree: user.firstResetFree !== undefined ? f(user.firstResetFree, 'user') : f<boolean>(null, 'unavailable', 'skill-reset cooldown not exposed'),
    currentHealthHunger: f<never>(null, 'unavailable'), unit: p.unit ?? null, party: p.party ?? null, missing, warnings,
  };
}
export type { SkillId };
