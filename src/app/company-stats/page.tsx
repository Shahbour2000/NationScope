import Link from "next/link";
import { ApiErrorState } from "@/components/ApiErrorState";
import { Icon } from "@/components/Icon";
import { Provenance } from "@/components/Provenance";
import { CompanyStatsView } from "@/features/economy/CompanyStatsView";
import { Source } from "@/features/entities/entities";
import { getDisplay } from "@/features/entities/display.server";
import { getLocale, getMessages } from "@/i18n";
import { getCompanyStats } from "@/lib/data/economy";

export const dynamic = "force-dynamic";
const ID = /^[A-Za-z0-9_-]{1,30}$/;

export default async function CompanyStatsPage({ searchParams }: { searchParams: Promise<{ country?: string }> }) {
  const sp = await searchParams;
  const m = getMessages(await getLocale());
  const c = m.companiesPage;
  const country = sp.country && ID.test(sp.country) ? sp.country : undefined;
  let res;
  try { res = await getCompanyStats(country); } catch (e) { return <ApiErrorState error={e} retryLabel={m.common.retry} />; }
  const d = await getDisplay();
  const countries = Object.entries(d.dir.countries).sort((a, b) => a[1].name.localeCompare(b[1].name));
  return (
    <>
      <div className="page-head"><h1><Icon name="factory" size={26} />{c.statsTitle}</h1><Source kind="api" d={d} /></div>
      <p className="note">{c.statsIntro} <Link href="/companies">{c.title}</Link></p>
      <form method="get" className="filterbar">
        <label>{c.scope}<select name="country" className="field" defaultValue={country ?? ""}><option value="">{c.world}</option>{countries.map(([id, v]) => <option key={id} value={id}>{v.name}</option>)}</select></label>
        <button className="btn" type="submit">{d.m.ui.apply}</button>
      </form>
      <CompanyStatsView res={res} d={d} m={m} />
      <Provenance meta={res.meta} m={m} />
    </>
  );
}
