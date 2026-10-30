import Link from "next/link";
import { ApiErrorState } from "@/components/ApiErrorState";
import { PageHero } from "@/components/PageHero";
import { Provenance } from "@/components/Provenance";
import { QueryPager } from "@/components/QueryPager";
import { BarList } from "@/features/charts/charts";
import { companyUpgradeTotal, statsWithShare } from "@/features/economy/analytics";
import { CountryBadge, ItemChip, PlayerChip, RegionLink, Source } from "@/features/entities/entities";
import { itemName } from "@/features/entities/display";
import { getDisplay } from "@/features/entities/display.server";
import { parseOffset } from "@/features/explorer/catalog";
import { getLocale, getMessages } from "@/i18n";
import { getCompanies, getCompanyStats } from "@/lib/data/economy";

export const dynamic = "force-dynamic";
const PAGE = 24;
const SORTS = ["invested", "workers", "level", "newest"] as const;
const ID = /^[A-Za-z0-9_-]{1,30}$/;

export default async function CompaniesPage({ searchParams }: { searchParams: Promise<{ country?: string; item?: string; sort?: string; offset?: string }> }) {
  const sp = await searchParams;
  const m = getMessages(await getLocale());
  const c = m.companiesPage, u = m.pagesUi;
  const country = sp.country && ID.test(sp.country) ? sp.country : undefined;
  const item = sp.item && ID.test(sp.item) ? sp.item : undefined;
  const sort = (SORTS as readonly string[]).includes(sp.sort ?? "") ? (sp.sort as (typeof SORTS)[number]) : "invested";
  const offset = parseOffset(sp.offset);
  // Both requests start together (the stats are optional context: a failure only hides the side panel and KPIs, never the list).
  const statsP = getCompanyStats().catch(() => null);
  let res;
  try { res = await getCompanies({ countryId: country, itemCode: item, sort, limit: PAGE, offset }); } catch (e) { return <ApiErrorState error={e} retryLabel={m.common.retry} />; }
  const stats = await statsP;
  const products = stats ? stats.rows.map((r) => r.itemCode) : [];
  const d = await getDisplay();
  const nf = new Intl.NumberFormat(d.nl);
  const countries = Object.entries(d.dir.countries).sort((a, b) => a[1].name.localeCompare(b[1].name));
  const top = stats ? statsWithShare(stats.rows, stats.totals?.companies ?? 0).slice(0, 8) : [];
  const filtered = Boolean(country || item);
  const kpis = [
    ...(stats?.totals ? [{ icon: "factory" as const, label: c.companies, value: nf.format(stats.totals.companies), tone: undefined }, { icon: "users" as const, label: c.workers, value: stats.totals.workers == null ? "—" : nf.format(stats.totals.workers), tone: "green" as const }] : []),
    ...(stats ? [{ icon: "box" as const, label: u.products, value: nf.format(stats.rows.length), tone: "gold" as const }] : []),
    ...(filtered && res.total != null ? [{ icon: "search" as const, label: u.filters, value: nf.format(res.total), tone: "purple" as const }] : []),
  ];

  return (
    <>
      <PageHero icon="briefcase" kicker={u.kicker.companies} title={c.title} sub={u.sub.companies} kpis={kpis} actions={<><Link className="btn-ghost" href="/company-stats">{c.statsTitle}</Link><Source kind="api" d={d} /></>} />

      <form method="get" className="panel fbar" aria-label={u.filters}>
        <label>{m.countriesPage.country}<select name="country" className="field" defaultValue={country ?? ""}><option value="">{c.allCountries}</option>{countries.map(([id, v]) => <option key={id} value={id}>{v.name}</option>)}</select></label>
        <label>{c.product}<select name="item" className="field" defaultValue={item ?? ""}><option value="">{c.allProducts}</option>{products.map((p) => <option key={p} value={p}>{itemName(p, d)}</option>)}</select></label>
        <label>{c.sort}<select name="sort" className="field" defaultValue={sort}><option value="invested">{c.sortInvested}</option><option value="workers">{c.sortWorkers}</option><option value="level">{c.sortLevel}</option><option value="newest">{c.sortNewest}</option></select></label>
        <button className="btn" type="submit">{d.m.ui.apply}</button>
        {filtered ? <Link className="btn-ghost" href="/companies">{u.reset}</Link> : null}
      </form>

      <div className={top.length ? "split" : undefined}>
        <div>
          {res.total != null ? <p className="res-note">{u.results.replace("{n}", nf.format(res.total))}{res.rows.length ? ` · ${u.showing.replace("{a}", nf.format(offset + 1)).replace("{b}", nf.format(offset + res.rows.length))}` : ""}</p> : null}
          {res.rows.length === 0 ? <p className="empty-mini panel">{c.noMatch}</p> : (
            <ul className="itemcards">
              {res.rows.map((x) => {
                const up: [string, number | null | undefined][] = [[c.storage, x.storageLevel], [c.engine, x.engineLevel], [c.breakRoom, x.breakRoomLevel]];
                const topLvl = Math.max(1, ...up.map(([, v]) => v ?? 0));
                return (
                  <li key={x.id} className="icard">
                    <div className="ic-head">
                      <Link className="ic-title" href={`/companies/${encodeURIComponent(x.id)}`} dir="auto" title={x.name}>{x.name}</Link>
                      <ItemChip code={x.itemCode} d={d} href={`/market/${encodeURIComponent(x.itemCode)}`} />
                    </div>
                    <div className="ic-sub">
                      {x.owner ? <PlayerChip id={x.owner.id} name={x.owner.username} avatar={x.owner.avatarUrl} d={d} /> : null}
                      {x.regionId ? <RegionLink id={x.regionId} d={d} /> : null}
                      {x.countryId ? <CountryBadge id={x.countryId} d={d} /> : null}
                    </div>
                    <div className="ic-nums">
                      <div><b>{x.level == null ? "—" : nf.format(x.level)}</b><small>{c.level}</small></div>
                      <div><b>{x.workers == null ? "—" : nf.format(x.workers)}</b><small>{c.workers}</small></div>
                      <div><b>{x.investedSteel == null ? "—" : nf.format(x.investedSteel)}</b><small>{c.investedSteel}</small></div>
                    </div>
                    <div className="upgr" aria-label={`${c.upgrades}: ${u.upgradeLevels} ${companyUpgradeTotal(x)}`}>
                      {up.map(([label, v]) => <div key={label}><span>{label}</span><span className="sbar" aria-hidden="true"><span style={{ inlineSize: `${Math.round(((v ?? 0) / topLvl) * 100)}%` }} /></span><b>{v == null ? "—" : v}</b></div>)}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        {top.length > 0 ? (
          <aside className="panel" aria-label={u.topProducts}>
            <header><h2>{u.topProducts}</h2></header>
            <BarList ariaLabel={c.byProduct} rows={top.map((r) => ({ key: r.itemCode, label: <ItemChip code={r.itemCode} d={d} />, value: r.companies, display: `${nf.format(r.companies)}${r.sharePct != null ? ` · ${r.sharePct}%` : ""}` }))} />
            <p className="hint">{c.compareNote}</p>
          </aside>
        ) : null}
      </div>
      <QueryPager path="/companies" params={{ country, item, sort: sort === "invested" ? undefined : sort }} offset={offset} step={PAGE} hasNext={res.total != null ? offset + PAGE < res.total : res.rows.length >= PAGE} prev={m.explorer.prev} next={m.explorer.next} />
      <Provenance meta={res.meta} m={m} />
    </>
  );
}
