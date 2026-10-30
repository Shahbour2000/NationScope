import { Suspense } from "react";
import { Icon } from "@/components/Icon";
import { Info } from "@/components/Info";
import { PageHero, PanelSkeleton } from "@/components/PageHero";
import { CompaniesSection, EconomyKpis, FloorSection, JobsSection, MarketSection, TradesSection } from "@/features/economy/sections";
import { getDisplay } from "@/features/entities/display.server";
import { getLocale, getMessages } from "@/i18n";

export const dynamic = "force-dynamic";

export default async function EconomyPage() {
  const m = getMessages(await getLocale());
  const d = await getDisplay();
  const u = m.pagesUi;
  return (
    <>
      <PageHero icon="chart" kicker={u.kicker.economy} title={m.economyPage.title} sub={u.sub.economy} />
      <Suspense fallback={null}><EconomyKpis d={d} m={m} /></Suspense>
      <p className="hint">{m.economyPage.historyNote}</p>
      <Info title={m.economyPage.howTitle}><ul>{m.economyPage.how.map((t) => <li key={t}>{t}</li>)}</ul><p>{m.economyPage.howLimits}</p></Info>

      <h2 className="sec-title"><Icon name="trend" size={20} />{u.marketPulse} · {u.labour}</h2>
      <div className="grid-2">
        <Suspense fallback={<PanelSkeleton />}><MarketSection d={d} m={m} /></Suspense>
        <Suspense fallback={<PanelSkeleton />}><JobsSection d={d} m={m} /></Suspense>
      </div>

      <h2 className="sec-title"><Icon name="trend" size={20} />{m.economyPage.recentTrades}</h2>
      <Suspense fallback={<PanelSkeleton />}><TradesSection d={d} m={m} /></Suspense>

      <h2 className="sec-title"><Icon name="factory" size={20} />{u.production}</h2>
      <Suspense fallback={<PanelSkeleton />}><CompaniesSection d={d} m={m} /></Suspense>

      <h2 className="sec-title"><Icon name="box" size={20} />{m.economyPage.floorTitle}</h2>
      <Suspense fallback={<PanelSkeleton />}><FloorSection d={d} m={m} /></Suspense>
      <p className="hint">{m.ui.iconNote}</p>
    </>
  );
}
