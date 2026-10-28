import { z } from "zod";

/** GET /battles/{id}, shape verified on Main (2026-10-21). Damage values are integer strings (BigInt-safe). recentHits/ticks are intentionally not modelled. */
const dmg = z.string().regex(/^\d+$/);
const roundSchema = z.object({
  number: z.number(), status: z.string().nullish(), attackerDamage: dmg.nullish(), defenderDamage: dmg.nullish(),
  attackerPoints: z.number().nullish(), defenderPoints: z.number().nullish(), winner: z.string().nullish(), startedAt: z.string().nullish(), endedAt: z.string().nullish(), nextTickAt: z.string().nullish(),
}).passthrough();
const fighterSchema = z.object({ userId: z.string().min(1), username: z.string().nullish(), avatarUrl: z.string().nullish(), countryId: z.string().nullish(), damage: dmg.nullish(), hits: z.number().nullish() }).passthrough();
const side = z.object({ damage: dmg.nullish(), fighters: z.number().nullish() }).passthrough();
const schema = z.object({
  id: z.string().min(1), type: z.string().nullish(), status: z.string(), regionId: z.string().nullish(), sourceRegionId: z.string().nullish(),
  attackerCountryId: z.string().nullish(), defenderCountryId: z.string().nullish(), attackerRounds: z.number().nullish(), defenderRounds: z.number().nullish(),
  currentRound: z.number().nullish(), winner: z.string().nullish(), startedAt: z.string().nullish(), endedAt: z.string().nullish(),
  rounds: z.array(z.unknown()).nullish(),
  totals: z.object({ attacker: side.nullish(), defender: side.nullish() }).passthrough().nullish(),
  leaderboards: z.object({ attacker: z.array(z.unknown()).nullish(), defender: z.array(z.unknown()).nullish() }).passthrough().nullish(),
  rules: z.object({ roundsToWin: z.number().nullish(), pointsToWinRound: z.number().nullish() }).passthrough().nullish(),
}).passthrough();

export interface BattleRound { number: number; status: string | null; attackerDamage: string | null; defenderDamage: string | null; attackerPoints: number | null; defenderPoints: number | null; winner: "attacker" | "defender" | null; startedAt: string | null; endedAt: string | null; nextTickAt: string | null }
export interface BattleFighter { id: string; name: string; avatar: string | null; countryId: string | null; damage: string | null; hits: number | null }
export interface BattleDetail {
  id: string; type: string | null; status: "active" | "finished" | string; regionId: string | null; sourceRegionId: string | null;
  attackerCountryId: string | null; defenderCountryId: string | null; attackerRounds: number; defenderRounds: number; currentRound: number | null; winner: "attacker" | "defender" | null;
  startedAt: string | null; endedAt: string | null; roundsToWin: number | null; pointsToWinRound: number | null;
  rounds: BattleRound[]; totals: { attacker: { damage: string | null; fighters: number | null }; defender: { damage: string | null; fighters: number | null } };
  fighters: { attacker: BattleFighter[]; defender: BattleFighter[] };
}

const MEDIA = /^\/media\/[A-Za-z0-9._/-]+$/;
const media = (p: string | null | undefined, o: string) => (p && MEDIA.test(p) && !p.split("/").includes("..") ? `${o}${p}` : null);
const sideOf = (v: string | null | undefined): "attacker" | "defender" | null => (v === "attacker" || v === "defender" ? v : null);

export function parseBattleDetail(raw: unknown, origin: string): BattleDetail | null {
  const r = schema.safeParse(raw);
  if (!r.success) return null;
  const v = r.data;
  const rounds: BattleRound[] = [];
  for (const x of v.rounds ?? []) {
    const p = roundSchema.safeParse(x);
    if (p.success) rounds.push({ number: p.data.number, status: p.data.status ?? null, attackerDamage: p.data.attackerDamage ?? null, defenderDamage: p.data.defenderDamage ?? null, attackerPoints: p.data.attackerPoints ?? null, defenderPoints: p.data.defenderPoints ?? null, winner: sideOf(p.data.winner), startedAt: p.data.startedAt ?? null, endedAt: p.data.endedAt ?? null, nextTickAt: p.data.nextTickAt ?? null });
  }
  rounds.sort((a, b) => a.number - b.number);
  const fighters = (list: unknown[] | null | undefined): BattleFighter[] => (list ?? []).flatMap((x) => {
    const p = fighterSchema.safeParse(x);
    return p.success ? [{ id: p.data.userId, name: p.data.username?.trim() || p.data.userId, avatar: media(p.data.avatarUrl, origin), countryId: p.data.countryId ?? null, damage: p.data.damage ?? null, hits: p.data.hits ?? null }] : [];
  });
  return {
    id: v.id, type: v.type ?? null, status: v.status, regionId: v.regionId ?? null, sourceRegionId: v.sourceRegionId ?? null,
    attackerCountryId: v.attackerCountryId ?? null, defenderCountryId: v.defenderCountryId ?? null, attackerRounds: v.attackerRounds ?? 0, defenderRounds: v.defenderRounds ?? 0,
    currentRound: v.currentRound ?? null, winner: sideOf(v.winner), startedAt: v.startedAt ?? null, endedAt: v.endedAt ?? null,
    roundsToWin: v.rules?.roundsToWin ?? null, pointsToWinRound: v.rules?.pointsToWinRound ?? null, rounds,
    totals: { attacker: { damage: v.totals?.attacker?.damage ?? null, fighters: v.totals?.attacker?.fighters ?? null }, defender: { damage: v.totals?.defender?.damage ?? null, fighters: v.totals?.defender?.fighters ?? null } },
    fighters: { attacker: fighters(v.leaderboards?.attacker), defender: fighters(v.leaderboards?.defender) },
  };
}

/** Share (0..100, one decimal) of side A in A+B; null when both are zero/unknown so no misleading 50/50 split is drawn. */
export function splitPercent(a: string | null, b: string | null): number | null {
  const x = a === null ? null : BigInt(a), y = b === null ? null : BigInt(b);
  if (x === null || y === null || x + y === 0n) return null;
  return Number((x * 1000n) / (x + y)) / 10;
}
/** Progress toward the points needed to win a round, clamped to 0..100. */
export const pointsPercent = (points: number | null, needed: number | null): number | null =>
  points === null || !needed || needed <= 0 ? null : Math.min(100, Math.max(0, Math.round((points / needed) * 1000) / 10));
