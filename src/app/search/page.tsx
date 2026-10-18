import { ApiErrorState } from "@/components/ApiErrorState";
import { Provenance } from "@/components/Provenance";
import { StateMessage } from "@/components/StateMessage";
import { getDisplay } from "@/features/entities/display.server";
import { DataView } from "@/features/explorer/DataView";
import { getLocale, getMessages } from "@/i18n";
import { searchEntities } from "@/lib/data/search";

export const dynamic = "force-dynamic";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const m = getMessages(await getLocale());
  const q = ((await searchParams).q ?? "").trim();
  if (q.length < 2) {
    return (<><h1>{m.explorer.searchTitle}</h1><StateMessage tone="empty" title={m.explorer.searchTitle} detail={m.explorer.searchHint} /></>);
  }
  let result;
  try {
    result = await searchEntities(q);
  } catch (error) {
    return (<><h1>{m.explorer.searchTitle}</h1><ApiErrorState error={error} retryLabel={m.common.retry} /></>);
  }
  const d = await getDisplay();
  return (
    <>
      <h1>{m.explorer.searchTitle}</h1>
      <p className="note">{m.explorer.searchFor} “{q}”. {m.explorer.genericNote}</p>
      <DataView data={result.data} section={null} detailLinks={false} labels={m.explorer} d={d} />
      <Provenance meta={result.meta} m={m} />
    </>
  );
}
