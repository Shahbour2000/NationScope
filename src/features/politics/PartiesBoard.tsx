"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import { countryName, type Display } from "@/features/entities/display";
import { RemoteImage } from "@/features/entities/RemoteImage";
import { Flag } from "@/features/entities/entities";
import type { Messages } from "@/i18n/messages";
import type { Party } from "@/lib/domain/world";
import { ethicLabel } from "./ethics";
import { humanizeCode } from "@/lib/format";
import s from "./PartiesBoard.module.css";

export type WorldParty = Party & { countryId: string; logoSrc: string | null };
type SortKey = "members" | "name" | "founded";
const idOk = (id: string) => /^[A-Za-z0-9_-]{1,80}$/.test(id);

export function PartiesBoard({ rows, d, m }: { rows: WorldParty[]; d: Display; m: Messages["worldParties"] & { ethic: Messages["partiesPage"]["ethic"] } }) {
  const [q, setQ] = useState("");
  const [country, setCountry] = useState("all");
  const [sort, setSort] = useState<SortKey>("members");
  const nf = useMemo(() => new Intl.NumberFormat(d.nl), [d.nl]);
  const countries = useMemo(() => [...new Set(rows.map((r) => r.countryId))].sort((a, b) => countryName(a, d.dir).localeCompare(countryName(b, d.dir))), [rows, d.dir]);
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows
      .filter((r) => (country === "all" || r.countryId === country) && (!needle || r.name.toLowerCase().includes(needle) || (r.leaderName ?? "").toLowerCase().includes(needle)))
      .sort((a, b) => sort === "name" ? a.name.localeCompare(b.name) : sort === "founded" ? (b.createdAt ?? "").localeCompare(a.createdAt ?? "") : (b.members ?? 0) - (a.members ?? 0) || a.name.localeCompare(b.name));
  }, [rows, q, country, sort]);
  const sorts: [SortKey, string][] = [["members", m.sortMembers], ["name", m.sortName], ["founded", m.sortFounded]];
  return (
    <>
      <div className={s.bar}>
        <label className={s.search}><Icon name="search" size={15} /><input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={m.search} aria-label={m.search} /></label>
        <select value={country} onChange={(e) => setCountry(e.target.value)} aria-label={m.country}>
          <option value="all">{m.allCountries}</option>
          {countries.map((c) => <option key={c} value={c}>{countryName(c, d.dir)}</option>)}
        </select>
        <div className={s.sorts} role="group" aria-label={d.m.ui.sortBy}>
          {sorts.map(([k, label]) => <button key={k} type="button" aria-pressed={sort === k} onClick={() => setSort(k)}>{label}</button>)}
        </div>
      </div>
      {shown.length === 0 ? <p className={s.empty}>{m.noMatch}</p> : (
        <div className={s.grid}>
          {shown.map((r) => (
            <article key={r.id} className={s.card} data-ruling={!!r.ruling}>
              {idOk(r.id) && <Link className={s.cover} href={`/parties/${encodeURIComponent(r.id)}`} aria-label={r.name} />}
              <div className={s.top}>
                <div className={s.logo}><RemoteImage src={r.logoSrc} size={52} cls="" fallback={<span aria-hidden="true">{r.name.slice(0, 1).toUpperCase()}</span>} /></div>
                <div className={s.who}>
                  <span className={s.name} dir="auto" title={r.name}>{r.name}</span>
                  <span className={s.sub}><Flag id={r.countryId} d={d} /><span>{countryName(r.countryId, d.dir)}</span></span>
                </div>
                {r.ruling && <span className={s.rul}>{m.ruling}</span>}
              </div>
              {r.ethics && r.ethics.length > 0 && <div className={s.eth}>{r.ethics.slice(0, 3).map((e) => <span key={e}>{ethicLabel(e, m.ethic, humanizeCode)}</span>)}</div>}
              <div className={s.foot}><span className={s.sub}>{r.leaderName ? <span dir="auto">{m.leader}: {r.leaderName}</span> : null}</span><span><b>{nf.format(r.members ?? 0)}</b> {m.members}</span></div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
