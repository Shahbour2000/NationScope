import { ApiErrorState } from "@/components/ApiErrorState";
import { StateMessage } from "@/components/StateMessage";
import { UnitsTable } from "@/features/units/UnitsTable";
import { getLocale, getMessages, numberLocale } from "@/i18n";
import { getUnits } from "@/lib/data/units";

export const dynamic = "force-dynamic";

export default async function UnitsPage() {
  const locale = await getLocale();
  const m = getMessages(locale);
  let result: Awaited<ReturnType<typeof getUnits>>;
  try {
    result = await getUnits();
  } catch (error) {
    return <ApiErrorState error={error} retryLabel={m.common.retry} />;
  }
  const { units, skipped, meta } = result;

  return (
    <>
      <h1>{m.units.title}</h1>
      <p className="note">{m.units.intro}</p>
      {meta.source === "stale" && (
        <p className="banner" role="status">{m.common.source.stale} ({Math.round(meta.ageMs / 1000)}s, {meta.staleReason})</p>
      )}
      {units.length === 0 ? (
        <StateMessage tone="empty" title={m.units.emptyTitle} detail={m.units.emptyDetail} />
      ) : (
        <UnitsTable rows={units} m={m.units} noneLabel={m.common.none} allLabel={m.common.all} numberLocale={numberLocale(locale)} />
      )}
      {skipped > 0 && <p className="banner" role="status">{skipped} {m.units.skipped}</p>}
      <p className="provenance">
        {m.common.apiHost}: {meta.host} · {m.common.source[meta.source]} · {m.common.receivedAt} <time dateTime={meta.fetchedAt}>{meta.fetchedAt}</time>
        <br />{m.units.countryNote} {m.units.logoNote}
      </p>
    </>
  );
}
