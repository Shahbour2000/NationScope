import Link from "next/link";
import { notFound } from "next/navigation";
import { ApiErrorState } from "@/components/ApiErrorState";
import { Icon } from "@/components/Icon";
import { ApiError } from "@/lib/api/errors";
import { Provenance } from "@/components/Provenance";
import { countryName } from "@/features/entities/display";
import { getDisplay } from "@/features/entities/display.server";
import { Dt, Money } from "@/features/entities/entities";
import { getLocale, getMessages } from "@/i18n";
import { getEditionBattles, getTournamentDetail } from "@/lib/data/tournaments";
import { getUnitDetail } from "@/lib/data/units";
import { getTournaments } from "@/lib/data/world";
import s from "../tournaments.module.css";

export const dynamic = "force-dynamic";
const safe = (v: string) => /^[A-Za-z0-9_-]{1,80}$/.test(v);

export default async function TournamentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!safe(id)) notFound();
  const m = getMessages(await getLocale());
  const t = m.tournamentsPage;
  const detail = await getTournamentDetail(id);
  if (!detail.edition) {
    // Only a genuine 404 (or no error at all) means "not found"; a rate limit, timeout or network failure must be reported as such.
    const e = detail.error;
    const isMissing = !e || (e instanceof ApiError && e.kind === "http" && e.status === 404);
    if (!isMissing) return <><nav className={s.back}><Link href="/tournaments">← {t.back}</Link></nav><ApiErrorState error={e} retryLabel={m.common.retry} /></>;
    return <><nav className={s.back}><Link href="/tournaments">← {t.back}</Link></nav><p className={s.empty}>{t.notFound}</p></>;
  }
  const ed = detail.edition;
  const d = await getDisplay();
  const rules = await getTournaments().then((r) => ({ prizes: r.prizes, entryFee: r.entryFee })).catch(() => null);
  const { battles, checked, truncated } = await getEditionBattles(ed).catch(() => ({ battles: [], checked: 0, truncated: false }));
  // History rows carry ids only: resolve winner / runner-up unit names (confirmed data) instead of printing raw ids.
  const unitNames = new Map<string, string>();
  if (ed.kind === "mu") await Promise.all([ed.winnerId, ed.runnerUpId].filter((x): x is string => !!x && !ed.entrants.some((e) => e.entrantId === x && e.name)).map(async (uid) => { const r = await getUnitDetail(uid).catch(() => null); if (r?.unit?.name) unitNames.set(uid, r.unit.name); }));
  const finished = ed.status === "finished" || !!ed.finishedAt;
  const state = finished ? "finished" : ed.status === "running" ? "running" : ed.registrationOpen ? "registration" : "upcoming";
  const stateLabel = ed.status === "cancelled" ? t.cancelled : state === "running" ? t.running : state === "finished" ? t.finished : state === "registration" ? t.registration : t.upcoming;
  const isUnit = ed.kind === "mu";
  const kindLabel = isUnit ? t.kindMu : ed.kind === "country" ? t.kindCountry : ed.kind;
  const entrantName = (eid: string | null | undefined): string => {
    if (!eid) return "—";
    const e = ed.entrants.find((x) => x.entrantId === eid);
    return e?.name ?? unitNames.get(eid) ?? (isUnit ? t.unitUnknown.replace("{id}", eid) : countryName(eid, d.dir));
  };
  const href = (eid: string) => (isUnit ? `/units/${encodeURIComponent(eid)}` : `/countries/${encodeURIComponent(eid)}`);
  const entityLink = (eid: string | null | undefined) => (eid && safe(eid) ? <Link href={href(eid)} dir="auto">{entrantName(eid)}</Link> : <span>{entrantName(eid)}</span>);
  const seeded = [...ed.entrants].sort((a, b) => (a.seed ?? 999) - (b.seed ?? 999));
  const nf = new Intl.NumberFormat(d.nl);
  return (
    <>
      <nav className={s.back}><Link href="/tournaments">← {t.back}</Link></nav>
      <section className={s.hero}>
        <div className={s.row}>
          <div><span className={s.kind}>{kindLabel}</span><h2 dir="auto">{ed.name ?? ed.periodKey ?? ed.id}</h2></div>
          <span className={s.status} data-s={state}>{stateLabel}</span>
        </div>
        <dl className={s.facts}>
          {ed.startsAt && <div><dt>{t.starts}</dt><dd><Dt iso={ed.startsAt} d={d} /></dd></div>}
          {ed.finishedAt && <div><dt>{t.finished}</dt><dd><Dt iso={ed.finishedAt} d={d} /></dd></div>}
          {ed.totalRounds != null && <div><dt>{t.rounds}</dt><dd>{nf.format(ed.totalRounds)}</dd></div>}
          <div><dt>{t.entrants}</dt><dd>{nf.format(ed.entrants.length)}</dd></div>
          {ed.rarityCap && <div><dt>{t.rarityCap}</dt><dd>{d.m.t.rarity[ed.rarityCap as keyof typeof d.m.t.rarity] ?? ed.rarityCap}</dd></div>}
        </dl>
        {rules && (rules.prizes.winner || rules.prizes.runnerUp) && (
          <div className={s.prizes} aria-label={t.prizes}>
            {rules.prizes.winner && <div className={s.prize} data-first="true"><span>{t.winner}</span><b><Money value={rules.prizes.winner} d={d} /></b></div>}
            {rules.prizes.runnerUp && <div className={s.prize}><span>{t.runnerUp}</span><b><Money value={rules.prizes.runnerUp} d={d} /></b></div>}
            {rules.prizes.participant && <div className={s.prize}><span>{t.participant}</span><b><Money value={rules.prizes.participant} d={d} /></b></div>}
          </div>
        )}
      </section>
      {(ed.winnerId || ed.runnerUpId) && (
        <section className={s.section}>
          <h2><Icon name="trophy" size={14} /> {t.winner} / {t.runnerUp}</h2>
          <div className={s.podium}>
            {ed.winnerId && <div className={s.pod} data-p="1"><span>{t.winner}</span><b>{entityLink(ed.winnerId)}</b></div>}
            {ed.runnerUpId && <div className={s.pod} data-p="2"><span>{t.runnerUp}</span><b>{entityLink(ed.runnerUpId)}</b></div>}
          </div>
        </section>
      )}
      <section className={s.section}>
        <h2>{t.entrants} <small>{nf.format(seeded.length)}</small></h2>
        {seeded.length === 0 ? <p className={s.empty}>{t.noEntrants}</p> : (
          <ul className={s.entrants}>
            {seeded.map((e) => {
              const podium = e.entrantId === ed.winnerId ? "1" : e.entrantId === ed.runnerUpId ? "2" : undefined;
              return (
                <li key={e.id} data-podium={podium}>
                  <span className={s.seed} title={t.seed}>{e.seed ?? "·"}</span>
                  {entityLink(e.entrantId)}
                  {podium && <span className={s.tag}>{podium === "1" ? t.winner : t.runnerUp}</span>}
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <section className={s.section}>
        <h2>{t.matchups} <small>{nf.format(battles.length)}</small> <span className={s.inferred}>{t.inferred}</span></h2>
        {battles.length === 0 ? <p className={s.empty}>{t.noMatchups}</p> : (
          <ul className={s.matches}>
            {battles.map((b) => {
              const a = String(b.attackerMuId ?? b.attackerCountryId ?? ""), df = String(b.defenderMuId ?? b.defenderCountryId ?? "");
              const win = b.winner === "attacker" || b.winner === a ? "a" : b.winner === "defender" || b.winner === df ? "d" : null;
              const live = b.status === "active" && !b.winner && !b.endedAt;
              return (
                <li key={b.id}>
                  <Link className={s.match} href={`/battles/${encodeURIComponent(b.id)}`} title={t.openBattle}>
                    <span className={s.side} data-win={win === "a"} dir="auto">{entrantName(a)}</span>
                    <span className={s.score}>{nf.format(b.attackerRounds ?? 0)} – {nf.format(b.defenderRounds ?? 0)}</span>
                    <span className={s.side} data-win={win === "d"} dir="auto">{entrantName(df)}</span>
                    <span className={s.mstate} data-s={live ? "active" : "done"}>{live ? t.live : t.ended}{b.startedAt ? <> · <Dt iso={b.startedAt} d={d} /></> : null}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        <p className="note">{t.matchupsNote} {checked > 0 ? t.checkedNote.replace("{n}", nf.format(checked)) : ""} {truncated ? t.truncatedBattles : ""}</p>
      </section>
      <section className={s.gap}>
        <b>{t.sourceTitle}</b>
        <p>{detail.source === "detail" ? t.srcDetail : t.srcList}</p>
        <p>{t.srcEntrants} {t.srcResult}</p>
        <p>{t.srcBattles}</p>
        <b style={{ display: "block", marginBlockStart: "0.6rem" }}>{t.gapsTitle}</b>
        <p>{t.gapBracket}</p>
      </section>
      {detail.meta && <Provenance meta={detail.meta} m={m} />}
    </>
  );
}
