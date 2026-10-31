import { z } from "zod";

/** Models below are written from REAL production responses (tests/fixtures/real, captured 2026-10-17). Unknown extras are tolerated; most fields are optional so one missing field never breaks a page. */
const s = z.string();
const n = z.number();

export const countrySchema = z.object({
  id: s.min(1), name: s.min(1),
  scheme: s.nullish(), capitalRegionId: s.nullish(), capitalHeld: z.boolean().nullish(),
  regions: n.nullish(), coreRegions: n.nullish(), coreHeld: n.nullish(),
  development: n.nullish(), citizens: n.nullish(), activeCitizens: n.nullish(),
  alliance: z.object({ id: s, name: s, status: s.nullish() }).passthrough().nullish(),
  enemyCountryId: s.nullish(), specializedItem: s.nullish(),
  incomeTax: n.nullish(), marketTax: n.nullish(), citizenshipFee: s.nullish(), immigrationPitch: s.nullish(),
}).passthrough();
export type Country = z.infer<typeof countrySchema>;

export const warSchema = z.object({
  id: s.min(1), countryA: s, countryB: s, declaredBy: s.nullish(), status: s,
  declaredAt: s.nullish(), endedAt: s.nullish(), proposalId: s.nullish(),
  priority: z.object({ countryId: s, until: s.nullish() }).passthrough().nullish(),
  activeBattles: n.nullish(), finishedBattles: n.nullish(),
}).passthrough();
export type War = z.infer<typeof warSchema>;

export const battleSchema = z.object({
  id: s.min(1), type: s, status: s, regionId: s.nullish(), sourceRegionId: s.nullish(),
  attackerCountryId: s.nullish(), defenderCountryId: s.nullish(), attackerMuId: s.nullish(), defenderMuId: s.nullish(),
  attackerRounds: n.nullish(), defenderRounds: n.nullish(), currentRound: n.nullish(), winner: s.nullish(),
  startedAt: s.nullish(), endedAt: s.nullish(),
  bounty: z.object({ attacker: s.nullish(), defender: s.nullish() }).passthrough().nullish(),
  round: z.object({ number: n.nullish(), status: s.nullish(), attackerDamage: s.nullish(), defenderDamage: s.nullish(), attackerPoints: n.nullish(), defenderPoints: n.nullish(), nextTickAt: s.nullish() }).passthrough().nullish(),
}).passthrough();
export type Battle = z.infer<typeof battleSchema>;

export const allianceSchema = z.object({
  id: s.min(1), name: s.min(1), scheme: s.nullish(), status: s.nullish(), leaderCountryId: s.nullish(),
  members: z.array(s).nullish(), memberCount: n.nullish(), development: n.nullish(), sharePercent: n.nullish(),
  damageBonusPercent: n.nullish(), createdAt: s.nullish(), disbandedAt: s.nullish(),
}).passthrough();
export type Alliance = z.infer<typeof allianceSchema>;

export const citizenSchema = z.object({
  id: s.min(1), username: s.min(1), avatarUrl: s.nullish(), level: n.nullish(), countryId: s.nullish(),
  homeRegionId: s.nullish(), regionId: s.nullish(), lastActiveAt: s.nullish(), active: z.boolean().nullish(),
}).passthrough();
export type Citizen = z.infer<typeof citizenSchema>;

export const rankingRowSchema = z.object({
  rank: n, subjectType: s, subjectId: s, name: s, countryId: s.nullish(), avatarUrl: s.nullish(), value: s,
}).passthrough();
export type RankingRow = z.infer<typeof rankingRowSchema>;

export const historyItemSchema = z.object({
  key: s, type: s, at: s, regionId: s.nullish(), countryIds: z.array(s).nullish(), summary: s.nullish(), link: s.nullish(),
}).passthrough();
export type HistoryItem = z.infer<typeof historyItemSchema>;

export const articleSchema = z.object({
  id: s.min(1), title: s, excerpt: s.nullish(), category: s.nullish(), language: s.nullish(), countryId: s.nullish(), official: z.boolean().nullish(),
  publishedAt: s.nullish(), views: n.nullish(), score: n.nullish(), commentCount: n.nullish(), newspaperId: s.nullish(), newspaperName: s.nullish(),
  authorId: s.nullish(), authorName: s.nullish(), authorAvatarUrl: s.nullish(),
}).passthrough();
export type Article = z.infer<typeof articleSchema>;

export const leaderboardSchema = z.object({ id: s, label: s, subjectType: s.nullish(), metric: s.nullish(), grain: s.nullish() }).passthrough();
export type Leaderboard = z.infer<typeof leaderboardSchema>;

/** The country summary is large; only the parts the profile page uses are typed. */
const holderSchema = z.object({ role: s, label: s.nullish(), userId: s.nullish(), username: s.nullish(), avatarUrl: s.nullish(), level: n.nullish(), startedAt: s.nullish(), party: z.object({ id: s, name: s }).passthrough().nullish() }).passthrough();
export type Holder = z.infer<typeof holderSchema>;
export const profileSchema = z.object({
  id: s, name: s, scheme: s.nullish(), discordUrl: s.nullish(), capitalRegionId: s.nullish(), capitalHeld: z.boolean().nullish(),
  coreRegions: z.array(z.object({ id: s, name: s, controlledBy: s.nullish(), lost: z.boolean().nullish(), isCapital: z.boolean().nullish(), development: n.nullish() }).passthrough()).nullish(),
  controlledRegions: z.array(z.object({ id: s, name: s, coreCountryId: s.nullish(), occupied: z.boolean().nullish(), isCapital: z.boolean().nullish(), development: n.nullish() }).passthrough()).nullish(),
  citizens: z.object({ active: n.nullish(), total: n.nullish(), inactiveAfterDays: n.nullish(), activeMinLevel: n.nullish() }).passthrough().nullish(),
  development: n.nullish(), worldDevelopment: n.nullish(), worldSharePercent: n.nullish(),
  developmentHistory: z.array(z.object({ dayKey: s, development: n, activeCitizens: n.nullish(), regionCount: n.nullish() }).passthrough()).nullish(),
  taxes: z.object({ income: n.nullish(), market: n.nullish(), selfWork: n.nullish(), production: n.nullish(), max: n.nullish(), revenueToday: s.nullish(), revenueYesterday: s.nullish() }).passthrough().nullish(),
  treasury: z.object({ money: s.nullish(), resources: z.record(s, n).nullish() }).passthrough().nullish(),
  government: z.object({ holders: z.array(holderSchema).nullish(), wage: z.object({ presidentPercent: n.nullish(), memberPercent: n.nullish(), period: s.nullish() }).passthrough().nullish() }).passthrough().nullish(),
  rulingParty: z.object({ id: s, name: s, choices: z.array(s).nullish(), effects: z.record(s, n).nullish() }).passthrough().nullish(),
  specializedItem: s.nullish(),
  wars: z.array(z.object({ id: s, otherCountryId: s, declaredBy: s.nullish(), declaredAt: s.nullish() }).passthrough()).nullish(),
  alliance: z.object({ allianceId: s, name: s, status: s.nullish(), leaderCountryId: s.nullish(), joinedAt: s.nullish() }).passthrough().nullish(),
  pacts: z.array(z.object({ id: s, otherCountryId: s, status: s.nullish(), startsAt: s.nullish() }).passthrough()).nullish(),
  enemy: z.object({ countryId: s, suspended: z.boolean().nullish(), bonusPercent: n.nullish() }).passthrough().nullish(),
}).passthrough();
export type CountryProfile = z.infer<typeof profileSchema>;

export const summarySchema = z.object({
  countryId: s, generatedAt: s.nullish(), profile: profileSchema,
  battles: z.array(z.unknown()).nullish(),
  embassies: z.object({ abroad: z.array(z.object({ countryId: s, openedAt: s.nullish(), mutual: z.boolean().nullish() }).passthrough()).nullish(), hosted: z.array(z.object({ countryId: s, openedAt: s.nullish(), mutual: z.boolean().nullish() }).passthrough()).nullish() }).passthrough().nullish(),
  elections: z.object({ open: z.array(z.unknown()).nullish(), finished: z.array(z.object({ id: s, kind: s.nullish(), label: s.nullish(), finishedAt: s.nullish(), seats: n.nullish(), candidates: n.nullish(), winners: z.array(z.object({ userId: s, username: s }).passthrough()).nullish() }).passthrough()).nullish() }).passthrough().nullish(),
  openLaws: z.object({ proposals: z.array(z.unknown()).nullish() }).passthrough().nullish(),
  announcements: z.array(z.unknown()).nullish(),
}).passthrough();
export type CountrySummary = z.infer<typeof summarySchema>;

export const memberSchema = z.object({
  role: s, userId: s.nullish(), username: s.nullish(), avatarUrl: s.nullish(), level: n.nullish(), startedAt: s.nullish(), label: s.nullish(),
  party: z.object({ id: s, name: s }).passthrough().nullish(),
}).passthrough();
export type GovMember = z.infer<typeof memberSchema>;

export const governmentSchema = z.object({
  rulingParty: z.object({ id: s, name: s }).passthrough().nullish(),
  congressSeats: n.nullish(),
  active: z.object({
    choices: z.array(z.object({ axis: s, code: s, level: n.nullish(), fanatic: z.boolean().nullish(), effects: z.record(s, n).nullish() }).passthrough()).nullish(),
  }).passthrough().nullish(),
}).passthrough();
export type Government = z.infer<typeof governmentSchema>;

/** One row of GET /countries/{id}/government/history (verified against tests/fixtures/real/government-history-eg.json). */
export const governmentHistorySchema = z.object({
  id: s, role: s, userId: s.nullish(), username: s.nullish(), source: s.nullish(), startedAt: s.nullish(), endedAt: s.nullish(), endReason: s.nullish(), label: s.nullish(),
}).passthrough();
export type GovernmentHistoryRow = z.infer<typeof governmentHistorySchema>;
