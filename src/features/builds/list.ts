import type { BuildLoad } from "@/lib/data/players";
import { summarizeBuilds, type BuildCounts, type BuildKind } from "./classify";
import type { MemberListRow } from "./MembersTable";

/**
 * Members of `ids` whose existing classification equals `kind`, with the counts for all three kinds computed from the same results
 * (so the tabs, the overview counts and the list agree by construction).
 */
export function classifyKinds(ids: readonly string[], load: BuildLoad, kind: BuildKind): { rows: Omit<MemberListRow, "countryName">[]; counts: BuildCounts } {
  const counts = summarizeBuilds(ids, load.results);
  const rows: Omit<MemberListRow, "countryName">[] = [];
  for (const id of new Set(ids)) {
    const r = load.results.get(id), i = load.info.get(id);
    if (!r || r.kind !== kind || !i) continue;
    rows.push({ id, name: i.name, avatar: i.avatar, level: i.level, countryId: i.countryId, warShare: r.warShare, ecoShare: r.ecoShare });
  }
  return { rows, counts };
}
