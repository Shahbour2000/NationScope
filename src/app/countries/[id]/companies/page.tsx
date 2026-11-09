import Link from "next/link";
import { notFound } from "next/navigation";
import { ApiErrorState } from "@/components/ApiErrorState";
import { Provenance } from "@/components/Provenance";
import { QueryPager } from "@/components/QueryPager";
import { Tabs } from "@/components/Tabs";
import { SubHead } from "@/features/countries/SubHead";
import { countryTabs } from "@/features/countries/tabs";
import { CompanyCards } from "@/features/economy/CompanyCards";
import { itemName } from "@/features/entities/display";
import { getDisplay } from "@/features/entities/display.server";
import { Metric } from "@/features/entities/entities";
import { parseOffset } from "@/features/explorer/catalog";
import { getLocale, getMessages } from "@/i18n";
import { getCompanies, getCompanyStats } from "@/lib/data/economy";

export const dynamic = "force-dynamic";
const PAGE = 24;
const SORTS = ["invested", "workers", "level", "newest"] as const;
const ID = /^[A-Za-z0-9_-]{1,30}$/;

/** Companies located in one country (same data and cards as the world Companies page, kept inside the country's tabs). */
export default async function CountryCompaniesPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ item?: string; sort?: string; offset?: string }> }) {
  const { id } = await params;
  if (!ID.test(id)) notFound();
  const sp = await searchParams;
  const m = getMessages(await getLocale());
  const c = m.companiesPage;
  const tabs = countryTabs(id, m, "companies");
  const item = sp.item && ID.test(sp.item) ? sp.item : undefined;
  const sort = (SORTS as readonly string[]).includes(sp.sort ?? "") ? (sp.sort as (typeof SORTS)[number]) : "invested";
  const offset = parseOffset(sp.offset);
  const statsP = getCompanyStats(id).catch(() => null);
  let res;
  try { res = await getCompanies({ countryId: id, itemCode: item, sort, limit: PAGE, offset }); } catch (e) { return <><h1>{c.title}</h1><Tabs items={tabs} label={c.title} /><ApiErrorState error={e} retryLabel={m.common.retry} /></>; }
  const stats = await statsP;
  const d = await getDisplay();
  const nf = new Intl.NumberFormat(d.nl);
  const base = `/countries/${encodeURIComponent(id)}/companies`;
  return (
    <>
      <SubHead id={id} title={c.title} tabs={tabs} d={d} />
      {stats?.totals && (
        <dl className="metrics" style={{ marginBlockStart: "1rem" }}>
          <Metric icon="factory" label={c.companies} value={nf.format(stats.totals.companies)} />
          <Metric icon="users" label={c.workers} value={stats.totals.workers == null ? "—" : nf.format(stats.totals.workers)} />
          <Metric icon="box" label={m.pagesUi.products} value={nf.format(stats.rows.length)} hint={<Link href={`/countries/${encodeURIComponent(id)}/company-stats`}>{c.statsTitle}</Link>} />
        </dl>
      )}
      <form method="get" className="panel fbar" aria-label={m.pagesUi.filters}>
        <label>{c.product}<select name="item" className="field" defaultValue={item ?? ""}><option value="">{c.allProducts}</option>{(stats?.rows ?? []).map((r) => <option key={r.itemCode} value={r.itemCode}>{itemName(r.itemCode, d)}</option>)}</select></label>
        <label>{c.sort}<select name="sort" className="field" defaultValue={sort}><option value="invested">{c.sortInvested}</option><option value="workers">{c.sortWorkers}</option><option value="level">{c.sortLevel}</option><option value="newest">{c.sortNewest}</option></select></label>
        <button className="btn" type="submit">{d.m.ui.apply}</button>
        {item ? <Link className="btn-ghost" href={base}>{m.pagesUi.reset}</Link> : null}
      </form>
      {res.total != null && <p className="res-note">{m.pagesUi.results.replace("{n}", nf.format(res.total))}{res.rows.length ? ` · ${m.pagesUi.showing.replace("{a}", nf.format(offset + 1)).replace("{b}", nf.format(offset + res.rows.length))}` : ""}</p>}
      {res.rows.length === 0 ? <p className="empty-mini panel">{c.noMatch}</p> : <CompanyCards rows={res.rows} d={d} m={m} />}
      <QueryPager path={base} params={{ item, sort: sort === "invested" ? undefined : sort }} offset={offset} step={PAGE} hasNext={res.total != null ? offset + PAGE < res.total : res.rows.length >= PAGE} prev={m.explorer.prev} next={m.explorer.next} />
      <Provenance meta={res.meta} m={m} />
    </>
  );
}
