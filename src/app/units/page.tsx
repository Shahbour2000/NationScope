import { ApiErrorState } from "@/components/ApiErrorState";
import { StateMessage } from "@/components/StateMessage";
import { getDisplay } from "@/features/entities/display.server";
import { UnitsBoard } from "@/features/units/UnitsBoard";
import { Provenance } from "@/components/Provenance";
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
  const d = await getDisplay();

  return (
    <>
      <h1>{m.units.title}</h1>
      <p style={{ color: "#8b97b3", margin: "-0.3rem 0 1.2rem", maxInlineSize: "62rem" }}>{m.units.intro}</p>
      {units.length === 0 ? (
        <StateMessage tone="empty" title={m.units.emptyTitle} detail={m.units.emptyDetail} />
      ) : (
        <UnitsBoard moreLabel={m.explorer.next} rows={units} m={m.units} noneLabel={m.common.none} allLabel={m.common.all} numberLocale={numberLocale(locale)} d={d} />
      )}
      {skipped > 0 && <p className="banner" role="status">{skipped} {m.units.skipped}</p>}
      <Provenance meta={meta} m={m} />
    </>
  );
}
