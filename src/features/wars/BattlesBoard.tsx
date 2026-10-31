"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { countryName, type Display } from "@/features/entities/display";
import { Flag, Money, RegionLink } from "@/features/entities/entities";
import { isBattleOngoing } from "@/features/wars/state";
import { formatDate, formatDuration } from "@/lib/format";
import type { Messages } from "@/i18n/messages";
import type { Battle } from "@/lib/domain/world";
import s from "./BattlesBoard.module.css";

type Status = "live" | "done" | "all";
const TYPES = ["territorial", "resistance", "revolution", "tournament"] as const;
const PAGE = 18;
const idOk = (id: string) => /^[A-Za-z0-9_-]{1,80}$/.test(id);
const digits = (v: string | null | undefined): bigint | null => (v != null && /^\d+$/.test(v) ? BigInt(v) : null);

function Side({ countryId, muId, side, won, lost, d, m }: { countryId: string | null | undefined; muId: string | null | undefined; side: "a" | "d"; won: boolean; lost: boolean; d: Display; m: Messages["battlesPage"] }) {
  const label = countryId ? countryName(countryId, d.dir) : muId ? m.unit : "—";
  const inner = (
    <>
      {countryId && <Flag id={countryId} d={d} />}
      <span className={s.name} dir="auto">{label}</span>
      <span className={s.sub} data-win={won}>{won ? m.winner : countryId && muId ? m.unit : ""}</span>
    </>
  );
  const href = countryId && idOk(countryId) ? `/countries/${encodeURIComponent(countryId)}` : muId && idOk(muId) ? `/units/${encodeURIComponent(muId)}` : null;
  return href ? <Link className={s.side} href={href} data-side={side} data-lost={lost}>{inner}</Link> : <span className={s.side} data-side={side} data-lost={lost}>{inner}</span>;
}

function BattleCard({ x, d, m, nowMs }: { x: Battle; d: Display; m: Messages["battlesPage"]; nowMs: number }) {
  const live = isBattleOngoing(x);
  const type = (TYPES as readonly string[]).includes(x.type) ? (x.type as (typeof TYPES)[number]) : null;
  const compact = new Intl.NumberFormat(d.nl, { notation: "compact", maximumFractionDigits: 1 });
  const a = digits(x.round?.attackerDamage), b = digits(x.round?.defenderDamage);
  const total = a !== null && b !== null ? a + b : null;
  const aPct = total && total > 0n && a !== null ? Number((a * 1000n) / total) / 10 : null;
  const winnerSide = !live && x.winner ? (x.winner === "attacker" || x.winner === x.attackerCountryId ? "a" : x.winner === "defender" || x.winner === x.defenderCountryId ? "d" : null) : null;
  const next = live && x.round?.nextTickAt ? Date.parse(x.round.nextTickAt) - nowMs : NaN;
  const bounty = x.bounty?.attacker && x.bounty.attacker !== "0" ? x.bounty.attacker : x.bounty?.defender && x.bounty.defender !== "0" ? x.bounty.defender : null;
  const roundNo = x.round?.number ?? x.currentRound;
  return (
    <article className={s.card} data-type={type ?? "other"} data-state={live ? "live" : "done"}>
      <div className={s.top}>
        <span className={s.type} title={type ? m.typeInfo[type] : undefined}>{type ? d.m.t.battleType[type] : x.type}</span>
        <span className={s.state} data-live={live}>{live ? `${m.tabLive}${roundNo ? ` · ${m.round} ${roundNo}` : ""}` : m.tabDone}</span>
      </div>
      <div className={s.clash}>
        <Side countryId={x.attackerCountryId} muId={x.attackerMuId} side="a" won={winnerSide === "a"} lost={winnerSide === "d"} d={d} m={m} />
        <div className={s.score} aria-label={`${x.attackerRounds ?? 0} : ${x.defenderRounds ?? 0}`}><b>{x.attackerRounds ?? 0}</b><span>:</span><b>{x.defenderRounds ?? 0}</b></div>
        <Side countryId={x.defenderCountryId} muId={x.defenderMuId} side="d" won={winnerSide === "d"} lost={winnerSide === "a"} d={d} m={m} />
      </div>
      {aPct !== null && a !== null && b !== null && (
        <div className={s.tug}>
          <div className={s.track}><span className={s.fillA} style={{ inlineSize: `${aPct}%` }} /></div>
          <div className={s.nums}><span>{compact.format(Number(a))}</span><span>{compact.format(Number(b))}</span></div>
        </div>
      )}
      <div className={s.foot}>
        <span>{x.regionId ? <RegionLink id={x.regionId} d={d} /> : null}</span>
        <span>
          {bounty ? <span className={s.gold}><Money value={bounty} d={d} /></span> : Number.isFinite(next) && next > 0 ? `${m.nextTick} · ${formatDuration(next, d.m.time)}` : !live && x.endedAt ? formatDate(x.endedAt, d.nl) : ""}
        </span>
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
  const visibleTypes = TYPES.filter((t) => typeCounts[t] > 0 || type === t);
  return (
    <>
      <div className={s.bar}>
        <div className={s.tabs} role="tablist" aria-label={m.status}>
          {tabs.map(([k, label]) => <button key={k} type="button" role="tab" aria-selected={status === k} onClick={() => { setStatus(k); setLimit(PAGE); }}>{label} <small>{nf.format(counts[k])}</small></button>)}
        </div>
      </div>
      {visibleTypes.length > 1 || type !== "all" ? (
        <div className={s.types} role="group" aria-label={m.type}>
          <button type="button" aria-pressed={type === "all"} onClick={() => { setType("all"); setLimit(PAGE); }}>{m.allTypes}</button>
          {visibleTypes.map((t) => (
            <button key={t} type="button" data-type={t} aria-pressed={type === t} title={m.typeInfo[t]} onClick={() => { setType(t); setLimit(PAGE); }}>
              <i /> {d.m.t.battleType[t]} <small>{nf.format(typeCounts[t])}</small>
            </button>
          ))}
        </div>
      ) : <div style={{ blockSize: "1.2rem" }} />}
      {shown.length === 0 ? <p className={s.empty}>{m.noMatch}</p> : <div className={s.grid}>{shown.slice(0, limit).map((x) => <BattleCard key={x.id} x={x} d={d} m={m} nowMs={nowMs} />)}</div>}
      {shown.length > limit && <button type="button" className={s.more} onClick={() => setLimit(limit + PAGE)}>{m.more}</button>}
    </>
  );
}
