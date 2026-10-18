import Link from "next/link";
import { ApiErrorState } from "@/components/ApiErrorState";
import { Icon } from "@/components/Icon";
import { Provenance } from "@/components/Provenance";
import { BarList } from "@/features/charts/charts";
import { statsWithShare } from "@/features/economy/analytics";
import { ItemChip, Metric, Money, Source } from "@/features/entities/entities";
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
  const nf = new Intl.NumberFormat(d.nl);
  const total = res.totals?.companies ?? res.rows.reduce((n, r) => n + r.companies, 0);
  const rows = statsWithShare(res.rows, total);
  const countries = Object.entries(d.dir.countries).sort((a, b) => a[1].name.localeCompare(b[1].name));
  return (
    <>
      <div className="page-head"><h1><Icon name="factory" size={26} />{c.statsTitle}</h1><Source kind="api" d={d} /></div>
      <p className="note">{c.statsIntro} <Link href="/companies">{c.title}</Link></p>
      <form method="get" className="filterbar">
        <label>{c.scope}<select name="country" className="field" defaultValue={country ?? ""}><option value="">{c.world}</option>{countries.map(([id, v]) => <option key={id} value={id}>{v.name}</option>)}</select></label>
        <button className="btn" type="submit">{d.m.ui.apply}</button>
      </form>
      {res.totals && (
        <dl className="metrics">
          <Metric icon="factory" label={c.companies} value={nf.format(res.totals.companies)} />
          <Metric icon="users" label={c.workers} value={nf.format(res.totals.workers ?? 0)} />
          <Metric icon="box" label={c.investedSteel} value={nf.format(res.totals.investedSteel ?? 0)} />
          <Metric icon="coins" label={c.investedMoney} value={<Money value={res.totals.investedMoney} d={d} />} />
        </dl>
      )}
      <section className="card">
        <h2><Icon name="chart" size={18} />{c.byProduct} <Source kind="calc" d={d} /></h2>
        <BarList ariaLabel={c.byProduct} rows={rows.map((r) => ({ key: r.itemCode, label: <ItemChip code={r.itemCode} d={d} />, value: r.companies, display: <>{nf.format(r.companies)}{r.sharePct != null ? ` · ${r.sharePct}%` : ""}</> }))} />
        <p className="hint">{c.compareNote}</p>
      </section>
      <div className="tablewrap" style={{ marginBlockStart: "1rem" }}>
        <table className="table">
          <thead><tr><th scope="col">{c.product}</th><th scope="col" className="num">{c.companies}</th><th scope="col" className="num">{c.workers}</th><th scope="col" className="num">{c.owners}</th><th scope="col" className="num">{c.share}</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.itemCode}>
                <td data-label={c.product}><ItemChip code={r.itemCode} d={d} /></td>
                <td className="num" data-label={c.companies}>{nf.format(r.companies)}</td>
                <td className="num" data-label={c.workers}>{nf.format(r.workers)}</td>
                <td className="num" data-label={c.owners}>{nf.format(r.owners)}</td>
                <td className="num" data-label={c.share}>{r.sharePct == null ? "—" : `${r.sharePct}%`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Provenance meta={res.meta} m={m} />
    </>
  );
}
