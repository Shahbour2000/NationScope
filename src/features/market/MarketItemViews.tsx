import Link from "next/link";
import { Icon } from "@/components/Icon";
import { Tabs } from "@/components/Tabs";
import { LineChart } from "@/features/charts/charts";
import { itemName, type Display } from "@/features/entities/display";
import { Dt, ItemChip, Money } from "@/features/entities/entities";
import { DataView } from "@/features/explorer/DataView";
import type { Messages } from "@/i18n/messages";
import type { Trade } from "@/lib/domain/economy";
import { bookStats, cumulative, historyStats, tradeStats, type History, type OrderBook } from "@/lib/domain/market-item";
import { humanizeCode } from "@/lib/format";
import s from "../regions/region.module.css"; // shared kpi / list / track / note styles

export type ItemTab = "orders" | "history" | "trades";
const gold = (v: bigint) => Number(v) / 10000;

export function MarketItemHeader({ item, current, d, m }: { item: string; current: ItemTab; d: Display; m: Messages }) {
  const t = m.marketItem, base = `/market/${encodeURIComponent(item)}`;
  return (
    <>
      <Link className={s.back} href="/market"><Icon name="chevron" size={14} />{t.back}</Link>
      <div className="page-head"><h1><ItemChip code={item} d={d} /> {t.title.replace("{item}", itemName(item, d))}</h1></div>
      <Tabs label={t.tabsLabel} items={[
        { href: `${base}/orders`, label: t.tabOrders, current: current === "orders" },
        { href: `${base}/history`, label: t.tabHistory, current: current === "history" },
        { href: `${base}/trades`, label: t.tabTrades, current: current === "trades" },
      ]} />
    </>
  );
}

/** Shown when a response has an unknown format: the data exactly as returned, with an explanation. */
export function AsReturned({ data, d, m }: { data: unknown; d: Display; m: Messages }) {
  return <><p className={s.note}>{m.marketItem.unrecognised}</p><DataView data={data} section={null} detailLinks={false} labels={m.explorer} d={d} /></>;
}

const Kpi = ({ v, l }: { v: React.ReactNode; l: string }) => <div><b>{v}</b><span>{l}</span></div>;
const pctFmt = (d: Display, v: number | null) => (v === null ? "—" : `${v > 0 ? "+" : ""}${new Intl.NumberFormat(d.nl, { maximumFractionDigits: 2 }).format(v)}%`);

export function TradesView({ rows, skipped, d, m }: { rows: Trade[]; skipped: number; d: Display; m: Messages }) {
  const t = m.marketItem, nf = new Intl.NumberFormat(d.nl), st = tradeStats(rows);
  if (!st) return <p className={s.empty}>{t.noTrades}</p>;
  const money = (v: bigint | null) => (v === null ? "—" : <Money value={v.toString()} d={d} />);
  return (
    <>
      <div className={s.kpis}>
        <Kpi l={t.lastTrade} v={money(st.last)} /><Kpi l={t.high} v={money(st.high)} /><Kpi l={t.low} v={money(st.low)} />
        <Kpi l={t.vwap} v={money(st.vwap)} /><Kpi l={t.volume} v={nf.format(st.volume)} /><Kpi l={t.trades} v={nf.format(st.count)} />
      </div>
      <p className={s.dim}>{t.derived}</p>
      <ul className={s.list}>
        {rows.map((r) => (
          <li key={r.id}>
            {r.createdAt ? <Dt iso={r.createdAt} d={d} /> : null}
            <b><Money value={r.price} d={d} /></b>
            <span>× {nf.format(r.qty)}</span>
            <span className={s.dim}>{t.total}: <Money value={(BigInt(r.price) * BigInt(Math.trunc(r.qty))).toString()} d={d} /></span>
            {r.buyerType ? <span className={s.badge}>{t.buyer}: {humanizeCode(r.buyerType)}</span> : null}
            {r.sellerType ? <span className={s.badge}>{t.seller}: {humanizeCode(r.sellerType)}</span> : null}
          </li>
        ))}
      </ul>
      {skipped > 0 ? <p className={s.dim}>{t.skipped.replace("{n}", nf.format(skipped))}</p> : null}
    </>
  );
}

function Ladder({ title, rows, empty, tone, d, m }: { title: string; rows: OrderBook["buys"]; empty: string; tone: "buy" | "sell"; d: Display; m: Messages }) {
  const t = m.marketItem, nf = new Intl.NumberFormat(d.nl), cum = cumulative(rows), max = cum[cum.length - 1] ?? 1;
  return (
    <section className={`panel ${s.panel}`}>
      <h2>{title}</h2>
      {rows.length === 0 ? <p className={s.note}>{empty}</p> : (
        <ul className={s.rows}>
          {rows.map((l, i) => (
            <li key={`${l.price}-${i}`}>
              <span><b><Money value={l.price.toString()} d={d} /></b> <span className={s.dim}>× {nf.format(l.qty)}</span></span>
              <span className={s.dim} title={t.cumulative}>{nf.format(cum[i]!)}</span>
              <span className={`${s.track} ${s.sub}`} data-kind={tone === "buy" ? "store" : undefined} role="img" aria-label={`${t.cumulative} ${nf.format(cum[i]!)}`}><i style={{ inlineSize: `${Math.min(100, (cum[i]! / max) * 100)}%` }} /></span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function OrderBookView({ book, d, m }: { book: OrderBook; d: Display; m: Messages }) {
  const t = m.marketItem, nf = new Intl.NumberFormat(d.nl), st = bookStats(book);
  if (book.buys.length === 0 && book.sells.length === 0) return <p className={s.empty}>{t.bookEmpty}</p>;
  const money = (v: bigint | null) => (v === null ? "—" : <Money value={v.toString()} d={d} />);
  return (
    <>
      <div className={s.kpis}>
        <Kpi l={t.bestBid} v={money(st.bestBid)} /><Kpi l={t.bestAsk} v={money(st.bestAsk)} />
        <Kpi l={t.spread} v={st.spread === null ? "—" : <>{money(st.spread)}{st.spreadPct !== null ? <small> ({nf.format(st.spreadPct)}%)</small> : null}</>} />
        <Kpi l={t.bidDepth} v={nf.format(st.bidDepth)} /><Kpi l={t.askDepth} v={nf.format(st.askDepth)} />
      </div>
      <p className={s.dim}>{t.bookNote}</p>
      {book.rawUnits ? <p className={s.dim}>{t.rawUnits}</p> : null}
      <div className={s.grid}>
        <Ladder title={t.buys} rows={book.buys} empty={t.noBuys} tone="buy" d={d} m={m} />
        <Ladder title={t.sells} rows={book.sells} empty={t.noSells} tone="sell" d={d} m={m} />
      </div>
    </>
  );
}

export function HistoryView({ history, d, m }: { history: History; d: Display; m: Messages }) {
  const t = m.marketItem, nf = new Intl.NumberFormat(d.nl), st = historyStats(history), pts = history.points;
  const money = (v: bigint) => <Money value={v.toString()} d={d} />;
  const dateLabel = (iso: string) => new Intl.DateTimeFormat(d.nl, { month: "short", day: "numeric", hour: "2-digit", timeZone: "UTC" }).format(new Date(iso));
  const fmt = new Intl.NumberFormat(d.nl, { maximumFractionDigits: 4 });
  return (
    <>
      <div className={s.kpis}>
        <Kpi l={t.lastTrade} v={money(st.last)} /><Kpi l={t.high} v={money(st.high)} /><Kpi l={t.low} v={money(st.low)} />
        <Kpi l={t.change} v={pctFmt(d, st.changePct)} />{st.volume !== null ? <Kpi l={t.volume} v={nf.format(st.volume)} /> : null}
      </div>
      <p className={s.dim}>{t.range.replace("{a}", dateLabel(pts[0]!.at)).replace("{b}", dateLabel(pts[pts.length - 1]!.at))} · {t.derived}</p>
      {history.rawUnits ? <p className={s.dim}>{t.rawUnits}</p> : null}
      {pts.length > 1 ? <LineChart ariaLabel={t.chart} points={pts.map((p) => ({ label: dateLabel(p.at), value: gold(p.price) }))} format={(n) => fmt.format(n)} /> : null}
    </>
  );
}
