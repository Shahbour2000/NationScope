import Link from "next/link";
import { ApiErrorState } from "@/components/ApiErrorState";
import { Icon } from "@/components/Icon";
import { Info } from "@/components/Info";
import { Provenance } from "@/components/Provenance";
import { RankList } from "@/components/RankList";
import { StateMessage } from "@/components/StateMessage";
import { CountryBadge, Dt, Flag, RegionLink, Source } from "@/features/entities/entities";
import { getDisplay } from "@/features/entities/display.server";
import { RemoteImage } from "@/features/entities/RemoteImage";
import { getLocale, getMessages } from "@/i18n";
import { pointsPercent, splitPercent, type BattleFighter } from "@/lib/domain/battle-detail";
import { getBattleDetail } from "@/lib/data/world";
import { formatDuration } from "@/lib/format";

export const dynamic = "force-dynamic";
const nfFor = (nl: string) => new Intl.NumberFormat(nl);

export default async function BattlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = getMessages(await getLocale());
  const t = m.battlePage;
  let res;
  try { res = await getBattleDetail(id); } catch (e) { return <><h1>{m.nav.battles}</h1><ApiErrorState error={e} retryLabel={m.common.retry} /></>; }
  if (!res.battle) return <StateMessage tone="empty" title={t.notFound} detail={id} />;
  const b = res.battle;
  const d = await getDisplay();
  const nf = nfFor(d.nl);
  const big = (v: string | null) => (v === null ? "—" : nf.format(BigInt(v)));
  const active = b.status === "active";
  const round = b.rounds.find((r) => r.number === b.currentRound) ?? b.rounds.at(-1) ?? null;
  const needed = b.pointsToWinRound;
  const end = b.endedAt ? Date.parse(b.endedAt) : Date.now();
  const dur = b.startedAt && Number.isFinite(end - Date.parse(b.startedAt)) ? formatDuration(end - Date.parse(b.startedAt), d.m.time) : null;
  const winnerCountry = b.winner === "attacker" ? b.attackerCountryId : b.winner === "defender" ? b.defenderCountryId : null;
  const dmgSplit = round ? splitPercent(round.attackerDamage, round.defenderDamage) : null;
  const totSplit = splitPercent(b.totals.attacker.damage, b.totals.defender.damage);

  const Side = ({ side }: { side: "attacker" | "defender" }) => {
    const cid = side === "attacker" ? b.attackerCountryId : b.defenderCountryId;
    return (
      <div className="vside" data-side={side}>
        {cid ? <Flag id={cid} d={d} /> : null}
        <span className="vname" title={cid ?? ""}>{cid ? <CountryBadge id={cid} d={d} /> : "—"}</span>
        <small>{t[side]}</small>
      </div>
    );
  };
  const Bar = ({ pct, label }: { pct: number | null; label: string }) => (
    <div className="vbar" role="img" aria-label={label}>{pct === null ? <span className="vbar-empty" /> : <><span data-side="attacker" style={{ inlineSize: `${pct}%` }} /><span data-side="defender" style={{ inlineSize: `${100 - pct}%` }} /></>}</div>
  );
  const Points = ({ side }: { side: "attacker" | "defender" }) => {
    const pts = round ? (side === "attacker" ? round.attackerPoints : round.defenderPoints) : null;
    const pct = pointsPercent(pts, needed);
    return (
      <div className="pbar-row">
        <span className="pbar-lab">{t[side]}</span>
        <span className="pbar" role="img" aria-label={`${pts ?? "—"} / ${needed ?? "—"}`}><span data-side={side} style={{ inlineSize: `${pct ?? 0}%` }} /></span>
        <b className="pbar-val">{pts ?? "—"}{needed ? <small> / {needed}</small> : null}</b>
      </div>
    );
  };
  const fighters = (list: BattleFighter[]) => list.slice(0, 5).map((f, i) => ({
    key: f.id, rank: i + 1, href: `/players/${encodeURIComponent(f.id)}`, name: f.name,
    lead: <RemoteImage src={f.avatar} size={28} round fallback={<span className="seat-fallback" aria-hidden="true">{f.name.slice(0, 2).toUpperCase()}</span>} />,
    tail: f.countryId ? <span className="rk-flag"><Flag id={f.countryId} d={d} /></span> : null,
    value: f.damage === null ? "—" : nf.format(BigInt(f.damage)), valueTitle: f.hits !== null ? `${f.hits} ${t.hits}` : undefined,
  }));

  return (
    <>
      <p className="crumb"><Link href="/battles">{t.back}</Link></p>
      <section className="versus" aria-label={t.rounds}>
        <Side side="attacker" />
        <div className="vmid">
          <span className="badge" data-tone={active ? "warn" : "neutral"}>{(t.status as Record<string, string>)[b.status] ?? b.status}</span>
          <div className="vscore" dir="ltr" aria-label={`${b.attackerRounds} - ${b.defenderRounds}`}>{b.attackerRounds}<span>–</span>{b.defenderRounds}</div>
          {b.roundsToWin ? <small>{t.firstTo.replace("{n}", String(b.roundsToWin))}</small> : null}
          {!active && winnerCountry ? <span className="badge" data-tone="ok">{t.winner}: <CountryBadge id={winnerCountry} d={d} link={false} /></span> : null}
        </div>
        <Side side="defender" />
        <div className="vmeta">
          {b.regionId ? <span><Icon name="map" size={14} /> <RegionLink id={b.regionId} d={d} />{b.sourceRegionId ? <small> {t.from} <RegionLink id={b.sourceRegionId} d={d} /></small> : null}</span> : null}
          {b.startedAt ? <span>{t.started}: <Dt iso={b.startedAt} d={d} /></span> : null}
          {b.endedAt ? <span>{t.ended}: <Dt iso={b.endedAt} d={d} /></span> : null}
          {dur ? <span>{t.duration}: {dur}</span> : null}
          {active && round?.nextTickAt ? <span>{t.nextTick}: <Dt iso={round.nextTickAt} d={d} /></span> : null}
        </div>
      </section>

      <div className="cols">
        {round ? (
          <section className="panel">
            <header><h2>{active ? `${t.currentRound} ${round.number}` : `${t.finalRound} ${round.number}`} <Source kind="api" d={d} /></h2></header>
            <h3 className="sub-h">{t.roundPoints}</h3>
            <Points side="attacker" /><Points side="defender" />
            {needed ? <p className="hint">{t.ofToWin.replace("{n}", String(needed))}</p> : null}
            <h3 className="sub-h">{t.roundDamage}</h3>
            <Bar pct={dmgSplit} label={t.roundDamage} />
            <div className="vnums"><b>{big(round.attackerDamage)}</b><b>{big(round.defenderDamage)}</b></div>
            {dmgSplit === null ? <p className="hint">{t.noDamage}</p> : null}
          </section>
        ) : null}

        <section className="panel">
          <header><h2>{t.totals} <Source kind="api" d={d} /></h2></header>
          <Bar pct={totSplit} label={t.totals} />
          <div className="vnums"><b>{big(b.totals.attacker.damage)}</b><b>{big(b.totals.defender.damage)}</b></div>
          <dl className="kvlist">
            <div><dt>{t.fighters}</dt><dd>{b.totals.attacker.fighters ?? "—"} <small>/</small> {b.totals.defender.fighters ?? "—"}</dd></div>
          </dl>
          {b.rounds.length > 0 ? (
            <ul className="roundlist">
              {b.rounds.map((r) => (
                <li key={r.number}>
                  <b>{t.round} {r.number}</b>
                  <span>{r.winner ? <>{t.wonBy} {(() => { const c = r.winner === "attacker" ? b.attackerCountryId : b.defenderCountryId; return c ? <CountryBadge id={c} d={d} link={false} /> : t[r.winner]; })()}</> : <span className="badge" data-tone="warn">{t.inProgress}</span>}</span>
                  <small dir="ltr">{r.attackerPoints ?? "—"} – {r.defenderPoints ?? "—"} {t.points}</small>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      </div>

      <section className="panel" style={{ marginBlockStart: "1rem" }}>
        <header><h2><Icon name="flame" size={18} /> {t.topFighters} <Source kind="api" d={d} /></h2></header>
        <div className="cols">
          {(["attacker", "defender"] as const).map((side) => (
            <div key={side}>
              <h3 className="sub-h">{t[side]}</h3>
              {b.fighters[side].length === 0 ? <p className="empty-mini">{t.noFighters}</p> : <RankList label={`${t.topFighters}: ${t[side]}`} items={fighters(b.fighters[side])} icon={<Icon name="flame" size={14} />} />}
            </div>
          ))}
        </div>
      </section>
      <Info title={t.howTitle}><p>{t.how}</p></Info>
      <Provenance meta={res.meta} m={m} />
    </>
  );
}
