"use client";

import Link from "next/link";
import { SortTh, useSort } from "@/components/Sortable";
import { RemoteImage } from "@/features/entities/RemoteImage";

export interface PartyMemberRow { id: string; name: string; avatar: string | null; role: string; roleLabel: string; roleRank: number; level: number | null; joinedAt: string | null; joinedText: string | null }
const safe = (v: string) => /^[A-Za-z0-9_-]{1,80}$/.test(v);
const initials = (n: string) => n.trim().slice(0, 2).toUpperCase();

/** Party members: avatar + name (link to the player), role, level, joined date. Sorts raw values (role by rank, dates by ISO time, level as a number). */
export function PartyMembersTable({ rows, labels, nl }: { rows: PartyMemberRow[]; labels: { player: string; role: string; level: string; joined: string }; nl: string }) {
  const data = rows.map((r) => ({ ...r, nameKey: r.name.toLowerCase(), joinedKey: r.joinedAt ? Date.parse(r.joinedAt) : null }));
  const { sort, sorted, toggle } = useSort(data as unknown as Record<string, unknown>[], { key: "roleRank", dir: "asc" });
  const list = sorted as unknown as typeof data;
  const nf = new Intl.NumberFormat(nl);
  return (
    <div className="tablewrap">
      <table className="table">
        <thead>
          <tr>
            <SortTh k="nameKey" sort={sort} onSort={toggle}>{labels.player}</SortTh>
            <SortTh k="roleRank" sort={sort} onSort={toggle}>{labels.role}</SortTh>
            <SortTh k="level" sort={sort} onSort={toggle} defaultDir="desc" align="end">{labels.level}</SortTh>
            <SortTh k="joinedKey" sort={sort} onSort={toggle} align="end">{labels.joined}</SortTh>
          </tr>
        </thead>
        <tbody>
          {list.map((r) => {
            const fb = <span className="img img-round img-fallback" style={{ inlineSize: 26, blockSize: 26, fontSize: "0.6rem" }}>{initials(r.name)}</span>;
            const inner = <><RemoteImage src={r.avatar} size={26} round fallback={fb} /><span className="pname" dir="auto">{r.name}</span></>;
            return (
              <tr key={r.id}>
                <td data-label={labels.player}>{safe(r.id) ? <Link className="pline" href={`/players/${encodeURIComponent(r.id)}`} title={r.name}>{inner}</Link> : <span className="pline" title={r.name}>{inner}</span>}</td>
                <td data-label={labels.role}><span className="badge" data-tone={r.role === "leader" ? "warn" : undefined}>{r.roleLabel}</span></td>
                <td className="num" data-label={labels.level}>{r.level == null ? "—" : nf.format(r.level)}</td>
                <td className="num" data-label={labels.joined}>{r.joinedText ?? "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
