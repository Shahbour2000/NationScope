import Link from "next/link";
import type { Display } from "@/features/entities/display";
import { CountryBadge, Dt, PlayerChip } from "@/features/entities/entities";
import type { Messages } from "@/i18n/messages";
import { readCandidates, voteSharePct, type ElectionDetail } from "@/lib/domain/election-detail";
import { humanizeCode } from "@/lib/format";
import s from "../regions/region.module.css";

const idOk = (v: string) => /^[A-Za-z0-9_-]{1,80}$/.test(v);

export function ElectionDetailView({ election: e, d, m }: { election: ElectionDetail; d: Display; m: Messages }) {
  const t = m.electionPage, nf = new Intl.NumberFormat(d.nl), pf = new Intl.NumberFormat(d.nl, { maximumFractionDigits: 1 });
  const cands = readCandidates(e);
  const maxVotes = Math.max(1, ...cands.rows.map((c) => c.votes ?? 0));
  const rules = e.rules ?? {};
  const num = (k: string) => (typeof rules[k] === "number" ? nf.format(rules[k] as number) : null);
  return (
    <>
      <div className={s.cardMeta} style={{ marginBlockEnd: "1rem" }}>
        {e.status ? <span className={s.badge} data-tone={e.status === "finished" ? "ok" : "gold"}>{(t.status as Record<string, string>)[e.status] ?? humanizeCode(e.status)}</span> : null}
        {e.outcome ? <span className={s.badge}>{(t.outcome as Record<string, string>)[e.outcome] ?? humanizeCode(e.outcome)}</span> : null}
        {e.countryId ? <><span>{t.country}</span><CountryBadge id={e.countryId} d={d} /></> : null}
        {e.partyName ? <span>{t.party2}: <b dir="auto">{e.partyName}</b></span> : null}
      </div>
      <div className={s.kpis}>
        {e.seats != null ? <div><b>{nf.format(e.seats)}</b><span>{t.seats}</span></div> : null}
        {e.ballotsCast != null && !e.tallyHidden ? <div><b>{nf.format(e.ballotsCast)}</b><span>{t.ballots}</span></div> : null}
        <div><b>{nf.format(cands.rows.length)}</b><span>{t.candidates}</span></div>
      </div>
      {e.tallyHidden ? <p className={s.note}>{t.tallyHidden}</p> : null}
      <div className={s.grid}>
        <section className={`panel ${s.panel}`}>
          <h2>{m.lawPage.timeline}</h2>
          <dl className={s.facts}>
            {e.candidacyOpensAt ? <><dt>{t.candidacyOpens}</dt><dd><Dt iso={e.candidacyOpensAt} d={d} /></dd></> : null}
            {e.votingOpensAt ? <><dt>{t.votingOpens}</dt><dd><Dt iso={e.votingOpensAt} d={d} /></dd></> : null}
            {e.closesAt ? <><dt>{t.closes}</dt><dd><Dt iso={e.closesAt} d={d} /></dd></> : null}
            {e.finishedAt ? <><dt>{t.finished}</dt><dd><Dt iso={e.finishedAt} d={d} /></dd></> : null}
            {e.tieBreak ? <><dt>{t.tieBreak}</dt><dd>{(t.tieBreakValue as Record<string, string>)[e.tieBreak] ?? humanizeCode(e.tieBreak)}</dd></> : null}
          </dl>
        </section>
        <section className={`panel ${s.panel}`}>
          <h2>{t.rules}</h2>
          <dl className={s.facts}>
            {num("voteMinLevel") ? <><dt>{t.ruleVoteLevel}</dt><dd>{num("voteMinLevel")}</dd></> : null}
            {num("candidateMinLevel") ? <><dt>{t.ruleCandidateLevel}</dt><dd>{num("candidateMinLevel")}</dd></> : null}
            {num("voteMinDaysSinceCitizenshipChange") ? <><dt>{t.ruleDays}</dt><dd>{num("voteMinDaysSinceCitizenshipChange")}</dd></> : null}
            {typeof rules.levelGate === "boolean" ? <><dt>{t.ruleGate}</dt><dd>{rules.levelGate ? t.yes : t.no}</dd></> : null}
          </dl>
        </section>
      </div>
      <h2 className={s.sec}>{t.candidates}</h2>
      {cands.rows.length === 0 ? <p className={s.empty}>{t.noCandidates}</p> : (
        <ul className={s.list}>
          {cands.rows.map((c) => {
            const pct = voteSharePct(c, e), out = c.withdrawn || c.disqualified;
            return (
              <li key={c.id} style={out ? { opacity: 0.6 } : undefined}>
                <PlayerChip id={c.userId} name={c.username} avatar={c.avatarUrl ?? null} d={d} />
                {c.level != null ? <span className={s.dim}>{t.level} {nf.format(c.level)}</span> : null}
                {c.partyName ? <span className={s.dim} dir="auto">{c.partyId && idOk(c.partyId) ? <Link href={`/parties/${encodeURIComponent(c.partyId)}`}>{c.partyName}</Link> : c.partyName}</span> : null}
                {c.elected ? <span className={s.badge} data-tone="ok">{t.elected}</span> : null}
                {c.withdrawn ? <span className={s.badge}>{t.withdrawn}</span> : null}
                {c.disqualified ? <span className={s.badge} data-tone="warn">{t.disqualified}</span> : null}
                {!e.tallyHidden && c.votes != null ? <span className={s.score}>{nf.format(c.votes)} {t.votes}{pct !== null ? <span className={s.dim}> · {pf.format(pct)}% {t.share}</span> : null}</span> : null}
                {!e.tallyHidden && c.votes != null ? <span className={`${s.track} ${s.sub}`} style={{ flexBasis: "100%" }} role="img" aria-label={`${c.votes}`}><i style={{ inlineSize: `${(c.votes / maxVotes) * 100}%` }} /></span> : null}
                {c.statement ? <p className={s.note} style={{ flexBasis: "100%" }} dir="auto">{c.statement}</p> : null}
                {c.articleId && idOk(c.articleId) ? <Link href={`/articles/${encodeURIComponent(c.articleId)}`}>{t.readStatement}</Link> : null}
              </li>
            );
          })}
        </ul>
      )}
      {cands.skipped > 0 ? <p className={s.dim}>{t.unreadRows.replace("{n}", nf.format(cands.skipped))}</p> : null}
      <p className={s.dim}>{t.derived}</p>
    </>
  );
}
