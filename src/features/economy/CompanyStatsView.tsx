import { Icon } from "@/components/Icon";
import { BarList } from "@/features/charts/charts";
import { StatsTable } from "./StatsTable";
import { statsWithShare } from "./analytics";
import type { Display } from "@/features/entities/display";
import { ItemChip, Metric, Money, Source } from "@/features/entities/entities";
import type { Messages } from "@/i18n/messages";
import type { getCompanyStats } from "@/lib/data/economy";

/** Totals, share-by-product bars and the product table of GET /companies/stats. Shared by the world and country pages. */
export function CompanyStatsView({ res, d, m }: { res: Awaited<ReturnType<typeof getCompanyStats>>; d: Display; m: Messages }) {
  const c = m.companiesPage;
  const nf = new Intl.NumberFormat(d.nl);
  const total = res.totals?.companies ?? res.rows.reduce((n, r) => n + r.companies, 0);
  const rows = statsWithShare(res.rows, total);
  return (
    <>
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
      </section>
      <StatsTable rows={rows} d={d} labels={{ product: c.product, companies: c.companies, workers: c.workers, owners: c.owners, share: c.share }} />
    </>
  );
}
