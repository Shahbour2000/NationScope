import Link from "next/link";
import { Fragment } from "react";
import type { Display } from "@/features/entities/display";
import { Dt } from "@/features/entities/entities";
import { boardLabel } from "@/features/rankings/boardLabels";
import type { Messages } from "@/i18n/messages";
import type { GameRules, RuleRow } from "@/lib/domain/game-rules";
import { humanizeCode } from "@/lib/format";
import s from "../regions/region.module.css";

function Rules({ title, rows, d, m }: { title: string; rows: RuleRow[]; d: Display; m: Messages }) {
  const t = m.gamePage, nf = new Intl.NumberFormat(d.nl, { maximumFractionDigits: 4 });
  if (rows.length === 0) return null;
  const label = (k: string) => (t.label as Record<string, string>)[k] ?? humanizeCode(k);
  const val = (v: RuleRow["value"]) => (typeof v === "number" ? nf.format(v) : typeof v === "boolean" ? (v ? t.yes : t.no) : ((t.value as Record<string, string>)[v] ?? humanizeCode(v)));
  return (
    <section className={`panel ${s.panel}`}>
      <h2>{title}</h2>
      <dl className={s.facts}>{rows.map((r) => <Fragment key={r.key}><dt>{label(r.key)}</dt><dd>{val(r.value)}</dd></Fragment>)}</dl>
    </section>
  );
}

export function GameRulesView({ rules, d, m }: { rules: GameRules; d: Display; m: Messages }) {
  const t = m.gamePage, nf = new Intl.NumberFormat(d.nl);
  return (
    <>
      <div className={s.kpis}>
        {rules.rulesetVersion ? <div><b dir="ltr">{rules.rulesetVersion}</b><span>{t.ruleset}</span></div> : null}
        {rules.serverTime ? <div><b><Dt iso={rules.serverTime} d={d} /></b><span>{t.serverTime}</span></div> : null}
      </div>
      <div className={s.grid}>
        <Rules title={t.battle} rows={rules.battle} d={d} m={m} />
        {rules.tickPoints.length > 0 ? (
          <section className={`panel ${s.panel}`}>
            <h2>{t.tick}</h2>
            <ul className={s.rows}>{rules.tickPoints.map((x, i) => (
              <li key={x.from}><span>{t.from} <b>{nf.format(x.from)}</b></span><b>{nf.format(x.points)} {t.points}</b>{i < rules.tickPoints.length - 1 ? null : null}</li>
            ))}</ul>
            <p className={s.note}>{t.tickNote}</p>
          </section>
        ) : null}
        <Rules title={t.contract} rows={rules.contract} d={d} m={m} />
        <Rules title={t.auction} rows={rules.auction} d={d} m={m} />
        <Rules title={t.reputation} rows={rules.reputation} d={d} m={m} />
      </div>
      <h2 className={s.sec}>{t.boards}</h2>
      <ul className={s.list}>
        {rules.boards.map((b) => (
          <li key={b.id}>
            <Link href={`/rankings/${encodeURIComponent(b.id)}`}><b>{boardLabel(b.id, b.label, d.locale)}</b></Link>
            {b.periods?.length ? <span className={s.dim}>{t.periods}: {b.periods.map((p) => humanizeCode(p)).join(", ")}</span> : null}
            {b.archived ? <Link href={`/rankings/${encodeURIComponent(b.id)}/archive`}>{t.archive}</Link> : null}
          </li>
        ))}
      </ul>
      {rules.boardsSkipped > 0 ? <p className={s.dim}>{t.skipped.replace("{n}", nf.format(rules.boardsSkipped))}</p> : null}
      {rules.historyTypes.length > 0 ? <><h2 className={s.sec}>{t.history}</h2><ul className={s.chips}>{rules.historyTypes.map((h) => <li key={h}><Link href={`/history?type=${encodeURIComponent(h)}`}>{humanizeCode(h)}</Link></li>)}</ul></> : null}
      <p className={s.dim}>{t.unitsNote}</p>
    </>
  );
}
