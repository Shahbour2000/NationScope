import Link from "next/link";
import { Dt, Flag, RegionLink, StatusBadge, CountryBadge } from "@/features/entities/entities";
import { countryName, type Display } from "@/features/entities/display";
import type { Messages } from "@/i18n/messages";
import { campaignBattleSchema, campaignSummary, looseEvent, type Campaign, type CampaignBattle } from "@/lib/domain/region-detail";
import s from "./region.module.css";

const idOk = (v: string) => /^[A-Za-z0-9_-]{1,80}$/.test(v);

function BattleRow({ b, regionId, d, m }: { b: CampaignBattle; regionId: string; d: Display; m: Messages }) {
  const t = m.regionPage.b, running = b.status === "active" && !b.endedAt;
  const side = (cid: string | null | undefined, win: boolean) => cid ? <span className={s.versus}><Flag id={cid} d={d} /><span data-win={win}>{countryName(cid, d.dir)}</span></span> : <span>—</span>;
  const hasScore = b.attackerRounds != null && b.defenderRounds != null;
  return (
    <li>
      {side(b.attackerCountryId, b.winner === "attacker")}
      <span className={s.score} title={t.rounds}>{hasScore ? `${b.attackerRounds} – ${b.defenderRounds}` : "vs"}</span>
      {side(b.defenderCountryId, b.winner === "defender")}
      {b.type ? <StatusBadge value={b.type} d={d} group="battleType" /> : null}
      {running ? <span className={s.badge} data-tone="warn">{t.running}</span> : null}
      <span className={s.dim}>{b.startedAt ? <>{t.started} <Dt iso={b.startedAt} d={d} /></> : null}{b.endedAt ? <> · {t.ended} <Dt iso={b.endedAt} d={d} /></> : null}</span>
      {b.sourceRegionId && b.sourceRegionId !== regionId ? <span className={s.dim}>{t.from} <RegionLink id={b.sourceRegionId} d={d} /></span> : null}
      {b.sourceLost ? <span className={s.badge} data-tone="gold">{t.sourceLost}</span> : null}
      {idOk(b.id) ? <Link href={`/battles/${encodeURIComponent(b.id)}`}>{t.openBattle}</Link> : null}
    </li>
  );
}

function LooseRow({ x, d, m }: { x: unknown; d: Display; m: Messages }) {
  const e = looseEvent(x);
  return (
    <li>
      {e.at ? <Dt iso={e.at} d={d} /> : null}
      {e.countryIds.map((c) => <CountryBadge key={c} id={c} d={d} />)}
      {e.regionIds.map((r) => <RegionLink key={r} id={r} d={d} />)}
      {e.battleId && idOk(e.battleId) ? <Link href={`/battles/${encodeURIComponent(e.battleId)}`}>{m.regionPage.b.openBattle}</Link> : null}
    </li>
  );
}

/** Region campaign page body. Battles are fully typed (sample verified); `ownership` and `launchedFromHere` have never been captured populated, so they are read loosely and unreadable rows are only counted. */
export function CampaignView({ campaign, regionId, d, m }: { campaign: Campaign; regionId: string; d: Display; m: Messages }) {
  const t = m.regionPage.b, nf = new Intl.NumberFormat(d.nl);
  const sum = campaignSummary(campaign.battles);
  if (!campaign.shapeOk) return <p className={s.empty}>{t.shapeBad}</p>;
  const launched = campaign.launched.map((x) => ({ x, p: campaignBattleSchema.safeParse(x) }));
  const ownRows = campaign.ownership.map(looseEvent);
  const unreadable = ownRows.filter((e) => !e.recognised).length + launched.filter((l) => !l.p.success && !looseEvent(l.x).recognised).length;
  return (
    <>
      <p className={s.dim}>{t.intro}</p>
      <div className={s.kpis}>
        <div><b>{nf.format(sum.total)}</b><span>{t.total}</span></div>
        <div><b>{nf.format(sum.active)}</b><span>{t.ongoing}</span></div>
        <div><b>{nf.format(sum.heldByAttacker)}</b><span>{t.attackerWins}</span></div>
        <div><b>{nf.format(sum.heldByDefender)}</b><span>{t.defenderWins}</span></div>
        {sum.undecided > 0 ? <div><b>{nf.format(sum.undecided)}</b><span>{t.undecided}</span></div> : null}
      </div>
      {campaign.battles.length === 0 ? <p className={s.empty}>{t.none}</p> : <ul className={s.list}>{campaign.battles.map((b) => <BattleRow key={b.id} b={b} regionId={regionId} d={d} m={m} />)}</ul>}
      {campaign.skipped > 0 ? <p className={s.dim}>{t.skipped.replace("{n}", nf.format(campaign.skipped))}</p> : null}

      <h2 className={s.sec}>{t.ownership}</h2>
      {ownRows.length === 0 ? <p className={s.empty}>{t.noOwnership}</p> : <ul className={s.list}>{campaign.ownership.map((x, i) => <LooseRow key={i} x={x} d={d} m={m} />)}</ul>}

      <h2 className={s.sec}>{t.launched}</h2>
      {launched.length === 0 ? <p className={s.empty}>{t.noLaunched}</p> : (
        <ul className={s.list}>{launched.map((l, i) => l.p.success ? <BattleRow key={i} b={l.p.data} regionId={regionId} d={d} m={m} /> : <LooseRow key={i} x={l.x} d={d} m={m} />)}</ul>
      )}
      {unreadable > 0 ? <p className={s.dim}>{t.unreadable.replace("{n}", nf.format(unreadable))}</p> : null}
    </>
  );
}
