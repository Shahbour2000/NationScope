import { notFound } from "next/navigation";
import { ApiErrorState } from "@/components/ApiErrorState";
import { Pager } from "@/components/Pager";
import { Provenance } from "@/components/Provenance";
import { StateMessage } from "@/components/StateMessage";
import { DEFAULT_PAGE_SIZE, SECTIONS, parseOffset } from "@/features/explorer/catalog";
import { getDisplay } from "@/features/entities/display.server";
import { DataView } from "@/features/explorer/DataView";
import { listOf } from "@/features/explorer/shape";
import { getLocale, getMessages } from "@/i18n";
import { fetchEndpoint } from "@/lib/data/explore";

export const dynamic = "force-dynamic";

export default async function SectionPage({ params, searchParams }: { params: Promise<{ section: string }>; searchParams: Promise<{ offset?: string }> }) {
  const { section } = await params;
  const def = SECTIONS[section];
  if (!def) notFound();
  const m = getMessages(await getLocale());
  const title = (m.explorer.sections as Record<string, string>)[section] ?? section;
  if (!def.list) {
    return (<><h1>{title}</h1><StateMessage tone="empty" title={title} detail={m.explorer.detailOnly} /></>);
  }
  const pageSize = def.pageSize ?? DEFAULT_PAGE_SIZE;
  const offset = def.paged ? parseOffset((await searchParams).offset) : 0;
  let result;
  try {
    result = await fetchEndpoint(def.list({ limit: pageSize, offset }));
  } catch (error) {
    return (<><h1>{title}</h1><ApiErrorState error={error} retryLabel={m.common.retry} /></>);
  }
  const d = await getDisplay();
  const rowCount = listOf(result.data)?.rows.length ?? 0;
  return (
    <>
      <h1>{title}</h1>
      <p className="note">{m.explorer.genericNote} {m.explorer.linksNote}</p>
      <DataView data={result.data} section={section} detailLinks={!!def.detail || !!def.linkRows} labels={m.explorer} d={d} />
      {def.paged && <Pager basePath={`/${section}`} offset={offset} pageSize={pageSize} rowCount={rowCount} prev={m.explorer.prev} next={m.explorer.next} />}
      <Provenance meta={result.meta} m={m} />
    </>
  );
}
