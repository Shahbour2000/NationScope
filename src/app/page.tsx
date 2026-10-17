import Link from "next/link";
import { Suspense } from "react";
import { StateMessage } from "@/components/StateMessage";
import { CountTile, RecentEvents, TileSkeleton, TopUnits, UnitsTile } from "@/features/overview/tiles";
import { getLocale, getMessages, numberLocale } from "@/i18n";
import { ConfigError, getConfig } from "@/lib/config/env";
import { endpoints } from "@/lib/api/endpoints";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const locale = await getLocale();
  const m = getMessages(locale);
  try {
    getConfig();
  } catch (error) {
    if (error instanceof ConfigError) return <StateMessage tone="error" title="Configuration problem" detail={error.message} />;
    throw error;
  }
  const ctx = { m, locale: numberLocale(locale) };
  const t = m.overview.tiles;
  const fallback = <TileSkeleton />;
  return (
    <>
      <h1>{m.overview.title}</h1>
      <p className="note">{m.overview.intro}</p>

      <div className="tiles">
        <Suspense fallback={fallback}><CountTile title={t.countries} href="/countries" endpoint={endpoints.countries()} ctx={ctx} /></Suspense>
        <Suspense fallback={fallback}><CountTile title={t.alliances} href="/alliances" endpoint={endpoints.alliances()} ctx={ctx} /></Suspense>
        <Suspense fallback={fallback}><CountTile title={t.regions} href="/regions" endpoint={endpoints.regions()} ctx={ctx} /></Suspense>
        <Suspense fallback={fallback}><UnitsTile ctx={ctx} /></Suspense>
        <Suspense fallback={fallback}><CountTile title={t.activeWars} href="/wars" endpoint={endpoints.wars({ status: "active" })} ctx={ctx} /></Suspense>
        <Suspense fallback={fallback}><CountTile title={t.activeBattles} href="/battles" endpoint={endpoints.battles({ status: "active", limit: 100 })} capAt={100} ctx={ctx} /></Suspense>
        <Suspense fallback={fallback}><CountTile title={t.marketItems} href="/market" endpoint={endpoints.market()} ctx={ctx} /></Suspense>
        <Suspense fallback={fallback}><CountTile title={t.jobs} href="/jobs" endpoint={endpoints.jobs()} ctx={ctx} /></Suspense>
        <Suspense fallback={fallback}><CountTile title={t.tournaments} href="/tournaments" endpoint={endpoints.tournaments()} ctx={ctx} /></Suspense>
      </div>
      <p className="note">{m.overview.note}</p>

      <div className="section-head"><h2>{m.overview.topUnits}</h2><Link href="/units">{m.overview.viewAll}</Link></div>
      <Suspense fallback={<div className="skeleton" style={{ blockSize: "8rem" }} />}><TopUnits ctx={ctx} /></Suspense>

      <div className="section-head"><h2>{m.overview.recentEvents}</h2><Link href="/history">{m.overview.viewAll}</Link></div>
      <Suspense fallback={<div className="skeleton" style={{ blockSize: "8rem" }} />}><RecentEvents ctx={ctx} /></Suspense>
    </>
  );
}
