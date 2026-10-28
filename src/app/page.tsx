import Link from "next/link";
import { Suspense } from "react";
import { Icon } from "@/components/Icon";
import { StateMessage } from "@/components/StateMessage";
import { getDisplay } from "@/features/entities/display.server";
import { HeroKpi, KpiSkeleton, LatestEvents, TopCountries, TopPlayers, WorldStats } from "@/features/overview/sections";
import { getLocale, getMessages } from "@/i18n";
import { ConfigError, getConfig } from "@/lib/config/env";

export const dynamic = "force-dynamic";
const Block = ({ h = "9rem" }: { h?: string }) => <div className="skeleton" style={{ blockSize: h }} />;

export default async function OverviewPage() {
  const m = getMessages(await getLocale());
  try { getConfig(); } catch (error) {
    if (error instanceof ConfigError) return <StateMessage tone="error" title="Configuration problem" detail={error.message} />;
    throw error;
  }
  const d = await getDisplay();
  const ctx = { m, d };
  const o = m.overview;
  const more = (href: string) => <Link className="viewall" href={href}>{o.viewAll} <Icon name="chevronr" size={14} /></Link>;
  return (
    <div className="home">
      <section className="hero" aria-labelledby="hero-h">
        <div className="hero-copy">
          <p className="hero-kicker">{o.welcome}</p>
          <h1 id="hero-h" className="hero-title" dir="ltr">Nation<b>Scope</b></h1>
          <p className="hero-lead">{o.tagline}</p>
          <div className="kpis">
            {(["countries", "wars", "alliances", "citizens"] as const).map((k) => <Suspense key={k} fallback={<KpiSkeleton />}><HeroKpi kind={k} ctx={ctx} /></Suspense>)}
          </div>
        </div>
        {/* decorative; empty alt */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="hero-globe" src="/brand/hero-globe.svg" alt="" width={420} height={420} />
      </section>

      <div className="home-grid">
        <section className="panel p-countries"><header><h2>{o.topCountries}</h2>{more("/rankings/countryDamage")}</header><Suspense fallback={<Block />}><TopCountries ctx={ctx} /></Suspense></section>
        <section className="panel p-players"><header><h2>{o.topPlayers}</h2>{more("/rankings/playerDamage")}</header><Suspense fallback={<Block />}><TopPlayers ctx={ctx} /></Suspense></section>
        <section className="panel p-events"><header><h2>{o.recentEvents}</h2>{more("/history")}</header><Suspense fallback={<Block />}><LatestEvents ctx={ctx} /></Suspense></section>
        <section className="panel p-stats"><header><h2>{o.worldStats}</h2></header><Suspense fallback={<Block />}><WorldStats ctx={ctx} /></Suspense></section>
      </div>
    </div>
  );
}
