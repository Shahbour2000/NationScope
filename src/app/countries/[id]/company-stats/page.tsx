import { notFound } from "next/navigation";
import { ApiErrorState } from "@/components/ApiErrorState";
import { Provenance } from "@/components/Provenance";
import { Tabs } from "@/components/Tabs";
import { SubHead } from "@/features/countries/SubHead";
import { countryTabs } from "@/features/countries/tabs";
import { CompanyStatsView } from "@/features/economy/CompanyStatsView";
import { getDisplay } from "@/features/entities/display.server";
import { getLocale, getMessages } from "@/i18n";
import { getCompanyStats } from "@/lib/data/economy";

export const dynamic = "force-dynamic";

/** Company statistics of one country (GET /companies/stats?countryId=), shown inside the country's tabs. */
export default async function CountryCompanyStatsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[A-Za-z0-9_-]{1,30}$/.test(id)) notFound();
  const m = getMessages(await getLocale());
  const tabs = countryTabs(id, m, "company-stats");
  let res;
  try { res = await getCompanyStats(id); } catch (e) { return <><h1>{m.companiesPage.statsTitle}</h1><Tabs items={tabs} label={m.companiesPage.statsTitle} /><ApiErrorState error={e} retryLabel={m.common.retry} /></>; }
  const d = await getDisplay();
  return (
    <>
      <SubHead id={id} title={m.companiesPage.statsTitle} tabs={tabs} d={d} />
      <div style={{ marginBlockStart: "1.1rem" }}><CompanyStatsView res={res} d={d} m={m} /></div>
      <Provenance meta={res.meta} m={m} />
    </>
  );
}
