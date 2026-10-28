import { z } from "zod";

/**
 * GET /players/{id}. Verified fields used: username, avatarUrl, countryId, level, damage {total, day, week, month}, skills [{code, level, maxLevel}],
 * presence {online, lastActiveAt}, unit {id, name, role}, party {id, name, role}, rank {code}. NOT exposed: current health/hunger values, buff/debuff state, skill-reset cooldown.
 */
const damageValue = z.union([z.string().regex(/^\d+$/), z.number().int().nonnegative()]).transform((v) => String(v));
const skill = z.object({ code: z.string(), level: z.number(), maxLevel: z.number() }).passthrough();
const ref = z.object({ id: z.string().nullish(), name: z.string().nullish(), role: z.string().nullish() }).passthrough();
const schema = z.object({
  id: z.string().min(1), username: z.string().min(1), avatarUrl: z.string().nullish(), countryId: z.string().nullish(), level: z.number().nullish(),
  damage: z.object({ total: damageValue.nullish(), day: damageValue.nullish(), week: damageValue.nullish(), month: damageValue.nullish() }).passthrough().nullish(),
  skills: z.array(z.unknown()).nullish(),
  presence: z.object({ online: z.boolean().nullish(), lastActiveAt: z.string().nullish() }).passthrough().nullish(),
  unit: ref.nullish(), party: ref.nullish(), rank: z.object({ code: z.string().nullish() }).passthrough().nullish(), joinedAt: z.string().nullish(),
}).passthrough();

export interface PlayerSkill { code: string; level: number; maxLevel: number }
export interface PlayerProfile {
  id: string; name: string; avatar: string | null; countryId: string | null; level: number | null;
  damage: { total: string | null; day: string | null; week: string | null; month: string | null };
  /** Raw valid skill entries (classification applies its own eligibility rules). Empty when the response has none. */
  skills: PlayerSkill[]; hasSkills: boolean;
  online: boolean | null; lastActiveAt: string | null; unit: { id: string; name: string; role: string | null } | null; party: { id: string; name: string; role: string | null } | null;
  rankCode: string | null; joinedAt: string | null;
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
  const link = (x: z.infer<typeof ref> | null | undefined) => (x && idOk(x.id) && x.name ? { id: x.id, name: x.name, role: x.role ?? null } : null);
  return {
    id: v.id, name: v.username, avatar: media(v.avatarUrl, origin), countryId: v.countryId ?? null, level: v.level ?? null,
    damage: { total: v.damage?.total ?? null, day: v.damage?.day ?? null, week: v.damage?.week ?? null, month: v.damage?.month ?? null },
    skills, hasSkills: skills.length > 0, online: v.presence?.online ?? null, lastActiveAt: v.presence?.lastActiveAt ?? null,
    unit: link(v.unit), party: link(v.party), rankCode: v.rank?.code ?? null, joinedAt: v.joinedAt ?? null,
  };
}
