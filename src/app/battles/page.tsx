import Link from "next/link";
import { ApiErrorState } from "@/components/ApiErrorState";
import { Icon } from "@/components/Icon";
import { Provenance } from "@/components/Provenance";
import { Progress } from "@/features/charts/charts";
import { CountryBadge, Dt, Money, RegionLink, Source, StatusBadge } from "@/features/entities/entities";
import { getDisplay } from "@/features/entities/display.server";
import { getLocale, getMessages } from "@/i18n";
import { getBattleRules, getBattles } from "@/lib/data/world";
import { isBattleOngoing } from "@/features/wars/state";

export const dynamic = "force-dynamic";

/** Share of the combined round damage dealt by side A, as a whole percent (exact integer arithmetic). */
const splitPct = (a: string | null | undefined, b: string | null | undefined): number | null => {
  if (a == null || b == null || !/^\d+$/.test(a) || !/^\d+$/.test(b)) return null;
  const total = BigInt(a) + BigInt(b);
  return total === 0n ? null : Number((BigInt(a) * 100n) / total);
};

export default async function BattlesPage() {
  const m = getMessages(await getLocale());
  const b = m.battlesPage;
  let res;
  try { res = await getBattles(); } catch (e) { return <ApiErrorState error={e} retryLabel={m.common.retry} />; }
  const rules = await getBattleRules().catch(() => ({ roundsToWin: null, pointsToWinRound: null }));
  const d = await getDisplay();
  const nf = new Intl.NumberFormat(d.nl);
  const active = res.rows.filter(isBattleOngoing).length;
  const sorted = [...res.rows].sort((x, y) => (y.startedAt ?? "").localeCompare(x.startedAt ?? ""));
  const win = rules.pointsToWinRound ?? 0;

  return (
    <>
      <div className="page-head"><h1><Icon name="battle" size={26} />{b.title}</h1></div>
      <p className="note">{b.intro}</p>
      <dl className="stats"><div className="stat"><dt>{b.activeBattles}</dt><dd>{nf.format(active)}</dd></div><div className="stat"><dt>{m.ui.total}</dt><dd>{nf.format(res.rows.length)}</dd></div></dl>
      <p className="note">{b.sumNote}</p>
      {sorted.length === 0 ? <p className="empty-mini">{b.noBattles}</p> : (
        <div className="card-grid">
          {sorted.map((x) => {
            const pct = splitPct(x.round?.attackerDamage, x.round?.defenderDamage);
            return (
              <article key={x.id} className="card">
                <div className="compare" style={{ marginBlockEnd: "0.5rem" }}>
                  <span className="kv"><StatusBadge value={x.status} d={d} /><StatusBadge value={x.type} group="battleType" d={d} /></span>
                  <Link href={`/battles/${encodeURIComponent(x.id)}`}>{m.ui.details}</Link>
                </div>
                <p style={{ margin: "0 0 0.5rem" }}><Icon name="map" size={14} /> <RegionLink id={x.regionId} d={d} /></p>
                <div className="compare"><CountryBadge id={x.attackerCountryId} d={d} /><b>{x.attackerRounds ?? 0} : {x.defenderRounds ?? 0}</b><CountryBadge id={x.defenderCountryId} d={d} /></div>
                {x.round && (
                  <>
                    <p className="hint">{b.round} {x.round.number ?? x.currentRound ?? "—"} · {b.points}: {x.round.attackerPoints ?? 0} / {x.round.defenderPoints ?? 0}{win > 0 ? ` (${win})` : ""}</p>
                    {win > 0 && <><Progress value={x.round.attackerPoints ?? 0} max={win} label={b.attacker} /><div style={{ height: 4 }} /><Progress value={x.round.defenderPoints ?? 0} max={win} label={b.defender} /></>}
                    <p className="hint">{b.damage}: {x.round.attackerDamage != null ? nf.format(BigInt(x.round.attackerDamage)) : "—"} – {x.round.defenderDamage != null ? nf.format(BigInt(x.round.defenderDamage)) : "—"}{pct !== null ? <> · {pct}% <Source kind="calc" d={d} /></> : null}</p>
                  </>
                )}
                {x.bounty && (x.bounty.attacker !== "0" || x.bounty.defender !== "0") && <p className="hint">{b.bounty}: <Money value={x.bounty.attacker} d={d} /> / <Money value={x.bounty.defender} d={d} /></p>}
                <p className="hint">{b.started}: <Dt iso={x.startedAt} d={d} />{x.round?.nextTickAt ? <> · {b.nextTick}: <Dt iso={x.round.nextTickAt} d={d} /></> : null}</p>
              </article>
            );
          })}
        </div>
      )}
      <Provenance meta={res.meta} m={m} />
    </>
  );
}
