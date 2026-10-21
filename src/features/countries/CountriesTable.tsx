"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import { MobileSort } from "@/components/MobileSort";
import { Progress } from "@/features/charts/charts";
import { CountryBadge, ItemChip, RegionLink } from "@/features/entities/entities";
import type { Display } from "@/features/entities/display";
import { coreControl } from "@/features/economy/analytics";
import type { Messages } from "@/i18n/messages";
import type { Country } from "@/lib/domain/world";

type SortKey = "name" | "regions" | "core" | "development" | "citizens";
const num = (v: number | null | undefined) => v ?? -1;

export function CountriesTable({ rows, d, m }: { rows: Country[]; d: Display; m: Messages["countriesPage"] }) {
  const [q, setQ] = useState("");
  const [allied, setAllied] = useState(false);
  const [lost, setLost] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "development", dir: "desc" });
  const fmt = useMemo(() => new Intl.NumberFormat(d.nl), [d.nl]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const f = rows.filter((c) => (!needle || c.name.toLowerCase().includes(needle)) && (!allied || !!c.alliance) && (!lost || c.capitalHeld === false));
    const val = (c: Country): number | string => {
      switch (sort.key) {
        case "name": return c.name.toLowerCase();
        case "regions": return num(c.regions);
        case "core": return coreControl(c).pct ?? -1;
        case "development": return num(c.development);
        case "citizens": return num(c.citizens);
      }
    };
    const sign = sort.dir === "asc" ? 1 : -1;
    return [...f].sort((a, b) => { const x = val(a), y = val(b); return (x < y ? -1 : x > y ? 1 : 0) * sign; });
  }, [rows, q, allied, lost, sort]);

  const th = (key: SortKey, label: string, numeric = false) => (
    <th scope="col" className={numeric ? "num" : undefined} aria-sort={sort.key === key ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
      <button type="button" className="sortbtn" onClick={() => setSort((s) => ({ key, dir: s.key === key && s.dir === "desc" ? "asc" : "desc" }))}>
        {label}{sort.key === key ? (sort.dir === "asc" ? " ▲" : " ▼") : ""}
      </button>
    </th>
  );

  const totals = useMemo(() => ({
    count: shown.length,
    citizens: shown.reduce((n, c) => n + (c.citizens ?? 0), 0),
    regions: shown.reduce((n, c) => n + (c.regions ?? 0), 0),
  }), [shown]);

  return (
    <>
      <dl className="stats">
        <div className="stat"><dt>{m.countriesCount}</dt><dd>{fmt.format(totals.count)}</dd></div>
        <div className="stat"><dt>{m.totalCitizens}</dt><dd>{fmt.format(totals.citizens)}</dd></div>
        <div className="stat"><dt>{m.totalRegions}</dt><dd>{fmt.format(totals.regions)}</dd></div>
      </dl>
      <p className="note">{m.sumNote}</p>
      <div className="filterbar">
        <label>{m.searchPlaceholder}<input className="field" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={m.searchPlaceholder} /></label>
        <label className="check"><span><input type="checkbox" checked={allied} onChange={(e) => setAllied(e.target.checked)} /> {m.onlyAllied}</span></label>
        <label className="check"><span><input type="checkbox" checked={lost} onChange={(e) => setLost(e.target.checked)} /> {m.capitalLost}</span></label>
      </div>
      <MobileSort label={d.m.ui.sortBy} value={sort.key} dir={sort.dir} onKey={(k) => setSort((s) => ({ ...s, key: k as SortKey }))} onDir={() => setSort((s) => ({ ...s, dir: s.dir === "asc" ? "desc" : "asc" }))}
        options={[{ key: "name", label: m.country }, { key: "regions", label: m.regions }, { key: "core", label: m.core }, { key: "development", label: m.development }, { key: "citizens", label: m.citizens }]} />
      <div className="tablewrap">
        <table className="table">
          <thead>
            <tr>
              {th("name", m.country)}
              {th("regions", m.regions, true)}
              <th scope="col">{m.capital}</th>
              {th("core", m.core)}
              {th("development", m.development, true)}
              {th("citizens", m.citizens, true)}
              <th scope="col">{m.alliance}</th>
              <th scope="col">{m.taxes}</th>
              <th scope="col">{m.specialty}</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((c) => {
              const core = coreControl(c);
              return (
                <tr key={c.id}>
                  <td data-label={m.country}><CountryBadge id={c.id} d={d} /></td>
                  <td className="num" data-label={m.regions}>{c.regions == null ? "—" : fmt.format(c.regions)}</td>
                  <td data-label={m.capital}>
                    {c.capitalRegionId ? <><RegionLink id={c.capitalRegionId} d={d} />{" "}<span className="badge" data-tone={c.capitalHeld ? "good" : "bad"}>{c.capitalHeld ? m.held : m.lost}</span></> : "—"}
                  </td>
                  <td data-label={m.core}>
                    {core.total > 0 ? <span className="compare"><b>{core.held}/{core.total}</b><Progress value={core.held} max={core.total} label={m.core} /></span> : "—"}
                  </td>
                  <td className="num" data-label={m.development}>{c.development == null ? "—" : fmt.format(c.development)}</td>
                  <td className="num" data-label={m.citizens}>{c.citizens == null ? "—" : `${fmt.format(c.activeCitizens ?? 0)} / ${fmt.format(c.citizens)}`}</td>
                  <td data-label={m.alliance}>{c.alliance ? <Link href={`/alliances/${encodeURIComponent(c.alliance.id)}`}><Icon name="shield" size={14} /> {c.alliance.name}</Link> : "—"}</td>
                  <td data-label={m.taxes}>{c.incomeTax == null && c.marketTax == null ? "—" : `${c.incomeTax ?? "—"}% / ${c.marketTax ?? "—"}%`}</td>
                  <td data-label={m.specialty}>{c.specializedItem ? <ItemChip code={c.specializedItem} d={d} /> : "—"}</td>
                </tr>
              );
            })}
            {shown.length === 0 && <tr><td colSpan={9}>{m.noMatch}</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
