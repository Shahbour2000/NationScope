import Link from "next/link";
import { Fragment } from "react";
import type { Display } from "@/features/entities/display";
import { CountryBadge, Dt, ItemChip, PlayerChip } from "@/features/entities/entities";
import type { Messages } from "@/i18n/messages";
import { readBallots, readElectorate, scalarParams, voteSummary, type LawDetail } from "@/lib/domain/law-detail";
import { humanizeCode } from "@/lib/format";
import s from "../regions/region.module.css"; // shared panel / track / list styles

const TONE: Record<string, string> = { executed: "ok", voting: "gold", failed: "warn", rejected: "warn" };

export function LawDetailView({ law, d, m }: { law: LawDetail; d: Display; m: Messages }) {
  const t = m.lawPage, nf = new Intl.NumberFormat(d.nl), pf = new Intl.NumberFormat(d.nl, { maximumFractionDigits: 1 });
  const v = voteSummary(law), params = scalarParams(law.params);
  const el = readElectorate(law), bl = readBallots(law);
  const status = law.status ?? null;
  const early = law.passRule?.kind === "ballotsCast" && typeof law.passRule.earlyAt === "number" ? law.passRule.earlyAt : null;
  const costItem = law.costItem ?? null;
  return (
    <>
      <div className={s.cardMeta} style={{ marginBlockEnd: "1rem" }}>
        {status ? <span className={s.badge} data-tone={TONE[status]}>{(t.status as Record<string, string>)[status] ?? humanizeCode(status)}</span> : null}
        {law.scope === "country" && law.scopeId ? <><span>{t.countryScope}</span><CountryBadge id={law.scopeId} d={d} /></> : law.scope === "alliance" ? <span>{t.allianceScope}</span> : null}
        {law.counterpartCountryId ? <><span>{t.counterpart}</span><CountryBadge id={law.counterpartCountryId} d={d} /></> : null}
        {law.proposerId && law.proposerName ? <><span>{t.proposedBy}</span><PlayerChip id={law.proposerId} name={law.proposerName} avatar={null} d={d} /></> : null}
      </div>
      {law.law?.description ? <p className={s.dim}>{law.law.description}</p> : null}
      <div className={s.grid}>
        <section className={`panel ${s.panel} ${s.wide}`}>
          <h2>{t.votes}</h2>
          <div className={s.kpis}>
            <div><b>{nf.format(v.yes)}</b><span>{t.yes}</span></div><div><b>{nf.format(v.no)}</b><span>{t.no}</span></div>
            {v.absent !== null ? <div><b>{nf.format(v.absent)}</b><span>{t.absent}</span></div> : null}
            {v.electorate !== null ? <div><b>{nf.format(v.electorate)}</b><span>{t.electorate}</span></div> : null}
          </div>
          {v.cast > 0 ? <div className={s.track} data-kind="store" role="img" aria-label={`${pf.format(v.yesPct ?? 0)}%`}><i style={{ inlineSize: `${v.yesPct ?? 0}%` }} /></div> : null}
          {v.yesPct !== null ? <p className={s.note}>{pf.format(v.yesPct)}% {t.yesShare}{v.turnoutPct !== null ? ` · ${pf.format(v.turnoutPct)}% ${t.turnout}` : ""}. {t.derived}</p> : null}
          <h3 className={s.sec}>{t.rule}</h3>
          <p className={s.note}>{early !== null ? `${t.ruleEarly.replace("{n}", nf.format(early))} ` : ""}{t.ruleEnd}</p>
        </section>

        <section className={`panel ${s.panel}`}>
          <h2>{t.params}</h2>
          {params.length === 0 ? <p className={s.note}>{t.noParams}</p> : <dl className={s.facts}>{params.map(([k, val]) => <Fragment key={k}><dt>{humanizeCode(k)}</dt><dd>{val}</dd></Fragment>)}</dl>}
          {law.paperCost != null ? <p className={s.note}>{t.cost}: {nf.format(law.paperCost)} {costItem ? <ItemChip code={costItem} d={d} /> : null} · {law.refunded ? t.refunded : t.notRefunded}</p> : null}
        </section>

        <section className={`panel ${s.panel}`}>
          <h2>{t.timeline}</h2>
          <dl className={s.facts}>
            <dt>{t.opens}</dt><dd>{law.opensAt ? <Dt iso={law.opensAt} d={d} /> : t.notYet}</dd>
            <dt>{status === "voting" ? t.closes : t.closed}</dt><dd>{(status === "voting" ? law.closesAt : law.closedAt ?? law.closesAt) ? <Dt iso={(status === "voting" ? law.closesAt : law.closedAt ?? law.closesAt)!} d={d} /> : t.notYet}</dd>
            <dt>{t.executed}</dt><dd>{law.executedAt ? <Dt iso={law.executedAt} d={d} /> : t.notYet}</dd>
          </dl>
          {law.failureReason ? <p className={s.note}>{t.failure}: {humanizeCode(law.failureReason)}</p> : null}
        </section>

        <section className={`panel ${s.panel} ${s.wide}`}>
          <h2>{t.ballots}</h2>
          {bl.rows.length === 0 ? <p className={s.note}>{t.noBallots}</p> : (
            <ul className={s.list}>
              {[...bl.rows].sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? "")).map((b, i) => (
                <li key={`${b.voterId}-${i}`}>
                  <PlayerChip id={b.voterId} name={b.username ?? b.voterId} avatar={b.avatarUrl ?? null} d={d} />
                  <span className={s.badge} data-tone={b.choice === "yes" ? "ok" : "warn"}>{b.choice === "yes" ? t.yes : b.choice === "no" ? t.no : humanizeCode(b.choice)}</span>
                  {b.createdAt ? <span className={s.dim}><Dt iso={b.createdAt} d={d} /></span> : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={`panel ${s.panel} ${s.wide}`}>
          <h2>{t.voters}</h2>
          {el.rows.length === 0 ? <p className={s.note}>{t.noElectorate}</p> : (
            <ul className={s.chips}>{el.rows.map((e) => <li key={e.id}><PlayerChip id={e.id} name={e.name ?? e.id} avatar={null} d={d} /><span className={s.dim}> {e.voted ? t.voted : t.notVoted}</span></li>)}</ul>
          )}
        </section>
      </div>
      {el.skipped + bl.skipped > 0 ? <p className={s.dim}>{t.unreadRows.replace("{n}", nf.format(el.skipped + bl.skipped))}</p> : null}
      {law.scope === "country" && law.scopeId ? <p className={s.note}><Link href={`/countries/${encodeURIComponent(law.scopeId)}/laws`}>{t.openCountry}</Link></p> : null}
    </>
  );
}
