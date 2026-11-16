import { notFound } from "next/navigation";
import { ApiErrorState } from "@/components/ApiErrorState";
import { Provenance } from "@/components/Provenance";
import { getDisplay } from "@/features/entities/display.server";
import { CampaignView } from "@/features/regions/CampaignView";
import { RegionHeader } from "@/features/regions/RegionHeader";
import { getLocale, getMessages } from "@/i18n";
import { getRegionCampaign, getRegionDetail } from "@/lib/data/regions";

export const dynamic = "force-dynamic";
const safe = (v: string) => /^[A-Za-z0-9_-]{1,80}$/.test(v);

export default async function RegionCampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!safe(id)) notFound();
  const m = getMessages(await getLocale());
  const [ca, rg] = await Promise.allSettled([getRegionCampaign(id), getRegionDetail(id)]);
  const region = rg.status === "fulfilled" ? rg.value.region : null;
  const d = await getDisplay({ regionNames: region?.name ? { [id]: region.name } : undefined });
  const header = <RegionHeader id={id} region={region} current="battles" d={d} m={m} />;
  if (ca.status === "rejected") return <>{header}<ApiErrorState error={ca.reason} retryLabel={m.common.retry} /></>;
  return (
    <>
      {header}
      <h2 className="sr-only">{m.regionPage.b.title}</h2>
      <CampaignView campaign={ca.value} regionId={id} d={d} m={m} />
      <Provenance meta={ca.value.meta} m={m} />
    </>
  );
}
