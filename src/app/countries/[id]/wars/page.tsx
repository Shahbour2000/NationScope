import { ApiErrorState } from "@/components/ApiErrorState";
import { Provenance } from "@/components/Provenance";
import { Tabs } from "@/components/Tabs";
import { countryTabs } from "@/features/countries/tabs";
import { SubHead } from "@/features/countries/SubHead";
import { getDisplay } from "@/features/entities/display.server";
import { WarsBoard } from "@/features/wars/WarsBoard";
import { getLocale, getMessages } from "@/i18n";
import { getCountryWars } from "@/lib/data/world";

export const dynamic = "force-dynamic";

export default async function CountryWarsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = getMessages(await getLocale());
  const tabs = countryTabs(id, m, "wars");
  let res;
  try { res = await getCountryWars(id); } catch (e) { return <><h1>{m.nav.wars}</h1><Tabs items={tabs} label={m.nav.wars} /><ApiErrorState error={e} retryLabel={m.common.retry} /></>; }
  const d = await getDisplay();
  return (
    <>
      <SubHead id={id} title={m.nav.wars} tabs={tabs} d={d} />
      <div style={{ marginBlockStart: "1.1rem" }}><WarsBoard rows={res.rows} d={d} m={m.warsPage} nowMs={Date.now()} /></div>
      <Provenance meta={res.meta} m={m} />
    </>
  );
}
