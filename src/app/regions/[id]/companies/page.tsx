import { notFound } from "next/navigation";
import { ApiErrorState } from "@/components/ApiErrorState";
import { Provenance } from "@/components/Provenance";
import { getDisplay } from "@/features/entities/display.server";
import { RegionCompaniesView } from "@/features/regions/RegionCompaniesView";
import { RegionHeader } from "@/features/regions/RegionHeader";
import { getLocale, getMessages } from "@/i18n";
import { getRegionCompanies, getRegionDetail } from "@/lib/data/regions";
import { parseCompanySort } from "@/lib/domain/region-detail";

export const dynamic = "force-dynamic";
const safe = (v: string) => /^[A-Za-z0-9_-]{1,80}$/.test(v);

export default async function RegionCompaniesPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ item?: string; sort?: string }> }) {
  const { id } = await params;
  if (!safe(id)) notFound();
  const q = await searchParams;
  const m = getMessages(await getLocale());
  const [co, rg] = await Promise.allSettled([getRegionCompanies(id), getRegionDetail(id)]);
  const region = rg.status === "fulfilled" ? rg.value.region : null;
  const d = await getDisplay({ regionNames: region?.name ? { [id]: region.name } : undefined });
  const header = <RegionHeader id={id} region={region} current="companies" d={d} m={m} />;
  if (co.status === "rejected") return <>{header}<ApiErrorState error={co.reason} retryLabel={m.common.retry} /></>;
  const item = typeof q.item === "string" && safe(q.item) ? q.item : null;
  return (
    <>
      {header}
      <h2 className="sr-only">{m.regionPage.c.title}</h2>
      <RegionCompaniesView rows={co.value.rows} skipped={co.value.skipped} item={item} sort={parseCompanySort(q.sort)} basePath={`/regions/${encodeURIComponent(id)}/companies`} d={d} m={m} />
      <Provenance meta={co.value.meta} m={m} />
    </>
  );
}
