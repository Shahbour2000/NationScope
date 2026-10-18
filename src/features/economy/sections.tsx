import Link from "next/link";
import { Icon } from "@/components/Icon";
import { BarList, Sparkline } from "@/features/charts/charts";
import { jobsSummary, marketView, tradesByItem, floorMatrix, statsWithShare } from "@/features/economy/analytics";
import { CountryBadge, ItemChip, Metric, Money, Source } from "@/features/entities/entities";
import { itemName, term, type Display } from "@/features/entities/display";
import { describeError } from "@/lib/api/errors";
import { getCompanyStats, getEquipmentFloor, getJobs, getMarket, getTrades } from "@/lib/data/economy";
import { formatMoney } from "@/lib/format";
import type { Messages } from "@/i18n/messages";

interface P { d: Display; m: Messages }
const Fail = ({ e, d }: { e: unknown; d: Display }) => <p className="banner" role="alert">{d.m.ui.missing}: {describeError(e).title}</p>;

export async function MarketSection({ d, m }: P) {
  const t = m.economyPage;
  try {
    const { rows, meta } = await getMarket();
    const view = marketView(rows);
    const spreads = view.filter((v) => v.spreadBps !== null).sort((a, b) => b.spreadBps! - a.spreadBps!).slice(0, 8);
    const noAsk = view.filter((v) => v.ask === null);
    const nf = new Intl.NumberFormat(d.nl);
    return (
      <section className="card">
        <h2><Icon name="chart" size={18} />{t.marketTitle} <Source kind="api" d={d} /></h2>
        <dl className="metrics">
          <Metric icon="box" label={t.item} value={nf.format(view.length)} />
          <Metric icon="trend" label={t.noSellers} value={nf.format(noAsk.length)} />
        </dl>
        <h3 style={{ fontSize: "0.95rem" }}>{t.widestSpreads} <Source kind="estimate" d={d} /></h3>
        <BarList ariaLabel={t.widestSpreads} rows={spreads.map((v) => ({ key: v.itemCode, label: <ItemChip code={v.itemCode} d={d} href={`/market/${encodeURIComponent(v.itemCode)}`} />, value: v.spreadBps!, display: `${nf.format(v.spreadBps! / 100)}%` }))} />
        <p className="hint">{t.widestNote}</p>
        {noAsk.length > 0 && <><h3 style={{ fontSize: "0.95rem" }}>{t.noSellers}</h3><p className="hint">{t.noSellersNote}</p><div className="stat-chips">{noAsk.map((v) => <ItemChip key={v.itemCode} code={v.itemCode} d={d} href={`/market/${encodeURIComponent(v.itemCode)}`} />)}</div></>}
        <p className="hint"><Link href="/market">{t.openMarket}</Link> · {meta.fetchedAt.replace("T", " ").replace(/\.\d+Z$/, "Z")}</p>
      </section>
    );
  } catch (e) { return <Fail e={e} d={d} />; }
}

export async function TradesSection({ d, m }: P) {
  const t = m.economyPage;
  try {
    const { rows } = await getTrades(50);
    const groups = tradesByItem(rows);
    return (
      <section className="card">
        <h2><Icon name="trend" size={18} />{t.recentTrades} <Source kind="calc" d={d} /></h2>
        <p className="hint">{t.recentNote}</p>
        {groups.length === 0 ? <p className="empty-mini">{t.noTrades}</p> : (
          <div className="tablewrap">
            <table className="table">
              <thead><tr><th scope="col">{t.item}</th><th scope="col" className="num">{t.trades}</th><th scope="col" className="num">{t.units}</th><th scope="col" className="num">{t.avgPrice}</th><th scope="col" className="num">{t.lastTrade}</th><th scope="col">{t.trend}</th></tr></thead>
              <tbody>
                {groups.slice(0, 12).map((g) => (
                  <tr key={g.itemCode}>
                    <td data-label={t.item}><ItemChip code={g.itemCode} d={d} href={`/market/${encodeURIComponent(g.itemCode)}`} /></td>
                    <td className="num" data-label={t.trades}>{g.trades}</td>
                    <td className="num" data-label={t.units}>{new Intl.NumberFormat(d.nl).format(g.qty)}</td>
                    <td className="num" data-label={t.avgPrice}><Money value={g.vwap.toString()} d={d} /></td>
                    <td className="num" data-label={t.lastTrade}><Money value={g.last.toString()} d={d} /></td>
                    <td data-label={t.trend}>{g.series.length >= 3 ? <Sparkline values={g.series.map((p) => Number(p.price))} ariaLabel={itemName(g.itemCode, d)} /> : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    );
  } catch (e) { return <Fail e={e} d={d} />; }
}

export async function JobsSection({ d, m }: P) {
  const t = m.economyPage;
  try {
    const res = await getJobs();
    const s = jobsSummary(res.rows);
    return (
      <section className="card">
        <h2><Icon name="briefcase" size={18} />{t.jobsTitle} <Source kind="api" d={d} /></h2>
        <dl className="metrics">
          <Metric icon="briefcase" label={t.offers} value={new Intl.NumberFormat(d.nl).format(s.count)} />
          <Metric icon="coins" label={t.jobsMedian} value={<Money value={s.medianNet?.toString()} d={d} />} hint={<Source kind="calc" d={d} />} />
          <Metric icon="scale" label={t.wageBand} value={<>{formatMoney(res.wage.min, d.nl) ?? "—"} – {formatMoney(res.wage.max, d.nl) ?? "—"}</>} />
        </dl>
        {s.bestNet && <p className="hint">{t.bestJobs}: <ItemChip code={s.bestNet.itemCode} d={d} /> {s.bestNet.countryId ? <CountryBadge id={s.bestNet.countryId} d={d} /> : null} <Money value={s.bestNet.netPerPoint} d={d} /> <Source kind="calc" d={d} /></p>}
        <p className="hint"><Link href="/jobs">{t.jobsLink}</Link></p>
      </section>
    );
  } catch (e) { return <Fail e={e} d={d} />; }
}

export async function FloorSection({ d, m }: P) {
  const t = m.economyPage;
  try {
    const { rows } = await getEquipmentFloor();
    const mx = floorMatrix(rows);
    return (
      <section className="card">
        <h2><Icon name="box" size={18} />{t.floorTitle} <Source kind="api" d={d} /></h2>
        <div className="tablewrap">
          <table className="heat">
            <thead><tr><th scope="col">{t.slot}</th>{mx.rarities.map((r) => <th key={r} scope="col">{term("rarity", r, d)}</th>)}</tr></thead>
            <tbody>
              {mx.slots.map((s) => (
                <tr key={s}><th scope="row">{term("slot", s, d)}</th>{mx.rarities.map((r) => { const c = mx.cell.get(`${s}|${r}`); return <td key={r} data-empty={c ? "false" : "true"}>{c ? <><Money value={c.low} d={d} /><small>{c.offers} {t.offersCount}</small></> : "—"}</td>; })}</tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="hint"><Link href="/equipment">{t.equipmentLink}</Link></p>
      </section>
    );
  } catch (e) { return <Fail e={e} d={d} />; }
}

export async function CompaniesSection({ d, m }: P) {
  const t = m.economyPage;
  const c = m.companiesPage;
  try {
    const res = await getCompanyStats();
    const nf = new Intl.NumberFormat(d.nl);
    const total = res.totals?.companies ?? 0;
    const top = statsWithShare(res.rows, total).slice(0, 8);
    return (
      <section className="card">
        <h2><Icon name="factory" size={18} />{c.statsTitle} <Source kind="calc" d={d} /></h2>
        {res.totals && <dl className="metrics"><Metric icon="factory" label={c.companies} value={nf.format(res.totals.companies)} /><Metric icon="users" label={c.workers} value={nf.format(res.totals.workers ?? 0)} /></dl>}
        <BarList ariaLabel={c.byProduct} rows={top.map((r) => ({ key: r.itemCode, label: <ItemChip code={r.itemCode} d={d} />, value: r.companies, display: `${nf.format(r.companies)}${r.sharePct != null ? ` · ${r.sharePct}%` : ""}` }))} />
        <p className="hint"><Link href="/company-stats">{t.companiesLink}</Link></p>
      </section>
    );
  } catch (e) { return <Fail e={e} d={d} />; }
}
