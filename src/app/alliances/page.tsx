import Link from "next/link";
import { ApiErrorState } from "@/components/ApiErrorState";
import { Icon } from "@/components/Icon";
import { Provenance } from "@/components/Provenance";
import { Progress } from "@/features/charts/charts";
import { CountryBadge, Dt, StatusBadge } from "@/features/entities/entities";
import { schemeColor } from "@/features/entities/display";
import { getDisplay } from "@/features/entities/display.server";
import { getLocale, getMessages } from "@/i18n";
import { getAlliances } from "@/lib/data/world";

export const dynamic = "force-dynamic";

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
      <p className="note">{a.intro}</p>
      {rows.length === 0 ? <p className="empty-mini">{a.noAlliances}</p> : (
        <div className="card-grid">
          {rows.map((x) => (
            <article key={x.id} className="card" style={{ borderInlineStart: `3px solid ${schemeColor(x.scheme)}` }}>
              <div className="compare">
                <h2 style={{ margin: 0 }}><Link href={`/alliances/${encodeURIComponent(x.id)}`} dir="auto">{x.name}</Link></h2>
                <StatusBadge value={x.status} d={d} />
              </div>
              <p className="hint">{a.leader}: <CountryBadge id={x.leaderCountryId} d={d} /></p>
              <div className="stat-chips" style={{ marginBlock: "0.5rem" }}>{(x.members ?? []).map((id) => <CountryBadge key={id} id={id} d={d} />)}</div>
              <ul className="list">
                <li><span>{a.development}</span><b>{x.development == null ? "—" : nf.format(x.development)}</b></li>
                <li><span>{a.share}</span><span style={{ flex: "1 1 6rem" }}><Progress value={x.sharePercent ?? 0} max={100} label={a.share} /></span><b>{x.sharePercent ?? "—"}%</b></li>
                <li><span>{a.damageBonus}</span><b>{x.damageBonusPercent == null ? "—" : `+${x.damageBonusPercent}%`}</b></li>
                <li><span>{a.created}</span><span><Dt iso={x.createdAt} d={d} /></span></li>
              </ul>
            </article>
          ))}
        </div>
      )}
      <Provenance meta={res.meta} m={m} />
    </>
  );
}
