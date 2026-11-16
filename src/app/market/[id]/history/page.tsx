import { notFound } from "next/navigation";
import { ApiErrorState } from "@/components/ApiErrorState";
import { Provenance } from "@/components/Provenance";
import { getDisplay } from "@/features/entities/display.server";
import { HistoryView, AsReturned, MarketItemHeader } from "@/features/market/MarketItemViews";
import { getLocale, getMessages } from "@/i18n";
import { getItemHistory } from "@/lib/data/market-item";
import { isEmptyList } from "@/lib/domain/market-item";

export const dynamic = "force-dynamic";
const safe = (v: string) => /^[A-Za-z0-9_-]{1,80}$/.test(v);

export default async function ItemHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!safe(id)) notFound();
  const m = getMessages(await getLocale());
  const d = await getDisplay();
  const header = <MarketItemHeader item={id} current="history" d={d} m={m} />;
  let res;
  try { res = await getItemHistory(id); } catch (e) { return <>{header}<ApiErrorState error={e} retryLabel={m.common.retry} /></>; }
  return (
    <>
      {header}
      {res.history ? <HistoryView history={res.history} d={d} m={m} /> : isEmptyList(res.raw) ? <p>{m.marketItem.noHistory}</p> : <AsReturned data={res.raw} d={d} m={m} />}
      <Provenance meta={res.meta} m={m} />
    </>
  );
}
