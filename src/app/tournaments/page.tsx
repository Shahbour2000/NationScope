import Link from "next/link";
import { ApiErrorState } from "@/components/ApiErrorState";
import { Icon } from "@/components/Icon";
import { Provenance } from "@/components/Provenance";
import { getDisplay } from "@/features/entities/display.server";
import { Dt, Money } from "@/features/entities/entities";
import { getLocale, getMessages } from "@/i18n";
import { getTournaments } from "@/lib/data/world";
import { formatDate, formatDuration } from "@/lib/format";
import s from "./tournaments.module.css";

export const dynamic = "force-dynamic";
const safe = (v: string) => /^[A-Za-z0-9_-]{1,80}$/.test(v);
const fill = (t: string, v: Record<string, string>) => t.replace(/\{(\w+)\}/g, (_, k: string) => v[k] ?? "");

export default async function TournamentsPage() {
  const m = getMessages(await getLocale());
  const t = m.tournamentsPage;
  let res;
  try { res = await getTournaments(); } catch (e) { return <><h1>{t.title}</h1><ApiErrorState error={e} retryLabel={m.common.retry} /></>; }
  const d = await getDisplay();
  const nowMs = Date.now();
  const kindLabel = (k: string) => (k === "mu" ? t.kindMu : k === "country" ? t.kindCountry : k);
  const cur = res.current;
  const link = (kind: string, id: string) => (kind === "mu" ? `/units/${encodeURIComponent(id)}` : `/countries/${encodeURIComponent(id)}`);
  const nameOf = (id: string | null | undefined) => (id ? cur?.entrants.find((e) => e.entrantId === id)?.name ?? null : null);
  const state = cur ? (cur.status === "running" ? "running" : cur.finishedAt || cur.status === "finished" ? "finished" : cur.registrationOpen ? "registration" : "upcoming") : null;
  const stateLabel = state === "running" ? t.running : state === "finished" ? t.finished : state === "registration" ? t.registration : t.upcoming;
  const nextStart = res.next?.startsAt ? Date.parse(res.next.startsAt) : NaN;
  const nextOpen = res.next?.registrationOpensAt ? Date.parse(res.next.registrationOpensAt) : NaN;
  return (
    <>
      <div className="page-head"><h1><Icon name="trophy" size={26} />{t.title}</h1></div>
      <p style={{ color: "#8b97b3", margin: "-0.3rem 0 1.4rem", maxInlineSize: "62rem" }}>{t.intro}</p>
      {cur ? (
        <section className={s.hero}>
          <div className={s.row}>
            <div><span className={s.kind}>{kindLabel(cur.kind)}</span><h2 dir="auto">{cur.name ?? cur.periodKey ?? cur.id}</h2></div>
            <span className={s.status} data-s={state}>{stateLabel}</span>
          </div>
          <dl className={s.facts}>
            {cur.startsAt && <div><dt>{t.starts}</dt><dd><Dt iso={cur.startsAt} d={d} /></dd></div>}
            {cur.totalRounds != null && <div><dt>{t.rounds}</dt><dd>{cur.totalRounds}</dd></div>}
            <div><dt>{t.entrants}</dt><dd>{cur.entrants.length}</dd></div>
            {res.entryFee !== null && <div><dt>{t.entry}</dt><dd>{res.entryFee === "0" ? t.free : <Money value={res.entryFee} d={d} />}</dd></div>}
          </dl>
          {(res.prizes.winner || res.prizes.runnerUp || res.prizes.participant) && (
            <div className={s.prizes} aria-label={t.prizes}>
              {res.prizes.winner && <div className={s.prize} data-first="true"><span>{t.winner}</span><b><Money value={res.prizes.winner} d={d} /></b></div>}
              {res.prizes.runnerUp && <div className={s.prize}><span>{t.runnerUp}</span><b><Money value={res.prizes.runnerUp} d={d} /></b></div>}
              {res.prizes.participant && <div className={s.prize}><span>{t.participant}</span><b><Money value={res.prizes.participant} d={d} /></b></div>}
            </div>
          )}
        </section>
      ) : <p className={s.empty}>{t.noCurrent}</p>}
      {cur && cur.entrants.length > 0 && (
        <section className={s.section}>
          <h2>{t.entrants} <small>{cur.entrants.length}</small></h2>
          <ul className={s.entrants}>
            {[...cur.entrants].sort((a, b) => (a.seed ?? 999) - (b.seed ?? 999)).map((e) => {
              const podium = e.entrantId === cur.winnerId ? "1" : e.entrantId === cur.runnerUpId ? "2" : undefined;
              const label = e.name ?? e.entrantId;
              return (
                <li key={e.id} data-podium={podium}>
                  <span className={s.seed} title={t.seed}>{e.seed ?? "·"}</span>
                  {safe(e.entrantId) ? <Link href={link(cur.kind, e.entrantId)} dir="auto">{label}</Link> : <span dir="auto">{label}</span>}
                  {podium && <span className={s.tag}>{podium === "1" ? t.winner : t.runnerUp}</span>}
                </li>
              );
            })}
          </ul>
        </section>
      )}
      {res.next && (
        <section className={s.section}>
          <h2>{t.nextTitle}</h2>
          <div className={s.next}>
            <div><b dir="auto">{res.next.name ?? res.next.periodKey}</b><br /><span>{kindLabel(res.next.kind)}{res.cadenceWeeks ? ` · ${fill(t.every, { n: String(res.cadenceWeeks) })}` : ""}{res.minRegistrations ? ` · ${fill(t.minEntrants, { n: String(res.minRegistrations) })}` : ""}</span></div>
            <div style={{ textAlign: "end" }}>
              {Number.isFinite(nextOpen) && nextOpen > nowMs
                ? <span className={s.when}>{fill(t.opensIn, { t: formatDuration(nextOpen - nowMs, d.m.time) })}</span>
                : Number.isFinite(nextStart) && nextStart > nowMs ? <span className={s.when}>{fill(t.startsIn, { t: formatDuration(nextStart - nowMs, d.m.time) })}</span> : null}
              <br /><span>{t.starts} {formatDate(res.next.startsAt, d.nl) ?? "—"}</span>
            </div>
          </div>
        </section>
      )}
      {res.history.length > 0 && (
        <section className={s.section}>
          <h2>{t.history}</h2>
          <ul className={s.hist}>
            {res.history.map((h) => (
              <li key={h.id}><b dir="auto">{h.name ?? h.periodKey ?? h.id}</b><span>{formatDate(h.finishedAt ?? h.startsAt, d.nl) ?? ""}{nameOf(h.winnerId) ? ` · ${t.winner}: ${nameOf(h.winnerId)}` : ""}</span></li>
            ))}
          </ul>
        </section>
      )}
      <Provenance meta={res.meta} m={m} />
    </>
  );
}
