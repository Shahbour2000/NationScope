"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import { RemoteImage } from "@/features/entities/RemoteImage";
import { Flag } from "@/features/entities/entities";
import { countryName, type Display } from "@/features/entities/display";
import type { Messages } from "@/i18n/messages";
import type { UnitRow } from "@/lib/domain/units";
import { filterUnits, sortUnits, summarize, type SortKey } from "./logic";
import s from "./UnitsBoard.module.css";

const PAGE = 24;
const idOk = (id: string) => /^[A-Za-z0-9_-]{1,80}$/.test(id);

export function UnitsBoard({ rows, m, noneLabel, allLabel, numberLocale, d, moreLabel }: { rows: UnitRow[]; m: Messages["units"]; noneLabel: string; allLabel: string; numberLocale: string; d: Display; moreLabel: string }) {
  const [query, setQuery] = useState("");
  const [policy, setPolicy] = useState("all");
  const [country, setCountry] = useState("all");
  const [sort, setSort] = useState<SortKey>("damage");
  const [limit, setLimit] = useState(PAGE);
  const fmt = useMemo(() => new Intl.NumberFormat(numberLocale), [numberLocale]);
  const compact = useMemo(() => new Intl.NumberFormat(numberLocale, { notation: "compact", maximumFractionDigits: 1 }), [numberLocale]);
  const countries = useMemo(() => [...new Set(rows.map((r) => r.countryId).filter((c): c is string => !!c))].sort(), [rows]);
  const policies = useMemo(() => [...new Set(rows.map((r) => r.joinPolicy).filter((c): c is string => !!c))].sort(), [rows]);
  const shown = useMemo(() => sortUnits(filterUnits(rows, { query, policy, country }), sort, sort === "name" ? "asc" : "desc"), [rows, query, policy, country, sort]);
  const totals = useMemo(() => summarize(shown), [shown]);
  const maxDamage = useMemo(() => rows.reduce((mx, r) => (r.damage !== null && /^\d+$/.test(r.damage) && BigInt(r.damage) > mx ? BigInt(r.damage) : mx), 1n), [rows]);
  const policyLabel = (p: string | null) => (p === null ? noneLabel : ((m.policies as Record<string, string>)[p] ?? p));
  const sorts: [SortKey, string][] = [["damage", m.columns.damage], ["members", m.columns.members], ["name", m.columns.unit]];
  return (
    <>
      <div className={s.kpis}>
        <div><b>{fmt.format(totals.count)}</b><span>{m.count}</span></div>
        <div><b>{fmt.format(totals.members)}</b><span>{m.totalMembers}</span></div>
        <div><b>{compact.format(Number(totals.damage))}</b><span>{m.totalDamage}</span></div>
      </div>
      <div className={s.bar}>
        <label className={s.search}><Icon name="search" size={15} /><input type="search" value={query} onChange={(e) => { setQuery(e.target.value); setLimit(PAGE); }} placeholder={m.search} aria-label={m.search} /></label>
        <select value={policy} onChange={(e) => { setPolicy(e.target.value); setLimit(PAGE); }} aria-label={m.policy}>
          <option value="all">{m.policy}: {allLabel}</option>
          {policies.map((p) => <option key={p} value={p}>{policyLabel(p)}</option>)}
        </select>
        <select value={country} onChange={(e) => { setCountry(e.target.value); setLimit(PAGE); }} aria-label={m.country}>
          <option value="all">{m.country}: {allLabel}</option>
          {countries.map((c) => <option key={c} value={c}>{countryName(c, d.dir)}</option>)}
        </select>
        <div className={s.sorts} role="group" aria-label={d.m.ui.sortBy}>
          {sorts.map(([k, label]) => <button key={k} type="button" aria-pressed={sort === k} onClick={() => setSort(k)}>{label}</button>)}
        </div>
      </div>
      {shown.length === 0 ? <p className={s.empty}>{m.noMatches}</p> : (
        <div className={s.grid}>
          {shown.slice(0, limit).map((r) => {
            const dmg = r.damage !== null && /^\d+$/.test(r.damage) ? BigInt(r.damage) : null;
            return (
              <article key={r.id} className={s.card}>
                {idOk(r.id) && <Link className={s.cover} href={`/units/${encodeURIComponent(r.id)}`} aria-label={r.name} />}
                <div className={s.top}>
                  <div className={s.logo}><RemoteImage src={r.logoSrc} size={48} cls="" fallback={<span aria-hidden="true">{r.name.slice(0, 1).toUpperCase()}</span>} /></div>
                  <div className={s.who}>
                    <span className={s.name} dir="auto">{r.name}</span>
                    <span className={s.sub}>{r.countryId && <Flag id={r.countryId} d={d} />}{r.ownerName && r.ownerId && idOk(r.ownerId) ? <Link className="xlink" href={`/players/${encodeURIComponent(r.ownerId)}`} dir="auto">{r.ownerName}</Link> : <span dir="auto">{r.ownerName ?? (r.countryId ? countryName(r.countryId, d.dir) : noneLabel)}</span>}</span>
                  </div>
                </div>
                <div className={s.dmg}>
                  <header><span>{m.columns.damage}</span><b>{dmg === null ? "—" : compact.format(Number(dmg))}</b></header>
                  <div className={s.track}><i style={{ inlineSize: `${dmg === null ? 0 : Number((dmg * 1000n) / maxDamage) / 10}%` }} /></div>
                </div>
                <div className={s.facts}>
                  <span><b>{r.members === null ? "—" : fmt.format(r.members)}</b>{r.capacity === null ? "" : ` / ${fmt.format(r.capacity)}`} {m.columns.members}</span>
                  <span>{policyLabel(r.joinPolicy)}</span>
                </div>
              </article>
            );
          })}
        </div>
      )}
      {shown.length > limit && <button type="button" onClick={() => setLimit(limit + PAGE)} style={{ display: "block", margin: "1.4rem auto 0", padding: "0.55rem 1.6rem", font: "inherit", color: "#e6ebf7", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(148,163,184,0.25)", borderRadius: 999, cursor: "pointer" }}>{moreLabel}</button>}
    </>
  );
}
