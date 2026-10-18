import Link from "next/link";
import { ApiErrorState } from "@/components/ApiErrorState";
import { Icon } from "@/components/Icon";
import { Provenance } from "@/components/Provenance";
import { QueryPager } from "@/components/QueryPager";
import { companyUpgradeTotal } from "@/features/economy/analytics";
import { CountryBadge, ItemChip, PlayerChip, RegionLink, Source } from "@/features/entities/entities";
import { itemName } from "@/features/entities/display";
import { getDisplay } from "@/features/entities/display.server";
import { parseOffset } from "@/features/explorer/catalog";
import { getLocale, getMessages } from "@/i18n";
import { getCompanies, getCompanyStats } from "@/lib/data/economy";

export const dynamic = "force-dynamic";
const PAGE = 50;
const SORTS = ["invested", "workers", "level", "newest"] as const;
const ID = /^[A-Za-z0-9_-]{1,30}$/;

export default async function CompaniesPage({ searchParams }: { searchParams: Promise<{ country?: string; item?: string; sort?: string; offset?: string }> }) {
  const sp = await searchParams;
  const m = getMessages(await getLocale());
  const c = m.companiesPage;
  const country = sp.country && ID.test(sp.country) ? sp.country : undefined;
  const item = sp.item && ID.test(sp.item) ? sp.item : undefined;
  const sort = (SORTS as readonly string[]).includes(sp.sort ?? "") ? (sp.sort as (typeof SORTS)[number]) : "invested";
  const offset = parseOffset(sp.offset);
  let res;
  try { res = await getCompanies({ countryId: country, itemCode: item, sort, limit: PAGE, offset }); } catch (e) { return <ApiErrorState error={e} retryLabel={m.common.retry} />; }
  const products = await getCompanyStats().then((s) => s.rows.map((r) => r.itemCode)).catch(() => [] as string[]);
  const d = await getDisplay();
  const nf = new Intl.NumberFormat(d.nl);
  const countries = Object.entries(d.dir.countries).sort((a, b) => a[1].name.localeCompare(b[1].name));

  return (
    <>
      <div className="page-head"><h1><Icon name="briefcase" size={26} />{c.title}</h1><Source kind="api" d={d} /></div>
      <p className="note">{c.intro} <Link href="/company-stats">{c.statsTitle}</Link></p>
      <form method="get" className="filterbar">
        <label>{m.countriesPage.country}<select name="country" className="field" defaultValue={country ?? ""}><option value="">{c.allCountries}</option>{countries.map(([id, v]) => <option key={id} value={id}>{v.name}</option>)}</select></label>
        <label>{c.product}<select name="item" className="field" defaultValue={item ?? ""}><option value="">{c.allProducts}</option>{products.map((p) => <option key={p} value={p}>{itemName(p, d)}</option>)}</select></label>
        <label>{c.sort}<select name="sort" className="field" defaultValue={sort}><option value="invested">{c.sortInvested}</option><option value="workers">{c.sortWorkers}</option><option value="level">{c.sortLevel}</option><option value="newest">{c.sortNewest}</option></select></label>
        <button className="btn" type="submit">{d.m.ui.apply}</button>
      </form>
      {res.total != null && <p className="note">{nf.format(res.total)} {c.total}</p>}
      <div className="tablewrap">
        <table className="table">
          <thead><tr><th scope="col">{c.company}</th><th scope="col">{c.product}</th><th scope="col">{c.location}</th><th scope="col" className="num">{c.level}</th><th scope="col" className="num">{c.workers}</th><th scope="col">{c.upgrades}</th><th scope="col" className="num">{c.investedSteel}</th></tr></thead>
          <tbody>
            {res.rows.map((x) => (
              <tr key={x.id}>
                <td data-label={c.company}>
                  <Link href={`/companies/${encodeURIComponent(x.id)}`} dir="auto"><b>{x.name}</b></Link>
                  {x.owner ? <div className="hint"><PlayerChip id={x.owner.id} name={x.owner.username} avatar={x.owner.avatarUrl} d={d} /></div> : null}
                </td>
                <td data-label={c.product}><ItemChip code={x.itemCode} d={d} href={`/market/${encodeURIComponent(x.itemCode)}`} /></td>
                <td data-label={c.location}>{x.regionId ? <RegionLink id={x.regionId} d={d} /> : null}{x.countryId ? <div><CountryBadge id={x.countryId} d={d} /></div> : null}</td>
                <td className="num" data-label={c.level}>{x.level ?? "—"}</td>
                <td className="num" data-label={c.workers}>{x.workers ?? "—"}</td>
                <td data-label={c.upgrades}><span className="stat-chips"><span className="chip">{c.storage} {x.storageLevel ?? 0}</span><span className="chip">{c.engine} {x.engineLevel ?? 0}</span><span className="chip">{c.breakRoom} {x.breakRoomLevel ?? 0}</span></span><span className="hint">Σ {companyUpgradeTotal(x)}</span></td>
                <td className="num" data-label={c.investedSteel}>{x.investedSteel == null ? "—" : nf.format(x.investedSteel)}</td>
              </tr>
            ))}
            {res.rows.length === 0 && <tr><td colSpan={7}>{c.noMatch}</td></tr>}
          </tbody>
        </table>
      </div>
      <QueryPager path="/companies" params={{ country, item, sort: sort === "invested" ? undefined : sort }} offset={offset} step={PAGE} hasNext={res.total != null ? offset + PAGE < res.total : res.rows.length >= PAGE} prev={m.explorer.prev} next={m.explorer.next} />
      <Provenance meta={res.meta} m={m} />
    </>
  );
}
