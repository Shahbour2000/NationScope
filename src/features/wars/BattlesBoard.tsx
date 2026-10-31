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

export interface HistoryInfo { requested: number; returned: number; covered: boolean; oldestMs: number | null }
const TYPES = ["territorial", "resistance", "revolution", "tournament"] as const;
const PAGE = 18;
const digits = (v: string | null | undefined): bigint | null => (v != null && /^\d+$/.test(v) ? BigInt(v) : null);

function Side({ countryId, muId, side, won, lost, d, m }: { countryId: string | null | undefined; muId: string | null | undefined; side: "a" | "d"; won: boolean; lost: boolean; d: Display; m: Messages["battlesPage"] }) {
  const label = countryId ? countryName(countryId, d.dir) : muId ? m.unit : "—";
  return (
    <div className={s.side} data-side={side} data-lost={lost}>
      {countryId && <Flag id={countryId} d={d} />}
      <span className={s.name} dir="auto">{label}</span>
      <span className={s.sub} data-win={won}>{won ? m.winner : countryId && muId ? m.unit : ""}</span>
    </div>
  );
}

export function BattleCard({ x, d, m, nowMs }: { x: Battle; d: Display; m: Messages["battlesPage"]; nowMs: number }) {
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
      <Link className={s.cover} href={`/battles/${encodeURIComponent(x.id)}`} aria-label={`${m.openBattle}: ${x.attackerCountryId ? countryName(x.attackerCountryId, d.dir) : ""} / ${x.defenderCountryId ? countryName(x.defenderCountryId, d.dir) : ""}`} />
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

export function BattleList({ rows, d, m, nowMs }: { rows: Battle[]; d: Display; m: Messages["battlesPage"]; nowMs: number }) {
  return <div className={s.grid}>{rows.map((x) => <BattleCard key={x.id} x={x} d={d} m={m} nowMs={nowMs} />)}</div>;
}

export function BattlesBoard({ rows, view, range, history, d, m, nowMs }: { rows: Battle[]; view: "live" | "history"; range: string; history: HistoryInfo | null; d: Display; m: Messages["battlesPage"]; nowMs: number }) {
  const [type, setType] = useState<string>("all");
  const [limit, setLimit] = useState(PAGE);
  const nf = new Intl.NumberFormat(d.nl);
  const typeCounts = useMemo(() => Object.fromEntries(TYPES.map((t) => [t, rows.filter((x) => x.type === t).length])) as Record<(typeof TYPES)[number], number>, [rows]);
  const shown = useMemo(() => {
    const key = (x: Battle) => (isBattleOngoing(x) ? x.startedAt : x.endedAt ?? x.startedAt) ?? "";
    return rows.filter((x) => type === "all" || x.type === type).sort((x, y) => key(y).localeCompare(key(x)));
  }, [rows, type]);
  const visibleTypes = TYPES.filter((t) => typeCounts[t] > 0 || type === t);
  const ranges: [string, string][] = [["7", m.range7], ["30", m.range30], ["90", m.range90]];
  const fill = (t: string, v: Record<string, string>) => t.replace(/\{(\w+)\}/g, (_, k: string) => v[k] ?? "");
  return (
    <>
      <div className={s.bar}>
        <nav className={s.tabs} aria-label={m.status}>
          <Link href="/battles" aria-current={view === "live" ? "page" : undefined}>{m.tabLive}</Link>
          <Link href={`/battles?view=history&range=${range}`} aria-current={view === "history" ? "page" : undefined}>{m.tabHistory}</Link>
        </nav>
        {view === "history" && (
          <nav className={s.ranges} aria-label={m.tabHistory}>
            {ranges.map(([k, label]) => <Link key={k} href={`/battles?view=history&range=${k}`} aria-current={range === k ? "true" : undefined}>{label}</Link>)}
          </nav>
        )}
      </div>
      {history && !history.covered && history.oldestMs !== null && (
        <p className={s.notice} role="status">{fill(m.partial, { n: nf.format(history.returned), d: formatDate(new Date(history.oldestMs).toISOString(), d.nl) ?? "—" })}</p>
      )}
      {visibleTypes.length > 1 || type !== "all" ? (
        <div className={s.types} role="group" aria-label={m.type}>
          <button type="button" aria-pressed={type === "all"} onClick={() => { setType("all"); setLimit(PAGE); }}>{m.allTypes} <small>{nf.format(rows.length)}</small></button>
          {visibleTypes.map((t) => (
            <button key={t} type="button" data-type={t} aria-pressed={type === t} title={m.typeInfo[t]} onClick={() => { setType(t); setLimit(PAGE); }}>
              <i /> {d.m.t.battleType[t]} <small>{nf.format(typeCounts[t])}</small>
            </button>
          ))}
        </div>
      ) : <div style={{ blockSize: "1.2rem" }} />}
      {shown.length === 0 ? <p className={s.empty}>{view === "history" ? m.emptyHistory : m.emptyLive}</p> : <div className={s.grid}>{shown.slice(0, limit).map((x) => <BattleCard key={x.id} x={x} d={d} m={m} nowMs={nowMs} />)}</div>}
      {shown.length > limit && <button type="button" className={s.more} onClick={() => setLimit(limit + PAGE)}>{m.more}</button>}
    </>
  );
}
