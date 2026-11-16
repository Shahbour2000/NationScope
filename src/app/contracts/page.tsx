import { ApiErrorState } from "@/components/ApiErrorState";
import { Icon } from "@/components/Icon";
import { Provenance } from "@/components/Provenance";
import { getDisplay } from "@/features/entities/display.server";
import { Money } from "@/features/entities/entities";
import { BountyCard } from "@/features/wars/BountyCard";
import { MercenaryList } from "@/features/wars/MercenaryList";
import { getLocale, getMessages } from "@/i18n";
import { getContracts } from "@/lib/data/world";
import s from "@/features/wars/contracts.module.css";

export const dynamic = "force-dynamic";
const big = (v: string | null | undefined) => (v != null && /^\d+$/.test(v) ? BigInt(v) : null);

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
          {rows.map((b) => <BountyCard key={b.id} b={b} d={d} t={t} />)}
        </div>
      )}
      {(res.fee !== null || res.expiryHours !== null) && (
        <p className={s.rules}>
          {res.fee !== null && <span>{t.fee} <b>{res.fee}%</b></span>}
          {res.penalty !== null && <span>{t.penalty} <b>{res.penalty}%</b></span>}
          {res.expiryHours !== null && <span>{t.expiry} <b>{res.expiryHours}{t.hours}</b></span>}
        </p>
      )}
      <MercenaryList title={m.mercenary.auctions} items={res.auctions} d={d} m={m} />
      <MercenaryList title={m.mercenary.mine} items={res.myContracts} d={d} m={m} />
      <MercenaryList title={m.mercenary.issued} items={res.issued} d={d} m={m} />
      <Provenance meta={res.meta} m={m} />
    </>
  );
}
