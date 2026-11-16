import { notFound, redirect } from "next/navigation";

const safe = (v: string) => /^[A-Za-z0-9_-]{1,80}$/.test(v);
/** An item's market opens on its order book. */
export default async function MarketItemIndex({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!safe(id)) notFound();
  redirect(`/market/${encodeURIComponent(id)}/orders`);
}
