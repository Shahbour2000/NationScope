"use client";
import { useMemo, useState } from "react";
import type { Opportunity, Signal } from "../domain/opportunities";
import type { Overview } from "../view";
import { Meter, EvTag, ItemIcon, money, tone } from "./parts";
import { fmt, type Text } from "./text";
import s from "./engine.module.css";

type Kind = "all" | "raw" | "made";
const SHOW: readonly Signal[] = ["no-bids", "thin-depth", "wide-spread", "wage-above-value", "inferred-recipe"];

export function OppTab({ ov, names, t, capacityPP, capacityInfo, capital, setCapital }: { ov: Overview; names: Record<string, string>; t: Text; capacityPP: bigint | null; capacityInfo: { w: number; s: number; p: number } | null; capital: string; setCapital: (v: string) => void }) {
  const [kind, setKind] = useState<Kind>("all"); const [hideThin, setHideThin] = useState(false); const [onlyAff, setOnlyAff] = useState(false);
  const nm = (c: string) => names[c] ?? c;
  const list = useMemo(() => ov.opps.filter((o) => o.vppInstant !== null && (kind === "all" || (kind === "raw") === (o.recipe.kind === "raw")) && !(hideThin && (o.signals.includes("thin-depth") || o.signals.includes("no-bids"))) && !(onlyAff && o.affordable !== true)), [ov.opps, kind, hideThin, onlyAff]);
  const top = list.slice(0, 6);
  const maxV = Math.max(1, ...top.map((o) => Number(o.vppInstant ?? 0n)));
  const Card = ({ o, i }: { o: Opportunity; i: number }) => {
    const v = o.vppInstant!;
    return (
      <div className={s.card}>
        <div className={s.head}><span className={s.rank}>{i + 1}</span><ItemIcon code={o.item} /><strong>{nm(o.item)}</strong></div>
        <div><span className={`${s.big} ${tone(v)}`}>{money(v)}</span> <span className={s.sub}>{t.opp.perPP}</span></div>
        <Meter value={Math.max(0, Number(v))} max={maxV} kind={v > 0n ? "gain" : "loss"} />
        <div className={s.sub}>{o.visibleDemandUnits === null ? t.opp.noBuyers : fmt(t.opp.demand, { n: o.visibleDemandUnits })}{o.headroom !== null ? ` · ${o.headroom > 0n ? fmt(t.opp.vsWage, { d: money(o.headroom) }) : t.opp.belowWage}` : ""}</div>
        {o.dailyProfit !== null && o.dailyProfit > 0n && <div className={`${s.sub} ${s.gain}`}>{fmt(t.opp.earn, { g: money(o.dailyProfit, 0) })}</div>}
        <div className={s.chips}>{o.signals.filter((x) => SHOW.includes(x)).slice(0, 3).map((x) => <span key={x} className={`${s.chip} ${x === "inferred-recipe" ? s.inferred : s.warnTag}`} title={t.sigHelp[x]}>{t.sig[x]}</span>)}</div>
      </div>
    );
  };
  return (
    <div className={s.root}>
      <div><h2 style={{ margin: 0 }}>{t.opp.title}</h2><p className={s.note}>{t.opp.sub}</p></div>
      <div className={s.filters} role="group">
        {(["all", "raw", "made"] as const).map((k) => <button key={k} type="button" className={s.pill} aria-pressed={kind === k} onClick={() => setKind(k)}>{t.opp[k]}</button>)}
        <button type="button" className={s.pill} aria-pressed={hideThin} onClick={() => setHideThin(!hideThin)}>{t.opp.hideThin}</button>
        <button type="button" className={s.pill} aria-pressed={onlyAff} onClick={() => setOnlyAff(!onlyAff)}>{t.opp.affordable}</button>
        <label className={s.ctl} style={{ marginInlineStart: "auto" }}>{t.co.capital}<input className={s.input} inputMode="decimal" value={capital} onChange={(e) => setCapital(e.target.value)} style={{ maxInlineSize: "9rem" }} /></label>
      </div>
      <p className={s.note}>{capacityPP !== null && capacityInfo ? fmt(t.opp.capacity, { n: capacityPP.toString(), ...capacityInfo }) : t.opp.capacityNone}</p>
      {top.length === 0 ? <div className={s.empty}>{t.opp.empty}</div> : <div className={s.cards}>{top.map((o, i) => <Card key={o.item} o={o} i={i} />)}</div>}
      <details className={s.details}>
        <summary>{t.opp.moreTitle} ({list.length})</summary>
        <div>
          <p className={s.note}>{t.opp.basis}</p>
          {ov.marketPct !== null && <p className={s.note}>{fmt(t.opp.taxNote, { m: ov.marketPct, p: ov.productionPct ?? 0 })}</p>}
          {ov.activitySpanHours !== null && <p className={s.note}>{fmt(t.opp.sampleNote, { h: ov.activitySpanHours.toFixed(1) })}</p>}
          <div className={s.scroll}><table className={s.tbl}>
            <thead><tr><th>{t.opp.cols.product}</th><th className={s.num}>{t.opp.cols.value}</th><th className={s.num}>{t.opp.cols.wageGap}</th><th className={s.num}>{t.opp.cols.demand}</th><th className={s.num}>{t.opp.cols.activity}</th><th className={s.num}>{t.opp.cols.cost}</th><th /></tr></thead>
            <tbody>{list.map((o) => (
              <tr key={o.item}>
                <td><span className={s.head}><ItemIcon code={o.item} size={22} />{nm(o.item)}</span></td>
                <td className={`${s.num} ${tone(o.vppInstant)}`}>{money(o.vppInstant)}</td>
                <td className={`${s.num} ${tone(o.headroom)}`}>{money(o.headroom)}</td>
                <td className={s.num}>{o.visibleDemandUnits ?? "-"}</td>
                <td className={s.num}>{o.marketUnitsPerDay === null ? "-" : Math.round(o.marketUnitsPerDay)}</td>
                <td className={s.num}>{money(o.ingredientCost)}</td>
                <td><EvTag e={o.evidence.recipe === "inferred" ? "inferred" : "live"} t={t} /></td>
              </tr>))}</tbody>
          </table></div>
        </div>
      </details>
    </div>
  );
}
