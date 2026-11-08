import { z } from "zod";

/**
 * GET /players/{id}. Values beyond the identity/skill fields are preserved only when their observed shape validates.
 * NOT exposed: current health/hunger values, buff/debuff state, skill-reset cooldown, complete owned inventory.
 */
const damageValue = z.union([z.string().regex(/^\d+$/), z.number().int().nonnegative()]).transform((v) => String(v));
const skill = z.object({ code: z.string(), level: z.number(), maxLevel: z.number() }).passthrough();
const ref = z.object({ id: z.string().nullish(), name: z.string().nullish(), role: z.string().nullish() }).passthrough();
const equipmentEntry = z.object({
  slot: z.string(), itemCode: z.string(), rarity: z.string().nullish(),
  stats: z.record(z.number().finite()).nullish(), durability: z.number().finite().nullish(),
}).passthrough();
const marketActivity = z.object({ trades: z.number().finite().nullish(), units: z.number().finite().nullish(), value: z.union([z.string(), z.number()]).nullish() }).passthrough();
const economyPeriod = z.object({
  from: z.string().nullish(), to: z.string().nullish(), shiftsWorked: z.number().finite().nullish(), employeeShifts: z.number().finite().nullish(),
  unitsProduced: z.number().finite().nullish(), wagesEarned: z.union([z.string(), z.number()]).nullish(),
  marketBuys: marketActivity.nullish(), marketSells: marketActivity.nullish(),
}).passthrough();
const economy = z.object({ lifetime: economyPeriod.nullish(), recent: economyPeriod.nullish(), companies: z.number().finite().nullish() }).passthrough();
const schema = z.object({
  id: z.string().min(1), username: z.string().min(1), avatarUrl: z.string().nullish(), countryId: z.string().nullish(), level: z.number().nullish(),
  damage: z.object({ total: damageValue.nullish(), day: damageValue.nullish(), week: damageValue.nullish(), month: damageValue.nullish() }).passthrough().nullish(),
  skills: z.array(z.unknown()).nullish(),
  presence: z.object({ online: z.boolean().nullish(), lastActiveAt: z.string().nullish() }).passthrough().nullish(),
  unit: ref.nullish(), party: ref.nullish(), rank: z.object({ code: z.string().nullish(), attackBonusPercent: z.number().finite().nullish(), minDamage: z.number().finite().nullish() }).passthrough().nullish(),
  prestige: z.number().int().nonnegative().nullish(), economy: economy.nullish(),
  /** Kept as unknown: a malformed equipment block must not make the whole profile unreadable; rows are validated one by one in parsePlayer. */
  equipment: z.unknown().nullish(), joinedAt: z.string().nullish(),
}).passthrough();

export interface PlayerSkill { code: string; level: number; maxLevel: number }
/** Why a profile equipment row (or the whole block) was not accepted. Rejected rows are reported, never silently dropped. */
export type PlayerEquipmentIssueReason = 'not-an-array' | 'not-an-object' | 'missing-slot' | 'missing-item-code' | 'invalid-stats' | 'invalid-durability' | 'malformed';
export interface PlayerEquipmentIssue { index: number; slot: string | null; reason: PlayerEquipmentIssueReason }
export interface PlayerEquipmentEntry { slot: string; itemCode: string; rarity: string | null; stats: Record<string, number> | null; durability: number | null }
export interface PlayerMarketActivity { trades: number | null; units: number | null; value: string | number | null }
export interface PlayerEconomyPeriod {
  from: string | null; to: string | null; shiftsWorked: number | null; employeeShifts: number | null; unitsProduced: number | null;
  wagesEarned: string | number | null; marketBuys: PlayerMarketActivity | null; marketSells: PlayerMarketActivity | null;
}
export interface PlayerEconomy { lifetime: PlayerEconomyPeriod | null; recent: PlayerEconomyPeriod | null; companies: number | null }
export interface PlayerProfile {
  id: string; name: string; avatar: string | null; countryId: string | null; level: number | null;
  damage: { total: string | null; day: string | null; week: string | null; month: string | null };
  /** Raw valid skill entries (classification applies its own eligibility rules). Empty when the response has none. */
  skills: PlayerSkill[]; hasSkills: boolean;
  online: boolean | null; lastActiveAt: string | null; unit: { id: string; name: string; role: string | null } | null; party: { id: string; name: string; role: string | null } | null;
  rankCode: string | null; rankAttackBonusPercent: number | null; rankMinDamage: number | null;
  prestige: number | null; economy: PlayerEconomy | null; /** Snapshot attached to the profile; not an owned-inventory listing. */ equipment: PlayerEquipmentEntry[] | null;
  /** Rows of the equipment block that failed validation (null when no equipment block was present). */
  equipmentIssues: PlayerEquipmentIssue[] | null;
  joinedAt: string | null;
}

function issueReason(error: z.ZodError): PlayerEquipmentIssueReason {
  const path = error.issues[0]?.path[0];
  if (path === "slot") return "missing-slot";
  if (path === "itemCode") return "missing-item-code";
  if (path === "stats") return "invalid-stats";
  if (path === "durability") return "invalid-durability";
  return "malformed";
}
/** Row-by-row validation: valid rows are kept as observed, invalid rows become issues (with the slot when it is readable). */
function parseEquipment(raw: unknown): { equipment: PlayerEquipmentEntry[] | null; equipmentIssues: PlayerEquipmentIssue[] | null } {
  if (raw === undefined || raw === null) return { equipment: null, equipmentIssues: null };
  if (!Array.isArray(raw)) return { equipment: null, equipmentIssues: [{ index: -1, slot: null, reason: "not-an-array" }] };
  const equipment: PlayerEquipmentEntry[] = [], issues: PlayerEquipmentIssue[] = [];
  raw.forEach((entry, index) => {
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) { issues.push({ index, slot: null, reason: "not-an-object" }); return; }
    const parsed = equipmentEntry.safeParse(entry);
    if (parsed.success) { equipment.push({ slot: parsed.data.slot, itemCode: parsed.data.itemCode, rarity: parsed.data.rarity ?? null, stats: parsed.data.stats ?? null, durability: parsed.data.durability ?? null }); return; }
    const slot = (entry as { slot?: unknown }).slot;
    issues.push({ index, slot: typeof slot === "string" && slot ? slot : null, reason: issueReason(parsed.error) });
  });
  return { equipment, equipmentIssues: issues };
}

const MEDIA = /^\/media\/[A-Za-z0-9._/-]+$/;
const media = (p: string | null | undefined, o: string) => (p && MEDIA.test(p) && !p.split("/").includes("..") ? `${o}${p}` : null);
const idOk = (s: string | null | undefined): s is string => typeof s === "string" && /^[A-Za-z0-9_-]{1,80}$/.test(s);

export function parsePlayer(raw: unknown, origin: string): PlayerProfile | null {
  const r = schema.safeParse(raw);
  if (!r.success) return null;
  const v = r.data;
  const skills: PlayerSkill[] = [];
  for (const s of v.skills ?? []) { const p = skill.safeParse(s); if (p.success) skills.push({ code: p.data.code, level: p.data.level, maxLevel: p.data.maxLevel }); }
  const { equipment, equipmentIssues } = parseEquipment(v.equipment);
  const activity = (p: z.infer<typeof economyPeriod> | null | undefined): PlayerEconomyPeriod | null => p ? ({
    from: p.from ?? null, to: p.to ?? null, shiftsWorked: p.shiftsWorked ?? null, employeeShifts: p.employeeShifts ?? null,
    unitsProduced: p.unitsProduced ?? null, wagesEarned: p.wagesEarned ?? null,
    marketBuys: p.marketBuys ? { trades: p.marketBuys.trades ?? null, units: p.marketBuys.units ?? null, value: p.marketBuys.value ?? null } : null,
    marketSells: p.marketSells ? { trades: p.marketSells.trades ?? null, units: p.marketSells.units ?? null, value: p.marketSells.value ?? null } : null,
  }) : null;
  const link = (x: z.infer<typeof ref> | null | undefined) => (x && idOk(x.id) && x.name ? { id: x.id, name: x.name, role: x.role ?? null } : null);
  return {
    id: v.id, name: v.username, avatar: media(v.avatarUrl, origin), countryId: v.countryId ?? null, level: v.level ?? null,
    damage: { total: v.damage?.total ?? null, day: v.damage?.day ?? null, week: v.damage?.week ?? null, month: v.damage?.month ?? null },
    skills, hasSkills: skills.length > 0, online: v.presence?.online ?? null, lastActiveAt: v.presence?.lastActiveAt ?? null,
    unit: link(v.unit), party: link(v.party), rankCode: v.rank?.code ?? null,
    rankAttackBonusPercent: v.rank?.attackBonusPercent ?? null, rankMinDamage: v.rank?.minDamage ?? null,
    prestige: v.prestige ?? null,
    economy: v.economy ? { lifetime: activity(v.economy.lifetime), recent: activity(v.economy.recent), companies: v.economy.companies ?? null } : null,
    equipment, equipmentIssues, joinedAt: v.joinedAt ?? null,
  };
}
