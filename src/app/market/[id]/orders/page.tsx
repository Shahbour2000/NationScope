import { notFound } from "next/navigation";
import { ApiErrorState } from "@/components/ApiErrorState";
import { Provenance } from "@/components/Provenance";
import { getDisplay } from "@/features/entities/display.server";
import { OrderBookView, AsReturned, MarketItemHeader } from "@/features/market/MarketItemViews";
import { getLocale, getMessages } from "@/i18n";
import { getItemOrders } from "@/lib/data/market-item";

export const dynamic = "force-dynamic";
const safe = (v: string) => /^[A-Za-z0-9_-]{1,80}$/.test(v);

export default async function ItemOrdersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!safe(id)) notFound();
  const m = getMessages(await getLocale());
  const d = await getDisplay();
  const header = <MarketItemHeader item={id} current="orders" d={d} m={m} />;
  let res;
  try { res = await getItemOrders(id); } catch (e) { return <>{header}<ApiErrorState error={e} retryLabel={m.common.retry} /></>; }
  return (
    <>
      {header}
      {res.book ? <OrderBookView book={res.book} d={d} m={m} /> : <AsReturned data={res.raw} d={d} m={m} />}
      <Provenance meta={res.meta} m={m} />
    </>
  );
}
