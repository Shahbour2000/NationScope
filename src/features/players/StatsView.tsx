import { Fragment } from "react";
import { humanizeCode } from "@/lib/format";
import type { Display } from "@/features/entities/display";
import { CountryBadge, Dt } from "@/features/entities/entities";
import type { Messages } from "@/i18n/messages";
import { PERIOD_ORDER, type MetricGroup, type PlayerStats, type Scalar } from "@/lib/domain/player-stats";
import s from "../regions/region.module.css"; // shared panel / kpi / list styles

/** Big numbers arrive as digit strings; format them exactly (BigInt) in the page locale. */
const fmt = (d: Display, v: Scalar) => (typeof v === "number" ? new Intl.NumberFormat(d.nl, { maximumFractionDigits: 4 }).format(v) : new Intl.NumberFormat(d.nl).format(BigInt(v)));

function Group({ g, d, m }: { g: MetricGroup; d: Display; m: Messages }) {
  const t = m.playerStats;
  const label = (t.group as Record<string, string>)[g.key] ?? humanizeCode(g.key);
  const periodLabel = { all: t.periodAll, month: t.periodMonth, week: t.periodWeek, day: t.periodDay } as const;
  const ps = PERIOD_ORDER.filter((p) => g.periods[p] !== undefined);
  return (
    <section className={`panel ${s.panel}`}>
      <h2>{label}</h2>
      {ps.length > 0 ? <dl className={s.facts}>{ps.map((p) => <Fragment key={p}><dt>{periodLabel[p]}</dt><dd>{fmt(d, g.periods[p]!)}</dd></Fragment>)}</dl> : null}
      {g.values.length > 0 ? (
        <>
          {ps.length > 0 ? <p className={s.note}>{t.other}</p> : null}
          <dl className={s.facts}>{g.values.map((v) => <Fragment key={v.key}><dt>{v.key === g.key ? label : humanizeCode(v.key.replace(/\./g, " "))}</dt><dd>{fmt(d, v.value)}</dd></Fragment>)}</dl>
        </>
      ) : null}
    </section>
  );
}

export function StatsView({ stats, d, m }: { stats: PlayerStats; d: Display; m: Messages }) {
  const t = m.playerStats, nf = new Intl.NumberFormat(d.nl);
  const kp: { l: string; v: React.ReactNode }[] = [];
  if (stats.level != null) kp.push({ l: t.level, v: nf.format(stats.level) });
  if (stats.xp != null) kp.push({ l: t.xp, v: nf.format(stats.xp) });
  if (stats.prestige != null) kp.push({ l: t.prestige, v: nf.format(stats.prestige) });
  if (stats.rank != null) kp.push({ l: t.rank, v: typeof stats.rank === "number" ? nf.format(stats.rank) : /^\d+$/.test(stats.rank) ? fmt(d, stats.rank) : humanizeCode(stats.rank) });
  if (stats.countryId) kp.push({ l: t.country, v: <CountryBadge id={stats.countryId} d={d} /> });
  if (stats.joinedAt) kp.push({ l: t.joined, v: <Dt iso={stats.joinedAt} d={d} /> });
  return (
    <>
      <div className={s.kpis}>{kp.map((k) => <div key={k.l}><b>{k.v}</b><span>{k.l}</span></div>)}</div>
      <div className={s.grid}>{stats.groups.map((g) => <Group key={g.key} g={g} d={d} m={m} />)}</div>
      {stats.unreadGroups.length > 0 ? <p className={s.dim}>{t.unread.replace("{list}", stats.unreadGroups.map((k) => (t.group as Record<string, string>)[k] ?? k).join(", "))}</p> : null}
      <p className={s.dim}>{t.unitsNote}</p>
    </>
  );
}
