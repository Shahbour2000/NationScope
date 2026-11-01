import Link from "next/link";
import { ApiErrorState } from "@/components/ApiErrorState";
import { Provenance } from "@/components/Provenance";
import { Tabs } from "@/components/Tabs";
import { countryTabs } from "@/features/countries/tabs";
import { countryName } from "@/features/entities/display";
import { getDisplay } from "@/features/entities/display.server";
import { Flag } from "@/features/entities/entities";
import { initials, phaseOf, upcoming } from "@/features/politics/elections";
import { getLocale, getMessages } from "@/i18n";
import { getCountryElections } from "@/lib/data/world";
import { formatDate, formatDuration } from "@/lib/format";
import type { Election } from "@/lib/domain/world";
import s from "./elections.module.css";

export const dynamic = "force-dynamic";
const safe = (v: string) => /^[A-Za-z0-9_-]{1,80}$/.test(v);
const fill = (t: string, v: Record<string, string>) => t.replace(/\{(\w+)\}/g, (_, k: string) => v[k] ?? "");

export default async function ElectionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = getMessages(await getLocale());
  const t = m.electionsPage;
  const tabs = countryTabs(id, m, "elections");
  let res;
  try { res = await getCountryElections(id); } catch (e) { return <><h1>{t.title}</h1><Tabs items={tabs} label={t.title} /><ApiErrorState error={e} retryLabel={m.common.retry} /></>; }
  const d = await getDisplay();
  const nowMs = Date.now();
  const nf = new Intl.NumberFormat(d.nl);
  // Bidi isolates keep each date intact inside right-to-left sentences.
  const day = (iso: string | null | undefined) => `\u2068${formatDate(iso, d.nl) ?? "—"}\u2069`;
  const label = (e: { label?: string | null; kind: string }) => e.label ?? e.kind;
  const finished = [...res.finished].sort((a, b) => (b.finishedAt ?? b.closesAt ?? "").localeCompare(a.finishedAt ?? a.closesAt ?? ""));
  const next = upcoming(res.calendar, nowMs);
  const counts = (e: Election) => (
    <span className={s.stats}>
      {e.candidates != null && <><b>{nf.format(e.candidates)}</b> {t.candidates}</>}
      {e.candidates != null && e.seats != null && " · "}
      {e.seats != null && <><b>{nf.format(e.seats)}</b> {e.seats === 1 ? t.seat : t.seats}</>}
    </span>
  );
  const person = (w: { userId?: string; username?: string | null }, cls: string | undefined, big = false) => {
    const uid = w.userId ?? "";
    const body = <><span className={s.av}>{initials(w.username)}</span><span className={big ? s.nm : undefined} dir="auto">{w.username ?? uid}</span></>;
    return safe(uid) ? <Link key={uid} className={cls} href={`/players/${encodeURIComponent(uid)}`}>{body}</Link> : <span key={uid || w.username} className={cls}>{body}</span>;
  };
  const empty = res.open.length === 0 && next.length === 0 && finished.length === 0;
  return (
    <>
      <div className={s.head}><Flag id={id} d={d} /><h1>{countryName(id, d.dir)} · {t.title}</h1></div>
      <Tabs items={tabs} label={t.title} />
      {empty && <p className={s.empty}>{t.empty}</p>}
      {res.open.length > 0 && (
        <section className={s.section}>
          <h2>{t.open}</h2>
          {res.open.map((e) => {
            const ph = phaseOf(e, nowMs);
            const order = ["candidacy", "voting", "closed"] as const;
            const at = ph ? order.indexOf(ph.phase) : -1;
            const steps: [string, string | null | undefined][] = [[t.candidacy, e.candidacyOpensAt], [t.voting, e.votingOpensAt], [t.closes, e.closesAt]];
            return (
              <article key={e.id} className={s.live}>
                <div className={s.row}><span className={s.title}>{label(e)}</span>{counts(e)}</div>
                <div className={s.steps}>
                  {steps.map(([name, iso], i) => <div key={name} className={s.step} data-state={i < at ? "done" : i === at ? "now" : "todo"}><b>{name}</b>{day(iso)}</div>)}
                </div>
                {ph?.endsAtMs != null && <span className={s.when}>{fill(t.endsIn, { t: formatDuration(Math.max(0, ph.endsAtMs - nowMs), d.m.time) })}</span>}
              </article>
            );
          })}
        </section>
      )}
      {next.length > 0 && (
        <section className={s.section}>
          <h2>{t.upcoming}</h2>
          <div className={s.cal}>
            {next.map((c) => {
              const opens = c.candidacyOpensAt ? Date.parse(c.candidacyOpensAt) : NaN;
              return (
                <div key={`${c.kind}-${c.periodKey ?? ""}`}>
                  <b>{c.label ?? c.kind}</b>
                  <span>{fill(t.from, { a: day(c.candidacyOpensAt), b: day(c.closesAt) })}{Number.isFinite(opens) && opens > nowMs ? ` · ${fill(t.opensIn, { t: formatDuration(opens - nowMs, d.m.time) })}` : ""}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}
      {finished.length > 0 && (
        <section className={s.section}>
          <h2>{t.results}</h2>
          <div className={s.results}>
            {finished.map((e) => {
              const winners = e.winners ?? [];
              return (
                <article key={e.id} className={s.card}>
                  <div className={s.row}><span><span className={s.title}>{label(e)}</span> <span className={s.meta}>· {day(e.finishedAt ?? e.closesAt)}</span></span>{counts(e)}</div>
                  {winners.length === 0 ? <span className={s.meta}>{t.noWinners}</span> : winners.length === 1 ? (
                    <div><span className={s.lbl}>{t.winner}</span>{person(winners[0]!, s.solo, true)}</div>
                  ) : <div className={s.winners}>{winners.map((w) => person(w, s.who))}</div>}
                </article>
              );
            })}
          </div>
        </section>
      )}
      <Provenance meta={res.meta} m={m} />
    </>
  );
}
