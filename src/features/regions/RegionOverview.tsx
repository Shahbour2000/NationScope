import Link from "next/link";
import { Dt, ItemChip, Flag, RegionLink } from "@/features/entities/entities";
import { countryName, type Display } from "@/features/entities/display";
import type { Messages } from "@/i18n/messages";
import { formatDuration, humanizeCode } from "@/lib/format";
import { battleIdOf, facilitiesOf, type RegionDetail } from "@/lib/domain/region-detail";
import s from "./region.module.css";

const idOk = (v: string) => /^[A-Za-z0-9_-]{1,80}$/.test(v);

/** Purpose-built region profile body. Pure: everything it shows comes from `region` (GET /regions/{id}); nothing is computed beyond percentages and time left. */
export function RegionOverview({ region, d, m, nowMs }: { region: RegionDetail; d: Display; m: Messages; nowMs: number }) {
  const t = m.regionPage, nf = new Intl.NumberFormat(d.nl);
  const dep = region.deposit?.type ? region.deposit : null;
  const depLeft = dep?.endsAt ? Date.parse(dep.endsAt) - nowMs : null;
  const fac = facilitiesOf(region.upgrades), unread = (region.upgrades?.length ?? 0) - fac.length;
  const battleId = battleIdOf(region.battle);
  const occupied = region.occupied === true;
  const res = region.resistance ?? null, resMax = region.resistanceMax ?? null;
  const resPct = res !== null && resMax ? Math.max(0, Math.min(100, (res / resMax) * 100)) : null;
  const facName = (code: string) => (t.facility as Record<string, string>)[code] ?? humanizeCode(code);
  const neighbours = region.neighbors ?? [];
  return (
    <div className={s.grid}>
      <section className={`panel ${s.panel}`}>
        <h2>{t.stats}</h2>
        <dl className={s.facts}>
          {region.mainCity ? <><dt>{t.mainCity}</dt><dd dir="auto">{region.mainCity}</dd></> : null}
          {region.biome ? <><dt>{t.biome}</dt><dd>{humanizeCode(region.biome)}</dd></> : null}
          {region.climate ? <><dt>{t.climate}</dt><dd>{humanizeCode(region.climate)}</dd></> : null}
          <dt>{t.lastOwnership}</dt><dd>{region.lastOwnershipChangeAt ? <Dt iso={region.lastOwnershipChangeAt} d={d} /> : t.noneRecorded}</dd>
          <dt>{t.lastBattle}</dt><dd>{region.lastBattleEndedAt ? <Dt iso={region.lastBattleEndedAt} d={d} /> : t.noneRecorded}</dd>
        </dl>
      </section>

      <section className={`panel ${s.panel}`}>
        <h2>{t.resistance}</h2>
        {occupied && res !== null ? (
          <>
            <div className={s.bigNum}>{nf.format(res)}{resMax ? <small>{t.resistanceOf.replace("{max}", nf.format(resMax))}</small> : null}</div>
            {resPct !== null ? <div className={s.track} role="img" aria-label={`${Math.round(resPct)}%`}><i style={{ inlineSize: `${resPct}%` }} /></div> : null}
            <p className={s.note}>{t.resistanceNote}</p>
          </>
        ) : <p className={s.note}>{t.resistanceNone}</p>}
      </section>

      <section className={`panel ${s.panel}`}>
        <h2>{t.deposit}</h2>
        {dep ? (
          <>
            <div className={s.cardHead}><ItemChip code={dep.type as string} d={d} href={`/market/${encodeURIComponent(dep.type as string)}`} />{dep.bonusPercent != null ? <span className={s.bigNum}>+{nf.format(dep.bonusPercent)}%<small>{t.depositBonus}</small></span> : null}</div>
            {depLeft !== null ? <p className={s.note}>{depLeft > 0 ? t.depositEnds.replace("{t}", formatDuration(depLeft, d.m.time)) : t.depositEnded}</p> : null}
          </>
        ) : <p className={s.note}>{t.depositNone}</p>}
      </section>

      <section className={`panel ${s.panel}`}>
        <h2>{t.battle}</h2>
        {battleId && idOk(battleId) ? <Link href={`/battles/${encodeURIComponent(battleId)}`}>{t.openBattle}</Link> : region.battle != null ? <p className={s.note}>{t.battle}</p> : <p className={s.note}>{t.noBattle}</p>}
        <p className={s.note}><Link href={`/regions/${encodeURIComponent(region.id)}/campaign`}>{t.openBattles}</Link></p>
      </section>

      <section className={`panel ${s.panel} ${s.wide}`}>
        <h2>{t.facilities}</h2>
        {fac.length === 0 && unread <= 0 ? <p className={s.note}>{t.facilitiesNone}</p> : (
          <ul className={s.rows}>
            {fac.map((f, i) => (
              <li key={`${f.code}-${i}`}>
                <span><b>{facName(f.code)}</b> <span className={s.dim}>{t.level} {f.level ?? "—"}{f.maxLevel ? ` / ${f.maxLevel}` : ""}</span></span>
                {f.status ? <span className={s.badge} data-tone={f.status === "active" ? "ok" : "gold"}>{f.status === "active" ? t.inUse : f.status === "pending" ? t.underConstruction : humanizeCode(f.status)}</span> : <span />}
                {f.level !== null && f.maxLevel ? <span className={`${s.track} ${s.sub}`} data-kind="level" role="img" aria-label={`${f.level}/${f.maxLevel}`}><i style={{ inlineSize: `${Math.min(100, (f.level / f.maxLevel) * 100)}%` }} /></span> : null}
              </li>
            ))}
          </ul>
        )}
        {unread > 0 ? <p className={s.note}>{t.facilitiesUnread.replace("{n}", nf.format(unread))}</p> : null}
      </section>

      <section className={`panel ${s.panel} ${s.wide}`}>
        <h2>{t.neighbours}</h2>
        {neighbours.length === 0 ? <p className={s.note}>{t.neighboursNone}</p> : (
          <ul className={s.chips}>
            {neighbours.map((n) => (
              <li key={n.id}>{idOk(n.id) ? <Link href={`/regions/${encodeURIComponent(n.id)}`}>{n.countryId ? <Flag id={n.countryId} d={d} /> : null}<span dir="auto">{n.name?.trim() || <RegionLink id={n.id} d={d} link={false} />}</span>{n.countryId && n.countryId !== region.countryId ? <span className={s.dim}>{countryName(n.countryId, d.dir)}</span> : null}</Link> : null}</li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
