import { notFound } from "next/navigation";
import { ApiErrorState } from "@/components/ApiErrorState";
import { Provenance } from "@/components/Provenance";
import { StateMessage } from "@/components/StateMessage";
import { getDisplay } from "@/features/entities/display.server";
import { RegionHeader } from "@/features/regions/RegionHeader";
import { RegionOverview } from "@/features/regions/RegionOverview";
import { getLocale, getMessages } from "@/i18n";
import { getRegionDetail } from "@/lib/data/regions";

export const dynamic = "force-dynamic";
const safe = (v: string) => /^[A-Za-z0-9_-]{1,80}$/.test(v);

export default async function RegionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!safe(id)) notFound();
  const m = getMessages(await getLocale());
  let res;
  try { res = await getRegionDetail(id); } catch (e) { return <><h1>{m.nav.regions}</h1><ApiErrorState error={e} retryLabel={m.common.retry} /></>; }
  const names = res.region?.name ? { [id]: res.region.name } : undefined;
  const d = await getDisplay({ regionNames: names });
  if (!res.region) return <><RegionHeader id={id} region={null} current="overview" d={d} m={m} /><StateMessage tone="empty" title={m.regionPage.notFound} detail={m.regionPage.notRecognised} /></>;
  return (
    <>
      <RegionHeader id={id} region={res.region} current="overview" d={d} m={m} />
      <RegionOverview region={res.region} d={d} m={m} nowMs={Date.now()} />
      <Provenance meta={res.meta} m={m} />
    </>
  );
}
