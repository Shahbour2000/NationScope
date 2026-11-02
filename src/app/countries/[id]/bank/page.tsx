import { ApiErrorState } from "@/components/ApiErrorState";
import { Provenance } from "@/components/Provenance";
import { Tabs } from "@/components/Tabs";
import { countryTabs } from "@/features/countries/tabs";
import { SubHead } from "@/features/countries/SubHead";
import { countryName } from "@/features/entities/display";
import { getDisplay } from "@/features/entities/display.server";
import { Flag, Money } from "@/features/entities/entities";
import { getLocale, getMessages } from "@/i18n";
import { getCountryBank } from "@/lib/data/world";
import { formatDate } from "@/lib/format";
import s from "@/features/countries/sub.module.css";

export const dynamic = "force-dynamic";
const nonZero = (v: string | null) => v !== null && /^\d+$/.test(v) && BigInt(v) > 0n;

export default async function BankPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = getMessages(await getLocale());
  const t = m.countrySubs.bank;
  const tabs = countryTabs(id, m, "bank");
  let b;
  try { b = await getCountryBank(id); } catch (e) { return <><h1>{t.title}</h1><Tabs items={tabs} label={t.title} /><ApiErrorState error={e} retryLabel={m.common.retry} /></>; }
  const d = await getDisplay();
  const nf = new Intl.NumberFormat(d.nl);
  const pct = (v: number | null) => (v === null ? "—" : `${nf.format(v)}%`);
  const hasMoney = nonZero(b.supply) || nonZero(b.inCirculation) || nonZero(b.reserve);
  return (
    <>
      <SubHead id={id} title={t.title} tabs={tabs} d={d} />
      <div className={s.kpis}>
        {b.treasury && <div><b><Money value={b.treasury} d={d} /></b><span>{t.treasury}</span></div>}
        {b.exchangeFee !== null && <div><b>{pct(b.exchangeFee)}</b><span>{t.exchangeFee}{b.maxExchangeFee !== null ? ` · ${t.upTo.replace("{n}", nf.format(b.maxExchangeFee))}` : ""}</span></div>}
        {b.importTax !== null && <div><b>{pct(b.importTax)}</b><span>{t.importTax}{b.maxTradeTax !== null ? ` · ${t.upTo.replace("{n}", nf.format(b.maxTradeTax))}` : ""}</span></div>}
        {b.exportTax !== null && <div><b>{pct(b.exportTax)}</b><span>{t.exportTax}</span></div>}
      </div>
      <div className={s.cols} style={{ marginBlockStart: 0 }}>
        <section className={s.sec}>
          <h2>{t.currency}</h2>
          <div className={s.panel}>
            <dl>
              <div><dt>{b.currencyName ?? t.currency}</dt><dd>{b.currencyCode ?? ""}</dd></div>
              <div><dt>{t.backed}</dt><dd>{b.backed ? t.on : t.off}</dd></div>
              <div><dt>{t.buyback}</dt><dd>{b.buyback ? t.on : t.off}</dd></div>
              {b.mintCap && <div><dt>{t.mintCap}</dt><dd><Money value={b.mintCap} d={d} /></dd></div>}
              {hasMoney && b.supply && <div><dt>{t.supply}</dt><dd><Money value={b.supply} d={d} /></dd></div>}
              {hasMoney && b.inCirculation && <div><dt>{t.circulation}</dt><dd><Money value={b.inCirculation} d={d} /></dd></div>}
              {hasMoney && b.reserve && <div><dt>{t.reserve}</dt><dd><Money value={b.reserve} d={d} /></dd></div>}
            </dl>
          </div>
          {b.port && (
            <>
              <h2 style={{ marginBlockStart: "1.4rem" }}>{t.port}</h2>
              <div className={s.panel}>
                <dl><div><dt>{t.portLevel}</dt><dd>{b.port.level}{b.port.max !== null && <small> / {b.port.max}</small>}</dd></div>{b.port.nextCost !== null && <div><dt>{t.nextUpgrade}</dt><dd>{nf.format(b.port.nextCost)}</dd></div>}</dl>
                {b.port.max ? <div className={s.track}><i style={{ inlineSize: `${(b.port.level / b.port.max) * 100}%` }} /></div> : null}
              </div>
            </>
          )}
        </section>
        <section className={s.sec}>
          <h2>{t.embargoes} <small>{nf.format(b.embargoes.length)}</small></h2>
          {b.embargoes.length === 0 ? <p className={s.empty}>{t.embargoNone}</p> : (
            <div className={s.list}>
              {b.embargoes.map((e) => {
                const other = e.byCountryId === id ? e.onCountryId : e.byCountryId;
                return (
                  <div key={e.id} className={s.emb}>
                    <span className={s.grow}><Flag id={other} d={d} /><b style={{ color: "#fff" }}>{countryName(other, d.dir)}</b></span>
                    <span className={s.mutual} style={{ color: e.byCountryId === id ? "#f5c542" : "#f87171" }}>{e.byCountryId === id ? t.imposed : t.against}</span>
                    {e.endsAt && <span className={s.date}>{t.until} {formatDate(e.endsAt, d.nl)}</span>}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
      <Provenance meta={b.meta} m={m} />
    </>
  );
}
