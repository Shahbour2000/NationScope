import Link from "next/link";
import { loadBuilds } from "@/lib/data/players";
import type { Messages } from "@/i18n/messages";
import { summarizeBuilds, type BuildCounts, type BuildKind } from "./classify";
import { citizenIdsOfCountries, mixHref, type MixEntity } from "./members";
import s from "./BuildMix.module.css";

const KINDS = ["war", "eco", "hybrid"] as const;

/**
 * WAR / ECO / HYBRID player counts. Shows "—" (never a misleading 0) while loading or when no player could be classified.
 * With `link`, each count opens the list of exactly the players behind it. `partial` (classified < total) adds one muted coverage line.
 */
export function BuildMixView({ counts, m, nl, pending, link }: { counts: BuildCounts | null; m: Messages["builds"]; nl: string; pending?: boolean; link?: { entity: MixEntity; id: string } }) {
  if (counts && counts.total === 0) return null;
  const known = !!counts && counts.classified > 0;
  const nf = new Intl.NumberFormat(nl);
  const partial = known && counts && counts.classified < counts.total;
  return (
    <div className={s.wrap}>
      <ul className={s.mix} data-state={pending ? "pending" : known ? "ready" : "unavailable"} aria-busy={pending || undefined}>
        {KINDS.map((k: BuildKind) => {
          const inner = <><b>{known && counts ? nf.format(counts[k]) : "\u2014"}</b><span>{m[k]}</span></>;
          return <li key={k} data-k={k}>{link && known ? <Link href={mixHref(link.entity, link.id, k)} className={s.hit} title={m.openList.replace("{kind}", m[k])}>{inner}</Link> : inner}</li>;
        })}
      </ul>
      {partial && counts ? <small className={s.cov}>{m.classifiedOf.replace("{c}", nf.format(counts.classified)).replace("{n}", nf.format(counts.total))}</small> : null}
    </div>
  );
}

export const BuildMixSkeleton = ({ m, nl }: { m: Messages["builds"]; nl: string }) => <BuildMixView counts={null} m={m} nl={nl} pending />;

/** A group of players (unit members, party members...). Uses the capped, cached census loader. */
export async function BuildMix({ ids, m, nl, link }: { ids: readonly string[]; m: Messages["builds"]; nl: string; link?: { entity: MixEntity; id: string } }) {
  const load = await loadBuilds(ids);
  return <BuildMixView counts={summarizeBuilds(ids, load.results)} m={m} nl={nl} {...(link ? { link } : {})} />;
}

/** Countries and alliances: their ACTIVE citizens, resolved by the same loader the member list uses. */
export async function OrgBuildMix({ countryIds, m, nl, link }: { countryIds: readonly string[]; m: Messages["builds"]; nl: string; link: { entity: MixEntity; id: string } }) {
  const { ids } = await citizenIdsOfCountries(countryIds, link.entity === "country" ? 5 : 1);
  return <BuildMix ids={ids} m={m} nl={nl} link={link} />;
}
