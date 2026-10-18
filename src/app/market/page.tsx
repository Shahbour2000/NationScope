import Link from "next/link";
import { ApiErrorState } from "@/components/ApiErrorState";
import { Icon } from "@/components/Icon";
import { Provenance } from "@/components/Provenance";
import { Source } from "@/features/entities/entities";
import { getDisplay } from "@/features/entities/display.server";
import { MarketTable } from "@/features/market/MarketTable";
import { getLocale, getMessages } from "@/i18n";
import { getMarket } from "@/lib/data/economy";

export const dynamic = "force-dynamic";

export default async function MarketPage() {
  const m = getMessages(await getLocale());
  const e = m.economyPage;
  let res;
  try { res = await getMarket(); } catch (err) { return <ApiErrorState error={err} retryLabel={m.common.retry} />; }
  const d = await getDisplay();
  return (
    <>
      <div className="page-head"><h1><Icon name="chart" size={26} />{e.marketTitle}</h1><Source kind="api" d={d} /></div>
      <p className="note">{e.marketHint} <Link href="/economy">{e.economyHub}</Link></p>
      <MarketTable rows={res.rows} d={d} m={e} />
      <p className="hint">{e.widestNote}</p>
      <Provenance meta={res.meta} m={m} note={m.ui.iconNote} />
    </>
  );
}
