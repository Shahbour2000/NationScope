"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import { countryName, type Display } from "@/features/entities/display";
import { Flag } from "@/features/entities/entities";
import { isWarOngoing } from "@/features/wars/state";
import { warDurationMs } from "@/features/economy/analytics";
import { formatDuration } from "@/lib/format";
import type { Messages } from "@/i18n/messages";
import type { War } from "@/lib/domain/world";
import s from "./WarsBoard.module.css";

type Tab = "active" | "ended" | "all";
const PAGE = 24;
const idOk = (id: string) => /^[A-Za-z0-9_-]{1,80}$/.test(id);
const fill = (t: string, v: Record<string, string>) => t.replace(/\{(\w+)\}/g, (_, k: string) => v[k] ?? "");

function Side({ id, note, hot, d }: { id: string; note: string; hot: boolean; d: Display }) {
  const inner = (
    <>
      <Flag id={id} d={d} />
      <span className={s.name} dir="auto">{countryName(id, d.dir)}</span>
      <span className={s.note} data-hot={hot}>{note}</span>
    </>
  );
  return idOk(id) ? <Link className={s.side} href={`/countries/${encodeURIComponent(id)}`}>{inner}</Link> : <span className={s.side}>{inner}</span>;
}

function WarCard({ w, d, m, nowMs }: { w: War; d: Display; m: Messages["warsPage"]; nowMs: number }) {
  const live = isWarOngoing(w);
  const t = (ms: number) => formatDuration(ms, d.m.time);
  const until = live && w.priority?.until ? Date.parse(w.priority.until) : NaN;
  const initiative = Number.isFinite(until) && until > nowMs ? w.priority?.countryId ?? null : null;
  const declared = w.declaredAt ? Date.parse(w.declaredAt) : NaN;
  const dur = warDurationMs(w, nowMs);
  const when = live ? (Number.isFinite(declared) ? fill(m.declaredAgo, { t: t(Math.max(0, nowMs - declared)) }) : "") : dur !== null ? fill(m.lasted, { t: t(dur) }) : "";
  const short = (ms: number) => (ms >= 3600_000 ? `${Math.floor(ms / 3600_000)}${d.m.time.h}` : t(ms));
  const noteFor = (id: string) => (initiative === id ? fill(m.initiativeLeft, { t: short(until - nowMs) }) : w.declaredBy === id ? m.declaredTag : "");
  return (
    <article className={s.card} data-state={live ? "live" : "ended"}>
      <div className={s.top}>
        <span className={s.status} data-state={live ? "live" : "ended"}>{live ? m.tabActive : m.tabEnded}</span>
        {w.proposalId && <Link className={s.law} href={`/laws/${encodeURIComponent(w.proposalId)}`}>{m.viewLaw}</Link>}
      </div>
      <div className={s.versus}>
        <Side id={w.countryA} note={noteFor(w.countryA)} hot={initiative === w.countryA} d={d} />
        <span className={s.vs} aria-label={m.versus}>VS</span>
        <Side id={w.countryB} note={noteFor(w.countryB)} hot={initiative === w.countryB} d={d} />
      </div>
      <div className={s.foot}>
        <span>{when}</span>
        <span><b>{w.activeBattles ?? 0}</b> {m.active} · <b>{w.finishedBattles ?? 0}</b> {m.finished}</span>
      </div>
    </article>
  );
}

export function WarsBoard({ rows, d, m, nowMs }: { rows: War[]; d: Display; m: Messages["warsPage"]; nowMs: number }) {
  const [tab, setTab] = useState<Tab>("active");
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const nf = new Intl.NumberFormat(d.nl);
  const counts = useMemo(() => ({ active: rows.filter(isWarOngoing).length, ended: rows.filter((w) => !isWarOngoing(w)).length, all: rows.length }), [rows]);
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const key = (w: War) => (isWarOngoing(w) ? w.declaredAt : w.endedAt ?? w.declaredAt) ?? "";
    return rows
      .filter((w) => (tab === "all" || (tab === "active") === isWarOngoing(w)) && (!needle || [w.countryA, w.countryB].some((c) => countryName(c, d.dir).toLowerCase().includes(needle))))
      .sort((a, b) => Number(isWarOngoing(b)) - Number(isWarOngoing(a)) || key(b).localeCompare(key(a)));
  }, [rows, tab, q, d.dir]);
  const tabs: [Tab, string][] = [["active", m.tabActive], ["ended", m.tabEnded], ["all", m.tabAll]];
  return (
    <>
      <div className={s.bar}>
        <div className={s.tabs} role="tablist" aria-label={m.status}>
          {tabs.map(([k, label]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => { setTab(k); setLimit(PAGE); }}>{label} <small>{nf.format(counts[k])}</small></button>
          ))}
        </div>
        <label className={s.search}>
          <Icon name="search" size={15} />
          <input type="search" value={q} onChange={(e) => { setQ(e.target.value); setLimit(PAGE); }} placeholder={m.searchPlaceholder} aria-label={m.searchPlaceholder} />
        </label>
      </div>
      {shown.length === 0 ? <p className={s.empty}>{m.noMatch}</p> : <div className={s.grid}>{shown.slice(0, limit).map((w) => <WarCard key={w.id} w={w} d={d} m={m} nowMs={nowMs} />)}</div>}
      {shown.length > limit && <button type="button" className={s.more} onClick={() => setLimit(limit + PAGE)}>{m.more}</button>}
    </>
  );
}
