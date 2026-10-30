import Link from "next/link";
import { ApiErrorState } from "@/components/ApiErrorState";
import { Info } from "@/components/Info";
import { PageHero } from "@/components/PageHero";
import { Provenance } from "@/components/Provenance";
import { BarList } from "@/features/charts/charts";
import { marketInsights, marketView, type MarketView } from "@/features/economy/analytics";
import { ItemChip, Source } from "@/features/entities/entities";
import { getDisplay } from "@/features/entities/display.server";
import { MarketTable } from "@/features/market/MarketTable";
import { getLocale, getMessages } from "@/i18n";
import { getMarket } from "@/lib/data/economy";

export const dynamic = "force-dynamic";

export default async function MarketPage() {
  const m = getMessages(await getLocale());
  const e = m.economyPage, u = m.pagesUi;
  let res;
  try { res = await getMarket(); } catch (err) { return <ApiErrorState error={err} retryLabel={m.common.retry} />; }
  const d = await getDisplay();
  const nf = new Intl.NumberFormat(d.nl);
  const pct = (bps: number) => `${new Intl.NumberFormat(d.nl, { maximumFractionDigits: 1, signDisplay: "exceptZero" }).format(bps / 100)}%`;
  const view = marketView(res.rows);
  const ins = marketInsights(view);
  /** One shared scale for both panels so a small gap never looks as large as a big one. */
  const gapMax = Math.max(1, ...[...ins.askAbove, ...ins.askBelow].map((v) => Math.abs(v.askVsLastBps!)));
  const gapRows = (rows: MarketView[]) => rows.map((v) => ({ key: v.itemCode, label: <ItemChip code={v.itemCode} d={d} href={`/market/${encodeURIComponent(v.itemCode)}`} />, value: Math.abs(v.askVsLastBps!), display: pct(v.askVsLastBps!) }));

  return (
    <>
      <PageHero icon="chart" kicker={u.kicker.market} title={e.marketTitle} sub={<>{u.sub.market} <Link href="/economy">{e.economyHub}</Link></>}
        actions={<Source kind="api" d={d} />}
        kpis={[
          { icon: "box", label: u.itemsListed, value: nf.format(ins.items) },
          { icon: "trend", label: u.withSellers, value: nf.format(ins.withAsk), tone: "green", hint: ins.noAsk > 0 ? `${nf.format(ins.noAsk)} ${e.noAsk}` : undefined },
          { icon: "coins", label: u.withBuyers, value: nf.format(ins.withBid), tone: "gold" },
          { icon: "scale", label: u.medianSpread, value: ins.medianSpreadBps === null ? "—" : `${nf.format(ins.medianSpreadBps / 100)}%`, tone: "purple" },
        ]} />

      <div className="grid-2">
        <section className="panel" aria-label={u.askAbove}>
          <header><h2>{u.askAbove}</h2><Source kind="calc" d={d} /></header>
          {ins.askAbove.length ? <BarList ariaLabel={u.askAbove} max={gapMax} rows={gapRows(ins.askAbove)} /> : <p className="empty-mini">{u.noGap}</p>}
        </section>
        <section className="panel" aria-label={u.askBelow}>
          <header><h2>{u.askBelow}</h2><Source kind="calc" d={d} /></header>
          {ins.askBelow.length ? <BarList ariaLabel={u.askBelow} max={gapMax} rows={gapRows(ins.askBelow)} /> : <p className="empty-mini">{u.noGap}</p>}
        </section>
      </div>
      <p className="hint">{u.gapNote}</p>

      <Info title={e.howTitle}><ul>{e.how.map((t) => <li key={t}>{t}</li>)}</ul><p>{e.howLimits}</p></Info>
      <MarketTable rows={res.rows} d={d} m={e} />
      <p className="hint">{e.widestNote}</p>
      <Provenance meta={res.meta} m={m} note={m.ui.iconNote} />
    </>
  );
}
