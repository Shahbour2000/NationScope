import Link from "next/link";
import { Suspense } from "react";
import { Icon } from "@/components/Icon";
import { StateMessage } from "@/components/StateMessage";
import { getDisplay } from "@/features/entities/display.server";
import { DevelopmentLeaders, OverviewTile, RecentEvents, TileSkeleton, TopPlayers, TopUnits } from "@/features/overview/tiles";
import { getLocale, getMessages } from "@/i18n";
import { ConfigError, getConfig } from "@/lib/config/env";

export const dynamic = "force-dynamic";
const Block = () => <div className="skeleton" style={{ blockSize: "8rem" }} />;

export default async function OverviewPage() {
  const m = getMessages(await getLocale());
  try {
    getConfig();
  } catch (error) {
    if (error instanceof ConfigError) return <StateMessage tone="error" title="Configuration problem" detail={error.message} />;
    throw error;
  }
  const d = await getDisplay();
  const ctx = { m, d };
  const o = m.overview;
  const kinds = ["countries", "alliances", "units", "wars", "battles", "companies", "market", "jobs"] as const;
  return (
    <>
      <div className="page-head"><h1><Icon name="globe" size={26} />{o.title}</h1></div>
      <p className="note">{o.intro}</p>
      <div className="tiles">
        {kinds.map((k) => <Suspense key={k} fallback={<TileSkeleton />}><OverviewTile kind={k} ctx={ctx} /></Suspense>)}
      </div>
      <p className="hint">{o.note}</p>

      <div className="cols">
        <section className="card">
          <h2><Icon name="trend" size={18} />{o.developmentLeaders}</h2>
          <Suspense fallback={<Block />}><DevelopmentLeaders ctx={ctx} /></Suspense>
          <p className="hint"><Link href="/countries">{o.viewAll}</Link></p>
        </section>
        <section className="card">
          <h2><Icon name="trophy" size={18} />{o.topPlayers}</h2>
          <Suspense fallback={<Block />}><TopPlayers ctx={ctx} /></Suspense>
          <p className="hint"><Link href="/rankings/playerDamage">{o.viewAll}</Link></p>
        </section>
        <section className="card">
          <h2><Icon name="unit" size={18} />{o.topUnits}</h2>
          <Suspense fallback={<Block />}><TopUnits ctx={ctx} /></Suspense>
          <p className="hint"><Link href="/units">{o.viewAll}</Link></p>
        </section>
        <section className="card">
          <h2><Icon name="clock" size={18} />{o.recentEvents}</h2>
          <Suspense fallback={<Block />}><RecentEvents ctx={ctx} /></Suspense>
          <p className="hint"><Link href="/history">{o.viewAll}</Link></p>
        </section>
      </div>
      <p className="hint"><Link href="/economy">{m.economyPage.economyHub}</Link></p>
    </>
  );
}
