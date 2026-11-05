import { getActiveCitizenIds, loadBuilds } from "@/lib/data/players";
import type { Messages } from "@/i18n/messages";
import { summarizeBuilds, type BuildCounts } from "./classify";
import s from "./BuildMix.module.css";

const KINDS = ["war", "eco", "hybrid"] as const;

/** WAR / ECO / HYBRID player counts, nothing else. Shows "—" (never a misleading 0) while loading or when no player could be classified. */
export function BuildMixView({ counts, m, nl, pending }: { counts: BuildCounts | null; m: Messages["builds"]; nl: string; pending?: boolean }) {
  if (counts && counts.total === 0) return null;
  const known = !!counts && counts.classified > 0;
  const nf = new Intl.NumberFormat(nl);
  return (
    <ul className={s.mix} data-state={pending ? "pending" : known ? "ready" : "unavailable"} aria-busy={pending || undefined}>
      {KINDS.map((k) => <li key={k} data-k={k}><b>{known && counts ? nf.format(counts[k]) : "—"}</b><span>{m[k]}</span></li>)}
    </ul>
  );
}

export const BuildMixSkeleton = ({ m, nl }: { m: Messages["builds"]; nl: string }) => <BuildMixView counts={null} m={m} nl={nl} pending />;

/** A group of players (unit members, party members...). Uses the capped, cached census loader. */
export async function BuildMix({ ids, m, nl }: { ids: readonly string[]; m: Messages["builds"]; nl: string }) {
  const load = await loadBuilds(ids);
  return <BuildMixView counts={summarizeBuilds(ids, load.results)} m={m} nl={nl} />;
}

/** Countries and alliances: their ACTIVE citizens. */
export async function OrgBuildMix({ countryIds, m, nl }: { countryIds: readonly string[]; m: Messages["builds"]; nl: string }) {
  const lists = await Promise.allSettled(countryIds.map((id) => getActiveCitizenIds(id)));
  const ids = lists.flatMap((l) => (l.status === "fulfilled" ? l.value : []));
  return <BuildMix ids={ids} m={m} nl={nl} />;
}
