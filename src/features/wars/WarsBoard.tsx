"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import { countryName, type Display } from "@/features/entities/display";
import { Flag } from "@/features/entities/entities";
import { isWarOngoing } from "@/features/wars/state";
import { warDurationMs } from "@/features/economy/analytics";
import { formatDate, formatDuration } from "@/lib/format";
import type { Messages } from "@/i18n/messages";
import type { War } from "@/lib/domain/world";

type Tab = "active" | "ended" | "all";
const PAGE = 24;
const idOk = (id: string) => /^[A-Za-z0-9_-]{1,80}$/.test(id);

function Side({ id, declared, d, m }: { id: string; declared: boolean; d: Display; m: Messages["warsPage"] }) {
  const inner = (
    <>
      <Flag id={id} d={d} />
      <b dir="auto">{countryName(id, d.dir)}</b>
      {declared && <small className="wcard-tag"><Icon name="war" size={11} /> {m.declaredTag}</small>}
    </>
  );
  return idOk(id) ? <Link className="wcard-side" href={`/countries/${encodeURIComponent(id)}`}>{inner}</Link> : <span className="wcard-side">{inner}</span>;
}

function WarCard({ w, d, m, nowMs }: { w: War; d: Display; m: Messages["warsPage"]; nowMs: number }) {
  const live = isWarOngoing(w);
  const dur = warDurationMs(w, nowMs);
  const until = live && w.priority?.until ? Date.parse(w.priority.until) : NaN;
  const hasInitiative = Number.isFinite(until) && until > nowMs && !!w.priority;
  return (
    <article className="wcard" data-state={live ? "live" : "ended"}>
      <div className="wcard-top">
        <span className="wstate" data-state={live ? "live" : "ended"}>{live && <i className="pulse" aria-hidden="true" />}{live ? m.tabActive : m.tabEnded}</span>
        <time dateTime={w.declaredAt ?? undefined}>{formatDate(w.declaredAt, d.nl) ?? "—"}</time>
      </div>
      <div className="wcard-sides">
        <Side id={w.countryA} declared={w.declaredBy === w.countryA} d={d} m={m} />
        <span className="wcard-vs" aria-label={m.versus}><Icon name="war" size={18} /></span>
        <Side id={w.countryB} declared={w.declaredBy === w.countryB} d={d} m={m} />
      </div>
      <div className="wcard-foot">
        {hasInitiative && w.priority && (
          <span className="pill" data-tone="initiative" title={m.initiativeTip}>
            <Flag id={w.priority.countryId} d={d} /> <Icon name="clock" size={13} /> {formatDuration(until - nowMs, d.m.time)} {m.left}
          </span>
        )}
        <span className="pill" title={m.battlesTip}><Icon name="battle" size={13} /> <b>{w.activeBattles ?? 0}</b><small>/ {w.finishedBattles ?? 0}</small></span>
        {dur !== null && <span className="pill" title={m.durationTip}><Icon name="clock" size={13} /> {formatDuration(dur, d.m.time)}</span>}
        {w.proposalId && <Link className="pill pill-link" href={`/laws/${encodeURIComponent(w.proposalId)}`} title={m.lawTip} aria-label={m.lawTip}><Icon name="landmark" size={13} /></Link>}
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
      <div className="board-bar">
        <div className="ptabs" role="tablist" aria-label={m.status}>
          {tabs.map(([k, label]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => { setTab(k); setLimit(PAGE); }}>
              {label} <span className="ptabs-n">{nf.format(counts[k])}</span>
            </button>
          ))}
        </div>
        <input className="field board-search" type="search" value={q} onChange={(e) => { setQ(e.target.value); setLimit(PAGE); }} placeholder={m.searchPlaceholder} aria-label={m.searchPlaceholder} />
      </div>
      {shown.length === 0 ? <p className="empty-mini">{m.noMatch}</p> : (
        <div className="wgrid">{shown.slice(0, limit).map((w) => <WarCard key={w.id} w={w} d={d} m={m} nowMs={nowMs} />)}</div>
      )}
      {shown.length > limit && <button type="button" className="btn-more" onClick={() => setLimit(limit + PAGE)}>{m.more}</button>}
    </>
  );
}
