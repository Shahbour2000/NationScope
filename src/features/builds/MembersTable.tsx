"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { SortTh, useSort } from "@/components/Sortable";
import { countryName, type Display } from "@/features/entities/display";
import { Avatar, Flag } from "@/features/entities/entities";
import type { Messages } from "@/i18n/messages";

export interface MemberListRow { id: string; name: string; avatar: string | null; level: number | null; countryId: string | null; countryName: string; warShare: number | null; ecoShare: number | null }
const PAGE = 50;
const safe = (v: string) => /^[A-Za-z0-9_-]{1,80}$/.test(v);

/** Members of one WAR / ECO / HYBRID group: client-side search, shared sorting (raw values) and paging. Each player links to their profile. */
export function MembersTable({ rows, d, labels, nl }: { rows: MemberListRow[]; d: Display; labels: { player: string; country: string; level: string; war: string; eco: string; search: string; prev: string; next: string; page: string; none: string }; nl: string }) {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const needle = q.trim().toLowerCase();
  const filtered = useMemo(() => (needle ? rows.filter((r) => r.name.toLowerCase().includes(needle)) : rows), [rows, needle]);
  const { sort, sorted, toggle } = useSort(filtered as unknown as Record<string, unknown>[], { key: "level", dir: "desc" });
  const list = sorted as unknown as MemberListRow[];
  const pages = Math.max(1, Math.ceil(list.length / PAGE)), cur = Math.min(page, pages - 1);
  const shown = list.slice(cur * PAGE, cur * PAGE + PAGE);
  const nf = new Intl.NumberFormat(nl), pf = new Intl.NumberFormat(nl, { maximumFractionDigits: 1 });
  const onSort = (k: string, dd?: "asc" | "desc") => { toggle(k, dd); setPage(0); };
  return (
    <>
      <div className="toolbar"><input className="field" type="search" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} placeholder={labels.search} aria-label={labels.search} /></div>
      <div className="tablewrap">
        <table className="table">
          <thead>
            <tr>
              <SortTh k="name" sort={sort} onSort={onSort}>{labels.player}</SortTh>
              <SortTh k="countryName" sort={sort} onSort={onSort}>{labels.country}</SortTh>
              <SortTh k="level" sort={sort} onSort={onSort} defaultDir="desc" align="end">{labels.level}</SortTh>
              <SortTh k="warShare" sort={sort} onSort={onSort} defaultDir="desc" align="end">{labels.war}</SortTh>
              <SortTh k="ecoShare" sort={sort} onSort={onSort} defaultDir="desc" align="end">{labels.eco}</SortTh>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id}>
                <td data-label={labels.player}>
                  {safe(r.id) ? <Link className="pline" href={`/players/${encodeURIComponent(r.id)}`} title={r.name}><Avatar path={r.avatar} d={d} size={26} /><span className="pname" dir="auto">{r.name}</span></Link> : <span className="pline"><Avatar path={r.avatar} d={d} size={26} /><span className="pname" dir="auto" title={r.name}>{r.name}</span></span>}
                </td>
                <td data-label={labels.country}>{r.countryId && safe(r.countryId) ? <Link className="cbadge" href={`/countries/${encodeURIComponent(r.countryId)}`}><Flag id={r.countryId} d={d} /><span className="cname" title={countryName(r.countryId, d.dir)}>{countryName(r.countryId, d.dir)}</span></Link> : "\u2014"}</td>
                <td data-label={labels.level} style={{ textAlign: "end" }}>{r.level == null ? "\u2014" : nf.format(r.level)}</td>
                <td data-label={labels.war} style={{ textAlign: "end" }}>{r.warShare == null ? "\u2014" : `${pf.format(r.warShare)}%`}</td>
                <td data-label={labels.eco} style={{ textAlign: "end" }}>{r.ecoShare == null ? "\u2014" : `${pf.format(r.ecoShare)}%`}</td>
              </tr>
            ))}
            {shown.length === 0 && <tr><td colSpan={5}>{labels.none}</td></tr>}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="pager">
          <button type="button" className="btn-ghost" disabled={cur === 0} onClick={() => setPage(cur - 1)}>{labels.prev}</button>
          <span>{labels.page} {nf.format(cur + 1)} / {nf.format(pages)}</span>
          <button type="button" className="btn-ghost" disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)}>{labels.next}</button>
        </div>
      )}
    </>
  );
}
export type { Messages };
