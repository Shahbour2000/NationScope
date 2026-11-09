"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import { SortTh, useSort } from "@/components/Sortable";
import { BarList } from "@/features/charts/charts";
import { itemName, type Display } from "@/features/entities/display";
import { CountryBadge, ItemChip, Metric, Money, RegionLink } from "@/features/entities/entities";
import { LazyAvatar } from "@/features/entities/LazyAvatar";
import type { Messages } from "@/i18n/messages";
import { formatMoney } from "@/lib/format";
import type { JobOffer } from "@/lib/domain/economy";
import { NO_JOB_FILTERS, filterJobs, jobStats, type JobFilters } from "./jobs";

const PAGE = 25;
const safe = (v: string | null | undefined): v is string => !!v && /^[A-Za-z0-9_-]{1,80}$/.test(v);
const num = (v: string): number | null => (v.trim() === "" || !Number.isFinite(Number(v)) ? null : Number(v));

/** Job offers with filters (company/employer, country, product, pay range), sortable columns, and statistics computed from the offers on screen. */
export function JobsBoard({ rows, d, m, wage }: { rows: JobOffer[]; d: Display; m: Messages; wage: { min: string | null; median: string | null; max: string | null } }) {
  const e = m.economyPage;
  const [f, setF] = useState<JobFilters>(NO_JOB_FILTERS);
  const [minTxt, setMinTxt] = useState(""), [maxTxt, setMaxTxt] = useState("");
  const [page, setPage] = useState(0);
  const set = (p: Partial<JobFilters>) => { setF((x) => ({ ...x, ...p })); setPage(0); };
  const countries = useMemo(() => [...new Set(rows.map((r) => r.countryId).filter(safe))].sort(), [rows]);
  const items = useMemo(() => [...new Set(rows.map((r) => r.itemCode))].sort((a, b) => itemName(a, d).localeCompare(itemName(b, d))), [rows, d]);
  const filtered = useMemo(() => filterJobs(rows, f), [rows, f]);
  // Sort keys are raw values: net/gross/tax are numbers, names are plain strings.
  const table = useMemo(() => filtered.map((o) => ({
    o, companyName: (o.companyName ?? "").toLowerCase(), ownerName: (o.ownerName ?? "").toLowerCase(), item: itemName(o.itemCode, d).toLowerCase(), country: o.countryId ?? "",
    net: o.netPerPoint != null ? Number(o.netPerPoint) : null, gross: o.grossPerPoint != null ? Number(o.grossPerPoint) : null, tax: o.incomeTax ?? null, slots: o.slots ?? null, minLevel: o.minLevel ?? null,
  })), [filtered, d]);
  const { sort, sorted, toggle } = useSort(table as unknown as Record<string, unknown>[], { key: "net", dir: "desc" });
  const list = sorted as unknown as typeof table;
  const pages = Math.max(1, Math.ceil(list.length / PAGE)), cur = Math.min(page, pages - 1);
  const shown = list.slice(cur * PAGE, cur * PAGE + PAGE);
  const nf = new Intl.NumberFormat(d.nl);
  const stats = useMemo(() => jobStats(filtered), [filtered]);
  const onSort = (k: string, dd?: "asc" | "desc") => { toggle(k, dd); setPage(0); };
  const active = f.q || f.country || f.item || f.min !== null || f.max !== null;
  const fmt = (t: string, v: Record<string, string>) => t.replace(/\{(\w+)\}/g, (_, k: string) => v[k] ?? "");
  const primary = stats[0];
  return (
    <>
      <dl className="metrics">
        <Metric icon="briefcase" label={e.offers} value={nf.format(filtered.length)} hint={fmt(e.jobsShowing, { a: nf.format(filtered.length), b: nf.format(rows.length) })} />
        {primary && <Metric icon="coins" label={e.jobsAvg} value={<Money value={String(primary.avg)} d={d} />} hint={fmt(e.jobsFromOffers, { n: nf.format(primary.offers) })} />}
        {primary && <Metric icon="trend" label={e.jobsHighest} value={<Money value={String(primary.highest)} d={d} />} hint={`${e.jobsLowest}: ${formatMoney(String(primary.lowest), d.nl) ?? "—"}`} />}
        {primary && <Metric icon="coins" label={e.jobsMedian} value={<Money value={String(primary.median)} d={d} />} />}
        <Metric icon="scale" label={e.jobsOfficialBand} value={<>{formatMoney(wage.min, d.nl) ?? "—"} – {formatMoney(wage.max, d.nl) ?? "—"}</>} hint={formatMoney(wage.median, d.nl) ?? undefined} />
      </dl>
      {stats.length > 1 && <p className="hint">{e.jobsMixedCurrency}</p>}
      {stats.map((st) => (
        <div key={st.currency} className="jobs-stats">
          {stats.length > 1 && <h3 className="hint">{fmt(e.jobsCurrency, { c: st.currency })}</h3>}
          <div className="jobs-cols">
            <section className="card"><h2><Icon name="globe" size={18} />{e.payByCountry}</h2>
              <BarList ariaLabel={e.payByCountry} max={st.byCountry[0]?.avg ?? 1} rows={st.byCountry.slice(0, 6).map((c) => ({ key: c.key, label: <CountryBadge id={c.key} d={d} />, value: c.avg, display: <Money value={String(c.avg)} d={d} /> }))} />
            </section>
            <section className="card"><h2><Icon name="box" size={18} />{e.jobsByProduct}</h2>
              <BarList ariaLabel={e.jobsByProduct} max={st.byItem[0]?.avg ?? 1} rows={st.byItem.slice(0, 6).map((c) => ({ key: c.key, label: <ItemChip code={c.key} d={d} />, value: c.avg, display: <Money value={String(c.avg)} d={d} /> }))} />
            </section>
          </div>
        </div>
      ))}
      <div className="toolbar jobs-filters">
        <input className="field" type="search" value={f.q} onChange={(ev) => set({ q: ev.target.value })} placeholder={e.jobsSearch} aria-label={e.jobsSearch} />
        <select className="field" value={f.country} onChange={(ev) => set({ country: ev.target.value })} aria-label={m.countriesPage.country}>
          <option value="">{e.jobsAllCountries}</option>{countries.map((c) => <option key={c} value={c}>{d.dir.countries[c]?.name ?? c}</option>)}
        </select>
        <select className="field" value={f.item} onChange={(ev) => set({ item: ev.target.value })} aria-label={m.companiesPage.product}>
          <option value="">{e.jobsAllProducts}</option>{items.map((c) => <option key={c} value={c}>{itemName(c, d)}</option>)}
        </select>
        <input className="field" inputMode="numeric" value={minTxt} onChange={(ev) => { setMinTxt(ev.target.value); set({ min: num(ev.target.value) }); }} placeholder={e.jobsMinPay} aria-label={e.jobsMinPay} />
        <input className="field" inputMode="numeric" value={maxTxt} onChange={(ev) => { setMaxTxt(ev.target.value); set({ max: num(ev.target.value) }); }} placeholder={e.jobsMaxPay} aria-label={e.jobsMaxPay} />
        {active && <button type="button" className="btn-ghost" onClick={() => { setF(NO_JOB_FILTERS); setMinTxt(""); setMaxTxt(""); setPage(0); }}>{e.jobsReset}</button>}
      </div>
      <div className="tablewrap">
        <table className="table">
          <thead>
            <tr>
              <SortTh k="companyName" sort={sort} onSort={onSort}>{m.companiesPage.company}</SortTh>
              <SortTh k="ownerName" sort={sort} onSort={onSort}>{e.jobsEmployer}</SortTh>
              <SortTh k="item" sort={sort} onSort={onSort}>{m.companiesPage.product}</SortTh>
              <SortTh k="country" sort={sort} onSort={onSort}>{m.companiesPage.location}</SortTh>
              <SortTh k="net" sort={sort} onSort={onSort} defaultDir="desc" align="end">{e.net}</SortTh>
              <SortTh k="gross" sort={sort} onSort={onSort} defaultDir="desc" align="end">{e.gross}</SortTh>
              <SortTh k="tax" sort={sort} onSort={onSort} align="end">{e.tax}</SortTh>
              <SortTh k="slots" sort={sort} onSort={onSort} defaultDir="desc" align="end">{e.slots}</SortTh>
              <SortTh k="minLevel" sort={sort} onSort={onSort} align="end">{e.minLevel}</SortTh>
            </tr>
          </thead>
          <tbody>
            {shown.map(({ o }) => (
              <tr key={o.offerId}>
                <td data-label={m.companiesPage.company}>
                  {safe(o.companyId) ? <Link className="pname" href={`/companies/${encodeURIComponent(o.companyId)}`} title={o.companyName ?? ""}>{o.companyName ?? "—"}</Link> : <span className="pname" title={o.companyName ?? ""}>{o.companyName ?? "—"}</span>}
                  {o.moneyAvailable === false ? <div><span className="badge" data-tone="bad">{e.moneyIssue}</span></div> : null}
                </td>
                <td data-label={e.jobsEmployer}>
                  {o.ownerName ? (safe(o.ownerId)
                    ? <Link className="pline" href={`/players/${encodeURIComponent(o.ownerId)}`} title={o.ownerName}><LazyAvatar playerId={o.ownerId} size={24} /><span className="pname" dir="auto">{o.ownerName}</span></Link>
                    : <span className="pline"><LazyAvatar playerId={null} size={24} /><span className="pname" dir="auto" title={o.ownerName}>{o.ownerName}</span></span>) : "—"}
                </td>
                <td data-label={m.companiesPage.product}><ItemChip code={o.itemCode} d={d} href={`/market/${encodeURIComponent(o.itemCode)}`} /></td>
                <td data-label={m.companiesPage.location}>{o.countryId ? <CountryBadge id={o.countryId} d={d} /> : "—"}{o.regionId ? <div className="hint"><RegionLink id={o.regionId} d={d} /></div> : null}</td>
                <td className="num" data-label={e.net}><Money value={o.netPerPoint} d={d} /></td>
                <td className="num" data-label={e.gross}><Money value={o.grossPerPoint} d={d} /></td>
                <td className="num" data-label={e.tax}>{o.incomeTax == null ? "—" : `${o.incomeTax}%`}</td>
                <td className="num" data-label={e.slots}>{o.slots ?? "—"}</td>
                <td className="num" data-label={e.minLevel}>{o.minLevel ?? "—"}</td>
              </tr>
            ))}
            {shown.length === 0 && <tr><td colSpan={9}>{e.jobsNoMatch}</td></tr>}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="pager">
          <button type="button" className="btn-ghost" disabled={cur === 0} onClick={() => setPage(cur - 1)}>{d.m.ui.prev}</button>
          <span>{d.m.ui.page} {nf.format(cur + 1)} / {nf.format(pages)}</span>
          <button type="button" className="btn-ghost" disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)}>{d.m.ui.next}</button>
        </div>
      )}
    </>
  );
}
