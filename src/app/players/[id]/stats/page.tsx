import Link from "next/link";
import { notFound } from "next/navigation";
import { ApiErrorState } from "@/components/ApiErrorState";
import { PageHero } from "@/components/PageHero";
import { Provenance } from "@/components/Provenance";
import { getDisplay } from "@/features/entities/display.server";
import { DataView } from "@/features/explorer/DataView";
import { StatsView } from "@/features/players/StatsView";
import { getLocale, getMessages } from "@/i18n";
import { getPlayerStats } from "@/lib/data/player-stats";

export const dynamic = "force-dynamic";
const safe = (v: string) => /^[A-Za-z0-9_-]{1,80}$/.test(v);

export default async function PlayerStatsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!safe(id)) notFound();
  const m = getMessages(await getLocale());
  const t = m.playerStats;
  let res;
  try { res = await getPlayerStats(id); } catch (e) { return <ApiErrorState error={e} retryLabel={m.common.retry} />; }
  const d = await getDisplay();
  const profile = `/players/${encodeURIComponent(id)}`;
  const name = res.stats?.username;
  return (
    <>
      <PageHero icon="chart" kicker={t.kicker} title={name ? t.title.replace("{name}", name) : t.titleUnknown} sub={t.sub}
        actions={<><Link className="btn-ghost" href={profile}>{t.back}</Link><Link className="btn-ghost" href={`${profile}/companies`}>{t.companiesLink}</Link></>} />
      {res.stats ? <StatsView stats={res.stats} d={d} m={m} /> : <><p className="res-note">{t.unrecognised}</p><DataView data={res.raw} section={null} detailLinks={false} labels={m.explorer} d={d} /></>}
      <Provenance meta={res.meta} m={m} />
    </>
  );
}
