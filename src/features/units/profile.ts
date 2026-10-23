import type { UnitMember } from "@/lib/domain/unit-detail";

/** Pure calculations for the unit profile. Every output here is CALCULATED from the listed members, not an API value. */
const big = (s: string | null): bigint | null => (s === null ? null : BigInt(s));

export interface MemberSummary {
  count: number;
  online: number;
  /** Members with a known presence flag (online may be unknown for some). */
  onlineKnown: number;
  roles: Record<string, number>;
  byCountry: { countryId: string; count: number }[];
  /** Sum of the listed members' own figures. NOT the unit's reported total (see unit-detail verification note). */
  combinedWeekly: bigint;
  combinedLifetime: bigint;
  averageLevel: number | null;
}

export function summarizeMembers(members: readonly UnitMember[]): MemberSummary {
  const roles: Record<string, number> = {};
  const countries = new Map<string, number>();
  let online = 0, onlineKnown = 0, weekly = 0n, life = 0n, lvlSum = 0, lvlN = 0;
  for (const m of members) {
    roles[m.role] = (roles[m.role] ?? 0) + 1;
    if (m.countryId) countries.set(m.countryId, (countries.get(m.countryId) ?? 0) + 1);
    if (m.online !== null) { onlineKnown++; if (m.online) online++; }
    weekly += big(m.weeklyDamage) ?? 0n;
    life += big(m.totalDamage) ?? 0n;
    if (m.level !== null) { lvlSum += m.level; lvlN++; }
  }
  return {
    count: members.length, online, onlineKnown, roles,
    byCountry: [...countries].map(([countryId, count]) => ({ countryId, count })).sort((a, b) => b.count - a.count || a.countryId.localeCompare(b.countryId)),
    combinedWeekly: weekly, combinedLifetime: life, averageLevel: lvlN ? Math.round((lvlSum / lvlN) * 10) / 10 : null,
  };
}

export type MemberSortKey = "name" | "role" | "level" | "country" | "weekly" | "lifetime" | "active" | "joined";
const ROLE_RANK: Record<string, number> = { owner: 0, commander: 1, member: 2 };
const cmpBig = (a: bigint | null, b: bigint | null): number => (a === b ? 0 : a === null ? -1 : b === null ? 1 : a < b ? -1 : 1);
const cmpStr = (a: string | null, b: string | null): number => (a ?? "").localeCompare(b ?? "");

/** Stable sort; missing values sort last when descending and first when ascending (never treated as zero). */
export function sortMembers(members: readonly UnitMember[], key: MemberSortKey, dir: 1 | -1): UnitMember[] {
  const cmp = (a: UnitMember, b: UnitMember): number => {
    switch (key) {
      case "name": return a.name.localeCompare(b.name);
      case "role": return (ROLE_RANK[a.role] ?? 9) - (ROLE_RANK[b.role] ?? 9);
      case "level": return (a.level ?? -1) - (b.level ?? -1);
      case "country": return cmpStr(a.countryId, b.countryId);
      case "weekly": return cmpBig(big(a.weeklyDamage), big(b.weeklyDamage));
      case "lifetime": return cmpBig(big(a.totalDamage), big(b.totalDamage));
      case "active": return cmpStr(a.lastActiveAt, b.lastActiveAt);
      case "joined": return cmpStr(a.joinedAt, b.joinedAt);
    }
  };
  return members.map((m, i) => ({ m, i })).sort((x, y) => dir * cmp(x.m, y.m) || x.i - y.i).map((x) => x.m);
}

/** Width (0..100) of a member's weekly bar relative to the largest listed weekly value. Unknown -> null (no bar, not zero). */
export function barPercent(value: string | null, max: bigint): number | null {
  const v = big(value);
  if (v === null || max <= 0n) return null;
  return Number((v * 1000n) / max) / 10;
}

export const maxWeekly = (members: readonly UnitMember[]): bigint => members.reduce((m, x) => { const v = big(x.weeklyDamage); return v !== null && v > m ? v : m; }, 0n);
