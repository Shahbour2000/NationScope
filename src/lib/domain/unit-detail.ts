import { z } from "zod";

/**
 * GET /units/{id}, shape verified on Main (2026-10-22, unit "Arthur Reign").
 * Verified fields: identity, hq/dorm levels, capacity, members[] (role, level, country, totalDamage, weeklyDamage,
 * lastActiveAt, presence.online), stats {totalDamage, weeklyDamage, tournamentWins}, tournaments[], upgrades.
 * NOT present in this response: skill build, buff/debuff, health, hunger, daily damage, skill-reset cooldown, damage by target country.
 */
const intStr = z.string().regex(/^\d+$/);
const num = z.number().nullish();

const memberSchema = z.object({
  userId: z.string().min(1),
  role: z.string().nullish(),
  joinedAt: z.string().nullish(),
  username: z.string().nullish(),
  avatarUrl: z.string().nullish(),
  level: num,
  countryId: z.string().nullish(),
  totalDamage: intStr.nullish(),
  weeklyDamage: intStr.nullish(),
  lastActiveAt: z.string().nullish(),
  presence: z.object({ lastActiveAt: z.string().nullish(), online: z.boolean().nullish() }).passthrough().nullish(),
}).passthrough();

const tournamentSchema = z.object({
  id: z.string(), name: z.string().nullish(), status: z.string().nullish(), startsAt: z.string().nullish(),
  winnerId: z.string().nullish(), runnerUpId: z.string().nullish(), seed: num, result: z.string().nullish(),
}).passthrough();

const upgradeSchema = z.object({
  level: num, maxLevel: num,
  stats: z.object({ attackBonus: num, members: num }).passthrough().nullish(),
  next: z.object({ level: num, steelCost: num, stats: z.object({ attackBonus: num, members: num }).passthrough().nullish() }).passthrough().nullish(),
}).passthrough();

const detailSchema = z.object({
  id: z.string().min(1), name: z.string().min(1),
  description: z.string().nullish(), status: z.string().nullish(), countryId: z.string().nullish(), regionId: z.string().nullish(),
  joinPolicy: z.string().nullish(), logoUrl: z.string().nullish(), ownerId: z.string().nullish(), createdAt: z.string().nullish(),
  hqLevel: num, hqAttackBonus: num, dormLevel: num, capacity: num,
  members: z.array(z.unknown()).nullish(),
  stats: z.object({ totalDamage: intStr.nullish(), weeklyDamage: intStr.nullish(), tournamentWins: num }).passthrough().nullish(),
  tournaments: z.array(z.unknown()).nullish(),
  upgrades: z.object({ headquarters: upgradeSchema.nullish(), dormitories: upgradeSchema.nullish() }).passthrough().nullish(),
}).passthrough();

export interface UnitMember {
  id: string; name: string; avatar: string | null; role: string; level: number | null; countryId: string | null;
  joinedAt: string | null; lastActiveAt: string | null; online: boolean | null;
  /** Integer strings (player's own figures as reported; they do not necessarily add up to the unit totals). */
  totalDamage: string | null; weeklyDamage: string | null;
}
export interface UnitTournament { id: string; name: string | null; status: string | null; startsAt: string | null; won: boolean; runnerUp: boolean; seed: number | null; result: string | null }
export interface UnitProfile {
  id: string; name: string; description: string | null; status: string | null; countryId: string | null; regionId: string | null; joinPolicy: string | null;
  logoSrc: string | null; ownerId: string | null; createdAt: string | null; capacity: number | null;
  hq: { level: number | null; max: number | null; attackBonus: number | null; nextAttackBonus: number | null };
  dorm: { level: number | null; max: number | null; capacity: number | null; nextCapacity: number | null };
  stats: { totalDamage: string | null; weeklyDamage: string | null; tournamentWins: number | null } | null;
  members: UnitMember[]; skippedMembers: number; tournaments: UnitTournament[];
}

const MEDIA = /^\/media\/[A-Za-z0-9._/-]+$/;
const media = (p: string | null | undefined, origin: string): string | null => (p && MEDIA.test(p) && !p.split("/").includes("..") ? `${origin}${p}` : null);

export function parseUnitDetail(raw: unknown, origin: string): UnitProfile | null {
  const r = detailSchema.safeParse(raw);
  if (!r.success) return null;
  const v = r.data;
  let skipped = 0;
  const members: UnitMember[] = [];
  for (const m of v.members ?? []) {
    const p = memberSchema.safeParse(m);
    if (!p.success) { skipped++; continue; }
    const x = p.data;
    members.push({
      id: x.userId, name: x.username?.trim() || x.userId, avatar: media(x.avatarUrl, origin), role: x.role ?? "member", level: x.level ?? null,
      countryId: x.countryId ?? null, joinedAt: x.joinedAt ?? null, lastActiveAt: x.presence?.lastActiveAt ?? x.lastActiveAt ?? null,
      online: typeof x.presence?.online === "boolean" ? x.presence.online : null, totalDamage: x.totalDamage ?? null, weeklyDamage: x.weeklyDamage ?? null,
    });
  }
  const tournaments: UnitTournament[] = [];
  for (const t of v.tournaments ?? []) {
    const p = tournamentSchema.safeParse(t);
    if (p.success) tournaments.push({ id: p.data.id, name: p.data.name ?? null, status: p.data.status ?? null, startsAt: p.data.startsAt ?? null, won: p.data.winnerId === v.id, runnerUp: p.data.runnerUpId === v.id, seed: p.data.seed ?? null, result: p.data.result ?? null });
  }
  const hq = v.upgrades?.headquarters, dorm = v.upgrades?.dormitories;
  return {
    id: v.id, name: v.name, description: v.description?.trim() || null, status: v.status ?? null, countryId: v.countryId ?? null, regionId: v.regionId ?? null,
    joinPolicy: v.joinPolicy ?? null, logoSrc: media(v.logoUrl, origin), ownerId: v.ownerId ?? null, createdAt: v.createdAt ?? null, capacity: v.capacity ?? null,
    hq: { level: v.hqLevel ?? hq?.level ?? null, max: hq?.maxLevel ?? null, attackBonus: v.hqAttackBonus ?? hq?.stats?.attackBonus ?? null, nextAttackBonus: hq?.next?.stats?.attackBonus ?? null },
    dorm: { level: v.dormLevel ?? dorm?.level ?? null, max: dorm?.maxLevel ?? null, capacity: v.capacity ?? dorm?.stats?.members ?? null, nextCapacity: dorm?.next?.stats?.members ?? null },
    stats: v.stats ? { totalDamage: v.stats.totalDamage ?? null, weeklyDamage: v.stats.weeklyDamage ?? null, tournamentWins: v.stats.tournamentWins ?? null } : null,
    members, skippedMembers: skipped, tournaments,
  };
}
