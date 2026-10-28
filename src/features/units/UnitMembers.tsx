"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { MobileSort } from "@/components/MobileSort";
import { CountryBadge } from "@/features/entities/entities";
import type { Display } from "@/features/entities/display";
import { RemoteImage } from "@/features/entities/RemoteImage";
import type { Messages } from "@/i18n/messages";
import { BuildBadge } from "@/features/builds/BuildBadge";
import type { BuildKind } from "@/features/builds/classify";
import type { UnitMember } from "@/lib/domain/unit-detail";
import { barPercent, maxWeekly, sortMembers, type MemberSortKey } from "./profile";

export interface MemberRow extends UnitMember { agoText: string | null; build: BuildKind | null }

const COLS: { key: MemberSortKey; label: keyof Messages["unitPage"] }[] = [
  { key: "name", label: "player" }, { key: "country", label: "country" }, { key: "weekly", label: "weekly" },
  { key: "lifetime", label: "lifetime" }, { key: "active", label: "lastActive" },
];

/** Verified columns only (role, level, country, weekly + lifetime damage, presence, joined). Unavailable data shows an explicit dash, never 0. */
export function UnitMembers({ rows, d, m, b }: { rows: MemberRow[]; d: Display; m: Messages["unitPage"]; b: Messages["builds"] }) {
  const [sort, setSort] = useState<{ key: MemberSortKey; dir: 1 | -1 }>({ key: "weekly", dir: -1 });
  const nf = useMemo(() => new Intl.NumberFormat(d.nl), [d.nl]);
  const sorted = useMemo(() => sortMembers(rows, sort.key, sort.dir) as MemberRow[], [rows, sort]);
  const max = useMemo(() => maxWeekly(rows), [rows]);
  const fmt = (v: string | null) => (v === null ? <span className="muted" title={m.notProvided}>—</span> : nf.format(BigInt(v)));
  const head = (k: MemberSortKey, label: string, cls?: string) => (
    <th scope="col" className={cls} aria-sort={sort.key === k ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
      <button type="button" className="sortbtn" onClick={() => setSort((s) => ({ key: k, dir: s.key === k ? (s.dir === 1 ? -1 : 1) : (k === "name" || k === "country" ? 1 : -1) }))}>{label}</button>
    </th>
  );

  return (
    <>
      <MobileSort label={m.sortBy} value={sort.key} dir={sort.dir === 1 ? "asc" : "desc"} onKey={(k) => setSort((s) => ({ ...s, key: k as MemberSortKey }))} onDir={() => setSort((s) => ({ ...s, dir: s.dir === 1 ? -1 : 1 }))}
        options={COLS.map((c) => ({ key: c.key, label: m[c.label] as string }))} />
      <div className="tablewrap">
        <table className="table members-table">
          <thead>
            <tr>
              {head("name", m.player)}<th scope="col">{b.column}</th>{head("country", m.country)}{head("weekly", m.weekly, "num")}{head("lifetime", m.lifetime, "num")}{head("active", m.lastActive)}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => {
              const pct = barPercent(r.weeklyDamage, max);
              const role = (m.role as Record<string, string>)[r.role] ?? r.role;
              return (
                <tr key={r.id}>
                  <td data-label={m.player}>
                    <div className="idcell">
                      <RemoteImage src={r.avatar} size={36} round fallback={<span className="seat-fallback" aria-hidden="true">{r.name.slice(0, 2).toUpperCase()}</span>} />
                      <div className="idtext">
                        <Link className="nm" href={`/players/${encodeURIComponent(r.id)}`} title={r.name} dir="auto">{r.name}</Link>
                        <span className="sub">{role}{r.level !== null ? ` · ${m.level} ${r.level}` : ""}</span>
                      </div>
                    </div>
                  </td>
                  <td data-label={b.column}><BuildBadge kind={r.build} m={b} /></td>
                  <td data-label={m.country}>{r.countryId ? <CountryBadge id={r.countryId} d={d} /> : <span className="muted" title={m.notProvided}>—</span>}</td>
                  <td data-label={m.weekly} className="num">
                    <div className="dmgcell">
                      <span>{fmt(r.weeklyDamage)}</span>
                      {pct !== null ? <span className="dmgbar" aria-hidden="true"><span style={{ inlineSize: `${pct}%` }} /></span> : null}
                    </div>
                  </td>
                  <td data-label={m.lifetime} className="num">{fmt(r.totalDamage)}</td>
                  <td data-label={m.lastActive}>
                    <span className="presence">
                      <span className="pdot" data-online={r.online === null ? "unknown" : String(r.online)} aria-hidden="true" />
                      <span className="sr-only">{r.online === null ? m.unknownPresence : r.online ? m.onlineNow : m.offline}</span>
                      {r.lastActiveAt ? <time dateTime={r.lastActiveAt} title={r.lastActiveAt}>{r.online ? m.onlineNow : r.agoText ?? "—"}</time> : <span className="muted" title={m.notProvided}>—</span>}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
