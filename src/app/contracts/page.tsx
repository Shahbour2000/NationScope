import Link from "next/link";
import { ApiErrorState } from "@/components/ApiErrorState";
import { Icon } from "@/components/Icon";
import { Provenance } from "@/components/Provenance";
import { countryName, type Display } from "@/features/entities/display";
import { getDisplay } from "@/features/entities/display.server";
import { DataView } from "@/features/explorer/DataView";
import { Flag, Money, RegionLink } from "@/features/entities/entities";
import { getLocale, getMessages } from "@/i18n";
import { getContracts } from "@/lib/data/world";
import s from "./contracts.module.css";

export const dynamic = "force-dynamic";
const big = (v: string | null | undefined) => (v != null && /^\d+$/.test(v) ? BigInt(v) : null);
const safe = (v: string) => /^[A-Za-z0-9_-]{1,80}$/.test(v);

function Side({ id, paid, label, d }: { id: string | null | undefined; paid: boolean; label: string; d: Display }) {
  return (
    <div className={s.side} data-paid={paid}>
      {id && <Flag id={id} d={d} />}
      <span className={s.name} dir="auto">{id ? countryName(id, d.dir) : "—"}</span>
      <span className={s.paid}>{paid ? label : ""}</span>
    </div>
  );
}

export default async function ContractsPage() {
  const m = getMessages(await getLocale());
  const t = m.contractsPage;
  let res;
  try { res = await getContracts(); } catch (e) { return <><h1>{t.title}</h1><ApiErrorState error={e} retryLabel={m.common.retry} /></>; }
  const d = await getDisplay();
  const nf = new Intl.NumberFormat(d.nl);
  const rows = res.bounties.filter((b) => b.status !== "cancelled").sort((a, b) => Number((big(b.perK) ?? 0n) - (big(a.perK) ?? 0n)));
  const pool = rows.reduce((sum, b) => sum + (big(b.remaining) ?? 0n), 0n);
  const best = rows.reduce<bigint | null>((mx, b) => { const v = big(b.perK); return v !== null && (mx === null || v > mx) ? v : mx; }, null);
  const extra = [["auctions", res.auctions], ["myContracts", res.myContracts], ["issuedContracts", res.issued]] as const;
  return (
    <>
      <div className="page-head"><h1><Icon name="contract" size={26} />{t.title}</h1></div>
      <p style={{ color: "#8b97b3", margin: "-0.3rem 0 1.2rem", maxInlineSize: "62rem" }}>{t.intro}</p>
      <div className={s.kpis}>
        <div><b>{nf.format(rows.length)}</b><span>{t.offers}</span></div>
        <div><b><Money value={pool.toString()} d={d} /></b><span>{t.pool}</span></div>
        {best !== null && <div><b><Money value={best.toString()} d={d} /></b><span>{t.best}</span></div>}
      </div>
      {rows.length === 0 ? <p className={s.empty}>{t.empty}</p> : (
        <div className={s.grid}>
          {rows.map((b) => {
            const budget = big(b.budget), left = big(b.remaining);
            const pct = budget && budget > 0n && left !== null ? Number((left * 1000n) / budget) / 10 : null;
            const f = b.funder;
            const fname = f?.name ?? (f?.type === "country" && f.id ? countryName(f.id, d.dir) : null);
            return (
              <article key={b.id} className={s.card}>
                {b.battle?.id && safe(b.battle.id) && <Link className={s.cover} href={`/battles/${encodeURIComponent(b.battle.id)}`} aria-label={fname ?? t.title} />}
                <div className={s.top}><b>{b.battle?.regionId ? <RegionLink id={b.battle.regionId} d={d} link={false} /> : ""}</b><span>{b.battle?.type ? (d.m.t.battleType as Record<string, string>)[b.battle.type] ?? b.battle.type : ""}</span></div>
                <div className={s.clash}>
                  <Side id={b.battle?.attackerCountryId} paid={b.side === "attacker"} label={t.forSide} d={d} />
                  <span className={s.vs}>VS</span>
                  <Side id={b.battle?.defenderCountryId} paid={b.side === "defender"} label={t.forSideD} d={d} />
                </div>
                <div className={s.pay}><b><Money value={b.perK} d={d} /></b><span>{t.per1k}</span></div>
                {pct !== null && <div className={s.track} title={`${pct}%`}><i style={{ inlineSize: `${pct}%` }} /></div>}
                <div className={s.foot}>
                  <span>{fname ? <>{t.fundedBy} <b dir="auto">{fname}</b></> : ""}</span>
                  <span><b><Money value={b.remaining} d={d} /></b> {t.left}</span>
                </div>
              </article>
            );
          })}
        </div>
      )}
      {(res.fee !== null || res.expiryHours !== null) && (
        <p className={s.rules}>
          {res.fee !== null && <span>{t.fee} <b>{res.fee}%</b></span>}
          {res.penalty !== null && <span>{t.penalty} <b>{res.penalty}%</b></span>}
          {res.expiryHours !== null && <span>{t.expiry} <b>{res.expiryHours}{t.hours}</b></span>}
        </p>
      )}
      {extra.filter(([, v]) => v.length > 0).map(([k, v]) => (
        <details key={k} className={s.more}><summary>{t.more}: {k}</summary><DataView data={v} section="contracts" detailLinks={false} labels={m.explorer} d={d} /></details>
      ))}
      <Provenance meta={res.meta} m={m} />
    </>
  );
}
