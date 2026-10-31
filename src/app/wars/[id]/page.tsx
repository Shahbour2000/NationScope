import Link from "next/link";
import { ApiErrorState } from "@/components/ApiErrorState";
import { Provenance } from "@/components/Provenance";
import { StateMessage } from "@/components/StateMessage";
import { countryName } from "@/features/entities/display";
import { getDisplay } from "@/features/entities/display.server";
import { Flag } from "@/features/entities/entities";
import { warDurationMs } from "@/features/economy/analytics";
import { BattleList } from "@/features/wars/BattlesBoard";
import { isWarOngoing } from "@/features/wars/state";
import { getLocale, getMessages } from "@/i18n";
import { getBattlesBetween, getWar } from "@/lib/data/world";
import { formatDateTime, formatDuration } from "@/lib/format";
import s from "./WarDetail.module.css";

export const dynamic = "force-dynamic";
const fill = (t: string, v: Record<string, string>) => t.replace(/\{(\w+)\}/g, (_, k: string) => v[k] ?? "");
const idOk = (id: string) => /^[A-Za-z0-9_-]{1,80}$/.test(id);

export default async function WarPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = getMessages(await getLocale());
  const t = m.warsPage;
  let res;
  try { res = await getWar(id); } catch (e) { return <><h1>{m.nav.wars}</h1><ApiErrorState error={e} retryLabel={m.common.retry} /></>; }
  if (!res.war) return <StateMessage tone="empty" title={t.warNotFound} detail={id} />;
  const w = res.war;
  const d = await getDisplay();
  const nowMs = Date.now();
  const live = isWarOngoing(w);
  const time = (iso: string | null | undefined) => formatDateTime(iso, d.nl, d.m.time.utc) ?? d.m.ui.missing;
  const dur = warDurationMs(w, nowMs);
  const until = live && w.priority?.until ? Date.parse(w.priority.until) : NaN;
  const holder = Number.isFinite(until) && until > nowMs ? w.priority?.countryId ?? null : null;
  const declared = w.declaredAt ? Date.parse(w.declaredAt) : 0;
  let battles: Awaited<ReturnType<typeof getBattlesBetween>> = [];
  let battlesError: unknown = null;
  try { battles = (await getBattlesBetween(w.countryA, w.countryB)).filter((b) => b.type === "territorial" && Date.parse(b.startedAt ?? "") >= declared - 60_000 && (!w.endedAt || Date.parse(b.startedAt ?? "") <= Date.parse(w.endedAt) + 60_000)); } catch (e) { battlesError = e; }
  const Side = ({ cid }: { cid: string }) => {
    const inner = <><Flag id={cid} d={d} /><span className={s.name} dir="auto">{countryName(cid, d.dir)}</span><span className={s.tag}>{w.declaredBy === cid ? t.declaredTag : ""}</span></>;
    return idOk(cid) ? <Link className={s.side} href={`/countries/${encodeURIComponent(cid)}`}>{inner}</Link> : <span className={s.side}>{inner}</span>;
  };
  return (
    <>
      <section className={`${s.hero} ${live ? "" : s.ended}`}>
        <span className={s.status} data-state={live ? "live" : "ended"}>{live ? t.tabActive : t.tabEnded}</span>
        <div className={s.versus}><Side cid={w.countryA} /><span className={s.vs} aria-label={t.versus}>VS</span><Side cid={w.countryB} /></div>
        {holder && <div className={s.initiative}><span>{t.initiativeTitle}</span><Flag id={holder} d={d} /><b>{countryName(holder, d.dir)}</b><span>· {formatDuration(until - nowMs, d.m.time)} {t.left}</span></div>}
        <dl className={s.facts}>
          <div><dt>{t.factDeclared}</dt><dd>{time(w.declaredAt)}{w.declaredBy && <small>{fill(t.factBy, { c: countryName(w.declaredBy, d.dir) })}</small>}</dd></div>
          {w.endedAt && <div><dt>{t.factEnded}</dt><dd>{time(w.endedAt)}</dd></div>}
          {dur !== null && <div><dt>{t.factDuration}</dt><dd>{formatDuration(dur, d.m.time)}</dd></div>}
          <div><dt>{t.factBattles}</dt><dd>{w.activeBattles ?? 0} {t.active} · {w.finishedBattles ?? 0} {t.finished}</dd></div>
        </dl>
        {w.proposalId && idOk(w.proposalId) && <Link className={s.law} href={`/laws/${encodeURIComponent(w.proposalId)}`}>{t.viewLaw}</Link>}
      </section>
      <section className={s.section}>
        <h2>{t.warBattles}</h2>
        <p>{t.battlesNote}</p>
        {battlesError ? <ApiErrorState error={battlesError} retryLabel={m.common.retry} /> : battles.length === 0 ? <p>{t.noBattles}</p> : <BattleList rows={battles.sort((a, b) => (b.startedAt ?? "").localeCompare(a.startedAt ?? ""))} d={d} m={m.battlesPage} nowMs={nowMs} />}
      </section>
      <Provenance meta={res.meta} m={m} />
    </>
  );
}
