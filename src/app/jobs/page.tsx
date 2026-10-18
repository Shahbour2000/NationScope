import Link from "next/link";
import { ApiErrorState } from "@/components/ApiErrorState";
import { Icon } from "@/components/Icon";
import { Provenance } from "@/components/Provenance";
import { BarList } from "@/features/charts/charts";
import { jobsSummary } from "@/features/economy/analytics";
import { CountryBadge, ItemChip, Metric, Money, PlayerChip, RegionLink, Source } from "@/features/entities/entities";
import { getDisplay } from "@/features/entities/display.server";
import { getLocale, getMessages } from "@/i18n";
import { getJobs } from "@/lib/data/economy";
import { formatMoney } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function JobsPage() {
  const m = getMessages(await getLocale());
  const e = m.economyPage;
  let res;
  try { res = await getJobs(); } catch (err) { return <ApiErrorState error={err} retryLabel={m.common.retry} />; }
  const d = await getDisplay();
  const sum = jobsSummary(res.rows);
  const sorted = [...res.rows].sort((a, b) => { const x = BigInt(a.netPerPoint ?? "0"), y = BigInt(b.netPerPoint ?? "0"); return y > x ? 1 : y < x ? -1 : 0; });
  const topCountries = sum.byCountry.slice(0, 6);
  const maxAvg = Number(topCountries[0]?.avgNet ?? 1n);
  return (
    <>
      <div className="page-head"><h1><Icon name="briefcase" size={26} />{e.jobsTitle}</h1><Source kind="api" d={d} /></div>
      <p className="note">{e.jobsIntro}</p>
      <dl className="metrics">
        <Metric icon="briefcase" label={e.offers} value={new Intl.NumberFormat(d.nl).format(sum.count)} />
        <Metric icon="coins" label={e.jobsMedian} value={<Money value={sum.medianNet?.toString()} d={d} />} hint={<Source kind="calc" d={d} />} />
        <Metric icon="scale" label={e.wageBand} value={<>{formatMoney(res.wage.min, d.nl) ?? "—"} – {formatMoney(res.wage.max, d.nl) ?? "—"}</>} hint={<>{formatMoney(res.wage.median, d.nl) ?? "—"} <Source kind="api" d={d} /></>} />
        {res.energyCost != null && <Metric icon="trend" label={e.energyCost} value={res.energyCost} />}
      </dl>
      {topCountries.length > 0 && (
        <section className="card">
          <h2><Icon name="globe" size={18} />{e.payByCountry} <Source kind="calc" d={d} /></h2>
          <BarList ariaLabel={e.payByCountry} max={maxAvg} rows={topCountries.map((c) => ({ key: c.countryId, label: <CountryBadge id={c.countryId} d={d} />, value: Number(c.avgNet), display: <Money value={c.avgNet.toString()} d={d} /> }))} />
          <p className="hint">{e.payNote}</p>
        </section>
      )}
      <div className="tablewrap" style={{ marginBlockStart: "1rem" }}>
        <table className="table">
          <thead><tr><th scope="col">{m.companiesPage.company}</th><th scope="col">{m.companiesPage.product}</th><th scope="col">{m.companiesPage.location}</th><th scope="col" className="num">{e.net}</th><th scope="col" className="num">{e.gross}</th><th scope="col" className="num">{e.tax}</th><th scope="col" className="num">{e.slots}</th><th scope="col" className="num">{e.minLevel}</th></tr></thead>
          <tbody>
            {sorted.map((o) => (
              <tr key={o.offerId}>
                <td data-label={m.companiesPage.company}>
                  {o.companyId ? <Link href={`/companies/${encodeURIComponent(o.companyId)}`}>{o.companyName ?? "—"}</Link> : (o.companyName ?? "—")}
                  {o.ownerName ? <div className="hint"><PlayerChip id={o.ownerId} name={o.ownerName} d={d} /></div> : null}
                  {o.moneyAvailable === false ? <div><span className="badge" data-tone="bad">{e.moneyIssue}</span></div> : null}
                </td>
                <td data-label={m.companiesPage.product}><ItemChip code={o.itemCode} d={d} /></td>
                <td data-label={m.companiesPage.location}>{o.regionId ? <RegionLink id={o.regionId} d={d} /> : "—"} {o.countryId ? <CountryBadge id={o.countryId} d={d} /> : null}</td>
                <td className="num" data-label={e.net}><Money value={o.netPerPoint} d={d} /></td>
                <td className="num" data-label={e.gross}><Money value={o.grossPerPoint} d={d} /></td>
                <td className="num" data-label={e.tax}>{o.incomeTax == null ? "—" : `${o.incomeTax}%`}</td>
                <td className="num" data-label={e.slots}>{o.slots ?? "—"}</td>
                <td className="num" data-label={e.minLevel}>{o.minLevel ?? "—"}</td>
              </tr>
            ))}
            {sorted.length === 0 && <tr><td colSpan={8}>{m.explorer.noRows}</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="hint">{e.pricePerPoint}. {e.payNote}</p>
      <Provenance meta={res.meta} m={m} />
    </>
  );
}
