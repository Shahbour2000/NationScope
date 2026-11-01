import Link from "next/link";
import { ApiErrorState } from "@/components/ApiErrorState";
import { Icon } from "@/components/Icon";
import { Provenance } from "@/components/Provenance";
import { countryName, itemName, type Display } from "@/features/entities/display";
import { getDisplay } from "@/features/entities/display.server";
import { Flag, RegionLink } from "@/features/entities/entities";
import { summarize } from "@/features/regions/analyze";
import { getLocale, getMessages } from "@/i18n";
import { getRegionsMap } from "@/lib/data/world";
import { formatDuration } from "@/lib/format";
import s from "./regions.module.css";

export const dynamic = "force-dynamic";
const LIMIT = 8;
const safe = (v: string) => /^[A-Za-z0-9_-]{1,80}$/.test(v);

function Country({ id, d }: { id: string; d: Display }) {
  return <span className={s.mini}><Flag id={id} d={d} /><span dir="auto">{countryName(id, d.dir)}</span></span>;
}

/** First rows always visible, the rest behind a native <details> so there is no client JS and nothing is hidden for good. */
function Rows({ rows, showAll }: { rows: React.ReactNode[]; showAll: string }) {
  const head = rows.slice(0, LIMIT), tail = rows.slice(LIMIT);
  return (
    <ul className={s.list}>
      {head}
      {tail.length > 0 && <li style={{ padding: 0, display: "block" }}><details className={s.more}><summary>{showAll}</summary><ul className={s.list} style={{ border: 0, borderRadius: 0 }}>{tail}</ul></details></li>}
    </ul>
  );
}

export default async function RegionsPage() {
  const m = getMessages(await getLocale());
  const t = m.regionsPage;
  let res;
  try { res = await getRegionsMap(); } catch (e) { return <><h1>{t.title}</h1><ApiErrorState error={e} retryLabel={m.common.retry} /></>; }
  const d = await getDisplay();
  const nowMs = Date.now();
  const nf = new Intl.NumberFormat(d.nl);
  const sum = summarize(res.regions, res.battles, nowMs);
  const maxControl = sum.byCountry[0]?.[1] ?? 1;
  const all = (n: number) => t.showAll.replace("{n}", nf.format(n));
  const deposits = sum.deposits.map((r) => (
    <li key={r.id}>
      <span className={s.bonus}>+{nf.format(r.deposit?.bonusPercent ?? 0)}%</span>
      <span className={s.grow}><b>{itemName(r.deposit?.type ?? "", d)}</b> <span className={s.dim}>· <RegionLink id={r.id} d={d} /></span></span>
      {r.countryId && <Country id={r.countryId} d={d} />}
      {r.deposit?.endsAt && <span className={s.dim}>{formatDuration(Date.parse(r.deposit.endsAt) - nowMs, d.m.time)} {t.left}</span>}
    </li>
  ));
  const fronts = res.battles.map((b) => (
    <li key={b.id}>
      <span className={s.grow}>{b.regionId ? <Link href={`/battles/${encodeURIComponent(b.id)}`}>{<RegionLink id={b.regionId} d={d} link={false} />}</Link> : "—"} <span className={s.dim}>· {b.type ? (d.m.t.battleType as Record<string, string>)[b.type] ?? b.type : ""}</span></span>
      {b.attackerCountryId && <Country id={b.attackerCountryId} d={d} />}
      <Icon name="chevronr" size={12} />
      {b.defenderCountryId && <Country id={b.defenderCountryId} d={d} />}
    </li>
  ));
  const occupied = sum.occupied.map((r) => (
    <li key={r.id}>
      <span className={s.grow}><RegionLink id={r.id} d={d} /></span>
      {r.countryId && <span className={s.dim}>{t.heldBy}</span>}
      {r.countryId && <Country id={r.countryId} d={d} />}
      {r.coreCountryId && <><span className={s.dim}>· {t.coreOf}</span><Country id={r.coreCountryId} d={d} /></>}
    </li>
  ));
  const control = sum.byCountry.slice(0, 12).map(([cid, n]) => (
    <div key={cid} className={s.bar}>
      {safe(cid) ? <Link href={`/countries/${encodeURIComponent(cid)}`} style={{ textDecoration: "none", color: "#e6ebf7" }}><Country id={cid} d={d} /></Link> : <Country id={cid} d={d} />}
      <span className={s.track}><i style={{ inlineSize: `${(n / maxControl) * 100}%` }} /></span>
      <b>{nf.format(n)}</b>
    </div>
  ));
  return (
    <>
      <div className="page-head"><h1><Icon name="map" size={26} />{t.title}</h1></div>
      <p style={{ color: "#8b97b3", margin: "-0.3rem 0 1.2rem", maxInlineSize: "62rem" }}>{t.intro}</p>
      <div className={s.kpis}>
        <div><b>{nf.format(res.regions.length)}</b><span>{t.regions}</span></div>
        <div><b>{nf.format(sum.occupied.length)}</b><span>{t.occupied}</span></div>
        <div><b>{nf.format(sum.deposits.length)}</b><span>{t.deposits}</span></div>
        <div><b>{nf.format(sum.underAttack)}</b><span>{t.underAttack}</span></div>
      </div>
      <div className={s.cols}>
        <section className={s.sec}><h2>{t.depositsTitle} <small>{nf.format(deposits.length)}</small></h2>{deposits.length ? <Rows rows={deposits} showAll={all(deposits.length)} /> : <p className={s.empty}>{t.none}</p>}</section>
        <section className={s.sec}><h2>{t.frontTitle} <small>{nf.format(fronts.length)}</small></h2>{fronts.length ? <Rows rows={fronts} showAll={all(fronts.length)} /> : <p className={s.empty}>{t.none}</p>}</section>
        <section className={s.sec}><h2>{t.occupiedTitle} <small>{nf.format(occupied.length)}</small></h2>{occupied.length ? <Rows rows={occupied} showAll={all(occupied.length)} /> : <p className={s.empty}>{t.none}</p>}</section>
        <section className={s.sec}><h2>{t.controlTitle}</h2><div className={`${s.list} ${s.bars}`}>{control}</div></section>
      </div>
      <Provenance meta={res.meta} m={m} />
    </>
  );
}
