import { Suspense } from "react";
import { Icon } from "@/components/Icon";
import { Info } from "@/components/Info";
import { CompaniesSection, FloorSection, JobsSection, MarketSection, TradesSection } from "@/features/economy/sections";
import { getDisplay } from "@/features/entities/display.server";
import { getLocale, getMessages } from "@/i18n";

export const dynamic = "force-dynamic";
const Skel = () => <div className="card"><div className="skeleton" style={{ inlineSize: "40%" }} /><div className="skeleton" style={{ blockSize: "6rem" }} /></div>;

export default async function EconomyPage() {
  const m = getMessages(await getLocale());
  const d = await getDisplay();
  return (
    <>
      <div className="page-head"><h1><Icon name="chart" size={26} />{m.economyPage.title}</h1></div>
      <p className="note">{m.economyPage.intro}</p>
      <p className="hint">{m.economyPage.historyNote}</p>
      <Info title={m.economyPage.howTitle}><ul>{m.economyPage.how.map((t) => <li key={t}>{t}</li>)}</ul><p>{m.economyPage.howLimits}</p></Info>
      <div className="cols">
        <Suspense fallback={<Skel />}><MarketSection d={d} m={m} /></Suspense>
        <Suspense fallback={<Skel />}><TradesSection d={d} m={m} /></Suspense>
      </div>
      <div className="cols">
        <Suspense fallback={<Skel />}><JobsSection d={d} m={m} /></Suspense>
        <Suspense fallback={<Skel />}><CompaniesSection d={d} m={m} /></Suspense>
      </div>
      <Suspense fallback={<Skel />}><FloorSection d={d} m={m} /></Suspense>
      <p className="hint">{m.ui.iconNote}</p>
    </>
  );
}
