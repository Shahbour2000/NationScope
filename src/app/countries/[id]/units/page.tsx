import { ApiErrorState } from "@/components/ApiErrorState";
import { Provenance } from "@/components/Provenance";
import { Tabs } from "@/components/Tabs";
import { countryTabs } from "@/features/countries/tabs";
import { SubHead } from "@/features/countries/SubHead";
import { getDisplay } from "@/features/entities/display.server";
import { UnitsBoard } from "@/features/units/UnitsBoard";
import { getLocale, getMessages } from "@/i18n";
import { numberLocale } from "@/i18n";
import { getCountryUnits } from "@/lib/data/units";

export const dynamic = "force-dynamic";

export default async function CountryUnitsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const locale = await getLocale();
  const m = getMessages(locale);
  const tabs = countryTabs(id, m, "units");
  let res;
  try { res = await getCountryUnits(id); } catch (e) { return <><h1>{m.nav.units}</h1><Tabs items={tabs} label={m.nav.units} /><ApiErrorState error={e} retryLabel={m.common.retry} /></>; }
  const d = await getDisplay();
  return (
    <>
      <SubHead id={id} title={m.nav.units} tabs={tabs} d={d} />
      <div style={{ marginBlockStart: "1.1rem" }}><UnitsBoard moreLabel={m.explorer.next} rows={res.units} m={m.units} noneLabel={m.common.none} allLabel={m.common.all} numberLocale={numberLocale(locale)} d={d} /></div>
      <Provenance meta={res.meta} m={m} />
    </>
  );
}
