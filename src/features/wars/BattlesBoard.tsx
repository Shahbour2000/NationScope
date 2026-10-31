"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Icon, type IconName } from "@/components/Icon";
import { countryName, type Display } from "@/features/entities/display";
import { Flag, Money, RegionLink } from "@/features/entities/entities";
import { isBattleOngoing } from "@/features/wars/state";
import { formatDate, formatDuration } from "@/lib/format";
import type { Messages } from "@/i18n/messages";
import type { Battle } from "@/lib/domain/world";

type Status = "live" | "done" | "all";
const TYPES = ["territorial", "resistance", "revolution", "tournament"] as const;
const TYPE_ICON: Record<(typeof TYPES)[number], IconName> = { territorial: "map", resistance: "shield", revolution: "flame", tournament: "trophy" };
const PAGE = 18;
const idOk = (id: string) => /^[A-Za-z0-9_-]{1,80}$/.test(id);
const digits = (v: string | null | undefined): bigint | null => (v != null && /^\d+$/.test(v) ? BigInt(v) : null);

function Side({ countryId, muId, side, won, d, m }: { countryId: string | null | undefined; muId: string | null | undefined; side: "a" | "d"; won: boolean; d: Display; m: Messages["battlesPage"] }) {
  const body = countryId ? (
    <>
      <Flag id={countryId} d={d} />
      <b dir="auto">{countryName(countryId, d.dir)}</b>
    </>
  ) : <b>{muId ? m.unit : "—"}</b>;
  return (
    <div className="bside" data-side={side} data-won={won}>
      {countryId && idOk(countryId) ? <Link href={`/countries/${encodeURIComponent(countryId)}`} className="bside-link">{body}</Link> : <span className="bside-link">{body}</span>}
      {muId && idOk(muId) && <Link className="bside-mu" href={`/units/${encodeURIComponent(muId)}`}><Icon name="shield" size={11} /> {m.unit}</Link>}
      {won && <span className="bside-win"><Icon name="trophy" size={12} /> {m.winner}</span>}
    </div>
  );
}

function BattleCard({ x, d, m, nowMs }: { x: Battle; d: Display; m: Messages["battlesPage"]; nowMs: number }) {
  const live = isBattleOngoing(x);
  const type = (TYPES as readonly string[]).includes(x.type) ? (x.type as (typeof TYPES)[number]) : null;
  const nf = new Intl.NumberFormat(d.nl);
  const compact = new Intl.NumberFormat(d.nl, { notation: "compact", maximumFractionDigits: 1 });
  const a = digits(x.round?.attackerDamage), b = digits(x.round?.defenderDamage);
  const total = a !== null && b !== null ? a + b : null;
  const aPct = total && total > 0n && a !== null ? Number((a * 100n) / total) : null;
  const winnerSide = !live && x.winner ? (x.winner === "attacker" || x.winner === x.attackerCountryId ? "a" : x.winner === "defender" || x.winner === x.defenderCountryId ? "d" : null) : null;
  const next = live && x.round?.nextTickAt ? Date.parse(x.round.nextTickAt) - nowMs : NaN;
  const hasBounty = x.bounty && (x.bounty.attacker !== "0" || x.bounty.defender !== "0") && (x.bounty.attacker || x.bounty.defender);
  return (
    <article className="bcard" data-type={type ?? "other"} data-state={live ? "live" : "done"}>
      <div className="bcard-top">
        <span className="btype" title={type ? m.typeInfo[type] : undefined}><Icon name={type ? TYPE_ICON[type] : "battle"} size={13} /> {type ? d.m.t.battleType[type] : x.type}</span>
        <span className="wstate" data-state={live ? "live" : "ended"}>{live && <i className="pulse" aria-hidden="true" />}{live ? `${m.round} ${x.round?.number ?? x.currentRound ?? "—"}` : d.m.t.status.ended}</span>
      </div>
      <div className="bcard-sides">
        <Side countryId={x.attackerCountryId} muId={x.attackerMuId} side="a" won={winnerSide === "a"} d={d} m={m} />
        <div className="bscore" aria-label={`${x.attackerRounds ?? 0} : ${x.defenderRounds ?? 0}`}><b>{x.attackerRounds ?? 0}</b><span>:</span><b>{x.defenderRounds ?? 0}</b></div>
        <Side countryId={x.defenderCountryId} muId={x.defenderMuId} side="d" won={winnerSide === "d"} d={d} m={m} />
      </div>
      {aPct !== null && a !== null && b !== null ? (
        <div className="btug" role="img" aria-label={`${nf.format(a)} – ${nf.format(b)}`}>
          <div className="btug-bar"><span style={{ inlineSize: `${aPct}%` }} /></div>
          <div className="btug-nums"><b>{compact.format(Number(a))}</b><b>{compact.format(Number(b))}</b></div>
        </div>
      ) : null}
      <div className="bcard-foot">
        {x.regionId && <span className="pill"><Icon name="map" size={13} /> <RegionLink id={x.regionId} d={d} /></span>}
        {Number.isFinite(next) && next > 0 && <span className="pill" title={m.nextTick}><Icon name="clock" size={13} /> {formatDuration(next, d.m.time)} {m.leftLabel}</span>}
        {!live && x.endedAt && <span className="pill"><Icon name="clock" size={13} /> {formatDate(x.endedAt, d.nl)}</span>}
        {hasBounty && <span className="pill" data-tone="gold" title={m.bounty}><Icon name="coins" size={13} /> <Money value={x.bounty?.attacker !== "0" ? x.bounty?.attacker : x.bounty?.defender} d={d} /></span>}
        <Link className="pill pill-link" href={`/battles/${encodeURIComponent(x.id)}`} aria-label={d.m.ui.details}><Icon name="chevronr" size={13} /></Link>
      </div>
    </article>
  );
}

export function BattlesBoard({ rows, d, m, nowMs }: { rows: Battle[]; d: Display; m: Messages["battlesPage"]; nowMs: number }) {
  const [status, setStatus] = useState<Status>("live");
  const [type, setType] = useState<string>("all");
  const [limit, setLimit] = useState(PAGE);
  const nf = new Intl.NumberFormat(d.nl);
  const counts = useMemo(() => ({ live: rows.filter(isBattleOngoing).length, done: rows.filter((x) => !isBattleOngoing(x)).length, all: rows.length }), [rows]);
  const typeCounts = useMemo(() => {
    const inStatus = rows.filter((x) => status === "all" || (status === "live") === isBattleOngoing(x));
    return Object.fromEntries(TYPES.map((t) => [t, inStatus.filter((x) => x.type === t).length])) as Record<(typeof TYPES)[number], number>;
  }, [rows, status]);
  const shown = useMemo(() => {
    const key = (x: Battle) => (isBattleOngoing(x) ? x.startedAt : x.endedAt ?? x.startedAt) ?? "";
    return rows
      .filter((x) => (status === "all" || (status === "live") === isBattleOngoing(x)) && (type === "all" || x.type === type))
      .sort((x, y) => Number(isBattleOngoing(y)) - Number(isBattleOngoing(x)) || key(y).localeCompare(key(x)));
  }, [rows, status, type]);
  const tabs: [Status, string][] = [["live", m.tabLive], ["done", m.tabDone], ["all", m.tabAll]];
  return (
    <>
      <div className="board-bar">
        <div className="ptabs" role="tablist" aria-label={m.status}>
          {tabs.map(([k, label]) => (
            <button key={k} type="button" role="tab" aria-selected={status === k} onClick={() => { setStatus(k); setLimit(PAGE); }}>{label} <span className="ptabs-n">{nf.format(counts[k])}</span></button>
          ))}
        </div>
        <div className="tchips" role="group" aria-label={m.type}>
          <button type="button" aria-pressed={type === "all"} onClick={() => { setType("all"); setLimit(PAGE); }}>{m.allTypes}</button>
          {TYPES.map((t) => (
            <button key={t} type="button" data-type={t} aria-pressed={type === t} title={m.typeInfo[t]} onClick={() => { setType(t); setLimit(PAGE); }}>
              <Icon name={TYPE_ICON[t]} size={13} /> {d.m.t.battleType[t]} <span className="ptabs-n">{nf.format(typeCounts[t])}</span>
            </button>
          ))}
        </div>
      </div>
      {shown.length === 0 ? <p className="empty-mini">{m.noMatch}</p> : <div className="bgrid">{shown.slice(0, limit).map((x) => <BattleCard key={x.id} x={x} d={d} m={m} nowMs={nowMs} />)}</div>}
      {shown.length > limit && <button type="button" className="btn-more" onClick={() => setLimit(limit + PAGE)}>{m.more}</button>}
    </>
  );
}
