"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CountryBadge, Dt, StatusBadge } from "@/features/entities/entities";
import { countryName, type Display } from "@/features/entities/display";
import { warDurationMs } from "@/features/economy/analytics";
import { formatDuration } from "@/lib/format";
import type { Messages } from "@/i18n/messages";
import type { War } from "@/lib/domain/world";

export function WarsTable({ rows, d, m, nowMs }: { rows: War[]; d: Display; m: Messages["warsPage"]; nowMs: number }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows
      .filter((w) => (status === "all" || w.status === status) && (!needle || [w.countryA, w.countryB].some((c) => countryName(c, d.dir).toLowerCase().includes(needle))))
      .sort((a, b) => (b.declaredAt ?? "").localeCompare(a.declaredAt ?? ""));
  }, [rows, q, status, d.dir]);
  const active = rows.filter((w) => w.status === "active").length;
  const ended = rows.filter((w) => w.status === "ended").length;
  const nf = new Intl.NumberFormat(d.nl);

  return (
    <>
      <dl className="stats">
        <div className="stat"><dt>{m.activeWars}</dt><dd>{nf.format(active)}</dd></div>
        <div className="stat"><dt>{m.endedWars}</dt><dd>{nf.format(ended)}</dd></div>
      </dl>
      <p className="note">{m.sumNote}</p>
      <div className="filterbar">
        <label>{m.searchPlaceholder}<input className="field" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={m.searchPlaceholder} /></label>
        <label>{m.status}
          <select className="field" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">{m.allStatuses}</option>
            <option value="active">{d.m.t.status.active}</option>
            <option value="ended">{d.m.t.status.ended}</option>
          </select>
        </label>
      </div>
      <div className="tablewrap">
        <table className="table">
          <thead><tr><th scope="col">{m.sides}</th><th scope="col">{m.status}</th><th scope="col">{m.declared}</th><th scope="col">{m.declaredBy}</th><th scope="col">{m.duration}</th><th scope="col">{m.battles}</th><th scope="col">{m.law}</th></tr></thead>
          <tbody>
            {shown.map((w) => {
              const dur = warDurationMs(w, nowMs);
              return (
                <tr key={w.id}>
                  <td data-label={m.sides}><span className="compare"><CountryBadge id={w.countryA} d={d} /><span className="vs">{m.versus}</span><CountryBadge id={w.countryB} d={d} /></span></td>
                  <td data-label={m.status}><StatusBadge value={w.status} d={d} /></td>
                  <td data-label={m.declared}><Dt iso={w.declaredAt} d={d} /></td>
                  <td data-label={m.declaredBy}>{w.declaredBy ? <CountryBadge id={w.declaredBy} d={d} /> : "—"}</td>
                  <td data-label={m.duration}>{dur === null ? "—" : formatDuration(dur, d.m.time)}</td>
                  <td data-label={m.battles}>{(w.activeBattles ?? 0)} {m.active} · {(w.finishedBattles ?? 0)} {m.finished}</td>
                  <td data-label={m.law}>{w.proposalId ? <Link href={`/laws/${encodeURIComponent(w.proposalId)}`}>{m.viewLaw}</Link> : "—"}</td>
                </tr>
              );
            })}
            {shown.length === 0 && <tr><td colSpan={7}>{m.noMatch}</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="hint">{m.durationNote}</p>
    </>
  );
}
