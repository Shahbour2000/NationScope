import Link from "next/link";
import type { Display } from "@/features/entities/display";
import { Dt } from "@/features/entities/entities";
import { DataView } from "@/features/explorer/DataView";
import type { Messages } from "@/i18n/messages";
import { groupArchive, type ArchiveEntry } from "@/lib/domain/ranking-archive";
import s from "../regions/region.module.css"; // shared list / chip / note styles

/** Finished periods of one leaderboard, grouped by period type, each linking to its frozen results. */
export function ArchiveView({ board, entries, skipped, d, m }: { board: string; entries: ArchiveEntry[]; skipped: number; d: Display; m: Messages }) {
  const t = m.rankingArchive, nf = new Intl.NumberFormat(d.nl);
  if (entries.length === 0) return <p className={s.empty}>{t.empty}</p>;
  const g = groupArchive(entries);
  const href = (e: ArchiveEntry) => e.period === "other" ? null : `/rankings/${encodeURIComponent(board)}?period=${e.period}&periodKey=${encodeURIComponent(e.periodKey)}`;
  return (
    <>
      <div className={s.kpis}><div><b>{nf.format(entries.length)}</b><span>{t.total}</span></div></div>
      {(["monthly", "weekly", "daily", "other"] as const).map((k) => g[k].length === 0 ? null : (
        <section key={k}>
          <h2 className={s.sec}>{t[k]} · {nf.format(g[k].length)}</h2>
          <ul className={s.list}>
            {g[k].map((e) => { const h = href(e); return (
              <li key={e.periodKey}>
                <b dir="ltr">{e.periodKey}</b>
                {e.at ? <span className={s.dim}>{t.archivedOn} <Dt iso={e.at} d={d} /></span> : null}
                {h ? <Link href={h}>{t.open}</Link> : null}
              </li>
            ); })}
          </ul>
        </section>
      ))}
      {skipped > 0 ? <p className={s.dim}>{t.skipped.replace("{n}", nf.format(skipped))}</p> : null}
    </>
  );
}
export function ArchiveAsReturned({ data, d, m }: { data: unknown; d: Display; m: Messages }) {
  return <><p className={s.note}>{m.rankingArchive.unrecognised}</p><DataView data={data} section={null} detailLinks={false} labels={m.explorer} d={d} /></>;
}
