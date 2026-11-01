"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import { coreControl } from "@/features/economy/analytics";
import { countryName, type Display } from "@/features/entities/display";
import { Flag } from "@/features/entities/entities";
import type { Messages } from "@/i18n/messages";
import type { Country } from "@/lib/domain/world";
import s from "./CountriesBoard.module.css";

type SortKey = "development" | "citizens" | "regions" | "name";
const idOk = (id: string) => /^[A-Za-z0-9_-]{1,80}$/.test(id);

export function CountriesBoard({ rows, d, m }: { rows: Country[]; d: Display; m: Messages["countriesPage"] }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("development");
  const [allied, setAllied] = useState(false);
  const [lost, setLost] = useState(false);
  const nf = useMemo(() => new Intl.NumberFormat(d.nl), [d.nl]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const num = (v: number | null | undefined) => v ?? -1;
    const val = (c: Country): number | string => (sort === "name" ? countryName(c.id, d.dir).toLowerCase() : sort === "citizens" ? num(c.citizens) : sort === "regions" ? num(c.regions) : num(c.development));
    return rows
      .filter((c) => (!needle || countryName(c.id, d.dir).toLowerCase().includes(needle) || c.name.toLowerCase().includes(needle)) && (!allied || !!c.alliance) && (!lost || c.capitalHeld === false))
      .sort((a, b) => { const x = val(a), y = val(b); return sort === "name" ? String(x).localeCompare(String(y)) : (y as number) - (x as number); });
  }, [rows, q, sort, allied, lost, d.dir]);

  const maxDev = useMemo(() => Math.max(1, ...rows.map((c) => c.development ?? 0)), [rows]);
  const totals = useMemo(() => ({ citizens: shown.reduce((n, c) => n + (c.citizens ?? 0), 0), regions: shown.reduce((n, c) => n + (c.regions ?? 0), 0) }), [shown]);
  const sorts: [SortKey, string][] = [["development", m.development], ["citizens", m.citizens], ["regions", m.regions], ["name", m.country]];

  return (
    <>
      <div className={s.kpis}>
        <div><b>{nf.format(shown.length)}</b><span>{m.countriesCount}</span></div>
        <div><b>{nf.format(totals.citizens)}</b><span>{m.totalCitizens}</span></div>
        <div><b>{nf.format(totals.regions)}</b><span>{m.totalRegions}</span></div>
      </div>
      <div className={s.bar}>
        <label className={s.search}>
          <Icon name="search" size={15} />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={m.searchPlaceholder} aria-label={m.searchPlaceholder} />
        </label>
        <div className={s.sorts} role="group" aria-label={d.m.ui.sortBy}>
          {sorts.map(([k, label]) => <button key={k} type="button" aria-pressed={sort === k} onClick={() => setSort(k)}>{label}</button>)}
        </div>
        <div className={s.flags}>
          <button type="button" aria-pressed={allied} onClick={() => setAllied(!allied)}>{m.onlyAllied}</button>
          <button type="button" aria-pressed={lost} onClick={() => setLost(!lost)}>{m.capitalLost}</button>
        </div>
      </div>
      {shown.length === 0 ? <p className={s.empty}>{m.noMatch}</p> : (
        <div className={s.grid}>
          {shown.map((c, i) => {
            const core = coreControl(c);
            return (
              <article key={c.id} className={s.card}>
                {idOk(c.id) && <Link className={s.cover} href={`/countries/${encodeURIComponent(c.id)}`} aria-label={countryName(c.id, d.dir)} />}
                <div className={s.top}>
                  {sort === "development" && !q && !allied && !lost && <span className={s.rank}>{i + 1}</span>}
                  <Flag id={c.id} d={d} />
                  <div className={s.who}>
                    <span className={s.name} dir="auto">{countryName(c.id, d.dir)}</span>
                    {c.alliance ? <Link className={s.ally} href={`/alliances/${encodeURIComponent(c.alliance.id)}`}>{c.alliance.name}</Link> : null}
                    {c.capitalHeld === false && <span className={s.lost}>{m.capitalLost}</span>}
                  </div>
                </div>
                <div className={s.dev}>
                  <header><span>{m.development}</span><b>{c.development == null ? "—" : nf.format(c.development)}</b></header>
                  <div className={s.track}><i style={{ inlineSize: `${((c.development ?? 0) / maxDev) * 100}%` }} /></div>
                </div>
                <dl className={s.facts}>
                  <div><dt>{m.citizens}</dt><dd>{c.citizens == null ? "—" : <>{nf.format(c.activeCitizens ?? 0)}<small> / {nf.format(c.citizens)}</small></>}</dd></div>
                  <div><dt>{m.regions}</dt><dd>{c.regions == null ? "—" : nf.format(c.regions)}</dd></div>
                  <div><dt>{m.core}</dt><dd>{core.total > 0 ? <>{core.held}<small> / {core.total}</small></> : "—"}</dd></div>
                </dl>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
