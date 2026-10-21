"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { MobileSort } from "@/components/MobileSort";
import { RemoteImage } from "@/features/entities/RemoteImage";
import { CountryBadge, PlayerChip, RegionLink } from "@/features/entities/entities";
import type { Display } from "@/features/entities/display";
import type { Messages } from "@/i18n/messages";
import type { UnitRow } from "@/lib/domain/units";
import { filterUnits, sortUnits, summarize, type SortDir, type SortKey } from "./logic";

interface Props { rows: UnitRow[]; m: Messages["units"]; noneLabel: string; allLabel: string; numberLocale: string; d: Display }

const COLS: { key: SortKey; label: keyof Messages["units"]["columns"]; numeric?: boolean }[] = [
  { key: "name", label: "unit" }, { key: "country", label: "country" }, { key: "owner", label: "owner" },
  { key: "members", label: "members", numeric: true }, { key: "hq", label: "hq", numeric: true },
  { key: "damage", label: "damage", numeric: true }, { key: "policy", label: "policy" },
];

export function UnitsTable({ rows, m, noneLabel, allLabel, numberLocale, d }: Props) {
  const [query, setQuery] = useState("");
  const [policy, setPolicy] = useState("all");
  const [country, setCountry] = useState("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "damage", dir: "desc" });
  const fmt = useMemo(() => new Intl.NumberFormat(numberLocale), [numberLocale]);

  const countries = useMemo(() => [...new Set(rows.map((r) => r.countryId).filter((c): c is string => !!c))].sort(), [rows]);
  const policies = useMemo(() => [...new Set(rows.map((r) => r.joinPolicy).filter((c): c is string => !!c))].sort(), [rows]);
  const shown = useMemo(() => sortUnits(filterUnits(rows, { query, policy, country }), sort.key, sort.dir), [rows, query, policy, country, sort]);
  const totals = useMemo(() => summarize(shown), [shown]);
  const policyLabel = (p: string | null) => (p === null ? noneLabel : ((m.policies as Record<string, string>)[p] ?? p));

  return (
    <>
      <dl className="stats">
        <div className="stat"><dt>{m.count}</dt><dd>{fmt.format(totals.count)}</dd></div>
        <div className="stat"><dt>{m.totalMembers}</dt><dd>{fmt.format(totals.members)}</dd></div>
        <div className="stat"><dt>{m.totalDamage}</dt><dd>{fmt.format(totals.damage)}</dd></div>
      </dl>
      <p className="note">{m.calculated}</p>

      <div className="toolbar">
        <input className="field" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={m.search} aria-label={m.search} />
        <select className="field" value={policy} onChange={(e) => setPolicy(e.target.value)} aria-label={m.policy}>
          <option value="all">{m.policy}: {allLabel}</option>
          {policies.map((p) => <option key={p} value={p}>{policyLabel(p)}</option>)}
        </select>
        <select className="field" value={country} onChange={(e) => setCountry(e.target.value)} aria-label={m.country}>
          <option value="all">{m.country}: {allLabel}</option>
          {countries.map((c) => <option key={c} value={c}>{d.dir.countries[c]?.name ?? c.toUpperCase()}</option>)}
        </select>
      </div>

      <MobileSort label={d.m.ui.sortBy} value={sort.key} dir={sort.dir} onKey={(k) => setSort((s) => ({ ...s, key: k as SortKey }))} onDir={() => setSort((s) => ({ ...s, dir: s.dir === "asc" ? "desc" : "asc" }))}
        options={COLS.map((c) => ({ key: c.key, label: m.columns[c.label] }))} />
      <div className="tablewrap">
        <table className="table">
          <thead>
            <tr>
              {COLS.map((c) => (
                <th key={c.key} scope="col" aria-sort={sort.key === c.key ? (sort.dir === "asc" ? "ascending" : "descending") : "none"} className={c.numeric ? "num" : undefined}>
                  <button type="button" className="sortbtn" onClick={() => setSort((s) => ({ key: c.key, dir: s.key === c.key && s.dir === "desc" ? "asc" : "desc" }))}>
                    {m.columns[c.label]}{sort.key === c.key ? (sort.dir === "asc" ? " ▲" : " ▼") : ""}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id}>
                <td>
                  <span className="unitcell">
                    <RemoteImage src={r.logoSrc} size={32} cls="logo" fallback={<span className="logo-fallback" aria-hidden="true">{r.name.slice(0, 1).toUpperCase()}</span>} />
                    <span><Link href={`/units/${encodeURIComponent(r.id)}`}><b>{r.name}</b></Link>{r.regionId ? <span className="hint" style={{ display: "block" }}><RegionLink id={r.regionId} d={d} /></span> : null}</span>
                  </span>
                </td>
                <td>{r.countryId ? <CountryBadge id={r.countryId} d={d} /> : noneLabel}</td>
                <td>{r.ownerName ? <PlayerChip id={r.ownerId} name={r.ownerName} d={d} /> : noneLabel}</td>
                <td className="num">{r.members === null ? "-" : `${fmt.format(r.members)}${r.capacity === null ? "" : ` / ${fmt.format(r.capacity)}`}`}</td>
                <td className="num">{r.hqLevel === null ? "-" : `${m.hqLevel} ${fmt.format(r.hqLevel)}`}{r.hqStatus ? ` · ${r.hqStatus}` : ""}</td>
                <td className="num">{r.damage === null ? "-" : fmt.format(BigInt(r.damage))}</td>
                <td><span className="chip">{policyLabel(r.joinPolicy)}</span></td>
              </tr>
            ))}
            {shown.length === 0 && <tr><td colSpan={COLS.length}>{m.noMatches}</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
