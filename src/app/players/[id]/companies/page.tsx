import Link from "next/link";
import { notFound } from "next/navigation";
import { ApiErrorState } from "@/components/ApiErrorState";
import { PageHero } from "@/components/PageHero";
import { Provenance } from "@/components/Provenance";
import { CompanyCards } from "@/features/economy/CompanyCards";
import { itemName } from "@/features/entities/display";
import { getDisplay } from "@/features/entities/display.server";
import { Source } from "@/features/entities/entities";
import { getLocale, getMessages } from "@/i18n";
import { getPlayerCompaniesAll } from "@/lib/data/economy";

export const dynamic = "force-dynamic";
const safe = (v: string) => /^[A-Za-z0-9_-]{1,80}$/.test(v);
const SORTS = ["invested", "workers", "level", "newest"] as const;

export default async function PlayerCompaniesPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ item?: string; sort?: string }> }) {
  const { id } = await params;
  if (!safe(id)) notFound();
  const sp = await searchParams;
  const m = getMessages(await getLocale());
  const t = m.playerCompaniesPage, c = m.companiesPage;
  const sort = (SORTS as readonly string[]).includes(sp.sort ?? "") ? (sp.sort as (typeof SORTS)[number]) : "invested";
  let res;
  try { res = await getPlayerCompaniesAll(id, { sort }); } catch (e) { return <ApiErrorState error={e} retryLabel={m.common.retry} />; }
  const d = await getDisplay();
  const nf = new Intl.NumberFormat(d.nl);
  const all = res.rows;
  const products = [...new Set(all.map((x) => x.itemCode))].sort((a, b) => itemName(a, d).localeCompare(itemName(b, d)));
  const item = sp.item && products.includes(sp.item) ? sp.item : undefined;
  const rows = item ? all.filter((x) => x.itemCode === item) : all;
  const owner = all.find((x) => x.owner)?.owner?.username;
  const workers = all.reduce((a, x) => a + (x.workers ?? 0), 0);
  const regionCount = new Set(all.map((x) => x.regionId).filter(Boolean)).size;
  const kpis = all.length ? [
    { icon: "factory" as const, label: c.companies, value: nf.format(res.total ?? all.length), tone: undefined },
    { icon: "users" as const, label: c.workers, value: nf.format(workers), tone: "green" as const },
    { icon: "box" as const, label: m.pagesUi.products, value: nf.format(products.length), tone: "gold" as const },
    { icon: "map" as const, label: t.regions, value: nf.format(regionCount), tone: "purple" as const },
  ] : [];
  const profile = `/players/${encodeURIComponent(id)}`;
  return (
    <>
      <PageHero icon="factory" kicker={t.kicker} title={owner ? t.title.replace("{name}", owner) : t.titleUnknown} sub={t.sub} kpis={kpis} actions={<><Link className="btn-ghost" href={profile}>{t.back}</Link><Source kind="api" d={d} /></>} />
      {all.length === 0 ? <p className="empty-mini panel">{t.empty}</p> : (
        <>
          <form method="get" className="panel fbar" aria-label={m.pagesUi.filters}>
            <label>{c.product}<select name="item" className="field" defaultValue={item ?? ""}><option value="">{c.allProducts}</option>{products.map((p) => <option key={p} value={p}>{itemName(p, d)}</option>)}</select></label>
            <label>{c.sort}<select name="sort" className="field" defaultValue={sort}><option value="invested">{c.sortInvested}</option><option value="workers">{c.sortWorkers}</option><option value="level">{c.sortLevel}</option><option value="newest">{c.sortNewest}</option></select></label>
            <button className="btn" type="submit">{d.m.ui.apply}</button>
            {item || sort !== "invested" ? <Link className="btn-ghost" href={`${profile}/companies`}>{m.pagesUi.reset}</Link> : null}
          </form>
          {rows.length === 0 ? <p className="empty-mini panel">{t.noMatch}</p> : <CompanyCards rows={rows} d={d} m={m} />}
        </>
      )}
      {res.skipped > 0 ? <p className="res-note">{t.skipped.replace("{n}", nf.format(res.skipped))}</p> : null}
      {res.total != null && res.total > all.length + res.skipped ? <p className="res-note">{t.partial.replace("{total}", nf.format(res.total)).replace("{n}", nf.format(all.length))}</p> : null}
      <Provenance meta={res.meta} m={m} />
    </>
  );
}
