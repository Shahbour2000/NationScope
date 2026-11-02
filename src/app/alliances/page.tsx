import Link from "next/link";
import { ApiErrorState } from "@/components/ApiErrorState";
import { Icon } from "@/components/Icon";
import { Provenance } from "@/components/Provenance";
import { countryName, schemeColor } from "@/features/entities/display";
import { getDisplay } from "@/features/entities/display.server";
import { Flag } from "@/features/entities/entities";
import { getLocale, getMessages } from "@/i18n";
import { getAlliances } from "@/lib/data/world";
import s from "./alliances.module.css";

export const dynamic = "force-dynamic";
const FLAGS = 10;

export default async function AlliancesPage() {
  const m = getMessages(await getLocale());
  const a = m.alliancesPage;
  let res;
  try { res = await getAlliances(); } catch (e) { return <ApiErrorState error={e} retryLabel={m.common.retry} />; }
  const d = await getDisplay();
  const nf = new Intl.NumberFormat(d.nl);
  const rows = [...res.rows].sort((x, y) => (y.sharePercent ?? 0) - (x.sharePercent ?? 0));
  return (
    <>
      <div className="page-head"><h1><Icon name="shield" size={26} />{a.title}</h1></div>
      <p style={{ color: "#8b97b3", margin: "-0.3rem 0 1rem", maxInlineSize: "62rem" }}>{a.intro}</p>
      {rows.length === 0 ? <p className={s.empty}>{a.noAlliances}</p> : (
        <div className={s.grid}>
          {rows.map((x) => {
            const members = x.members ?? [];
            return (
              <article key={x.id} className={s.card} style={{ ["--c" as string]: schemeColor(x.scheme) }}>
                <Link className={s.cover} href={`/alliances/${encodeURIComponent(x.id)}`} aria-label={x.name} />
                <div>
                  <h2 className={s.name} dir="auto">{x.name}</h2>
                  {x.leaderCountryId && <div className={s.lead}>{a.leader}<Flag id={x.leaderCountryId} d={d} />{countryName(x.leaderCountryId, d.dir)}</div>}
                </div>
                <div className={s.flags} title={members.map((id) => countryName(id, d.dir)).join(", ")}>
                  {members.slice(0, FLAGS).map((id) => <Flag key={id} id={id} d={d} />)}
                  {members.length > FLAGS && <span className={s.more}>+{members.length - FLAGS}</span>}
                </div>
                <div className={s.strength}>
                  <header><span>{a.development}</span><b>{x.development == null ? "—" : nf.format(x.development)}</b></header>
                  <div className={s.track} title={`${x.sharePercent ?? 0}% ${a.share}`}><i style={{ inlineSize: `${Math.min(100, x.sharePercent ?? 0)}%` }} /></div>
                </div>
                <div className={s.foot}>
                  <span>{x.sharePercent == null ? "" : `${nf.format(x.sharePercent)}% ${a.share}`}</span>
                  {x.damageBonusPercent != null && x.damageBonusPercent > 0 && <b>+{nf.format(x.damageBonusPercent)}% {a.damageBonus}</b>}
                </div>
              </article>
            );
          })}
        </div>
      )}
      <Provenance meta={res.meta} m={m} />
    </>
  );
}
