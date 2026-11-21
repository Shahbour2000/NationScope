"use client";
import { useState } from "react";
import { Icon } from "@/components/Icon";
import type { Rec } from "../domain/recommendations";
import { SCENARIO_ORDER, type Reason, type ScenarioId } from "../domain/salary";
import type { CompanyView, Controls } from "../view";
import { CurveChart, EvTag, ItemIcon, Meter, Spark, money, pct, tone } from "./parts";
import { fmt, type Text } from "./text";
import s from "./engine.module.css";

export function recText(r: Rec, t: Text, nm: (c: string) => string): string {
  switch (r.kind) {
    case "offer-wage": return fmt(t.rec["offer-wage"], { w: money(r.wage), s: t.scen[r.scenario], p: money(r.profit, 0) });
    case "switch-product": return fmt(t.rec["switch-product"], { i: nm(r.item), g: !Number.isFinite(r.gainPct) ? "∞" : r.gainPct >= 300 ? `×${(1 + r.gainPct / 100).toFixed(0)}` : `${r.gainPct.toFixed(0)}%` });
    case "automation": return fmt(t.rec.automation, { c: money(r.cost, 0), d: r.paybackDays.toFixed(0) });
    case "unsold": return fmt(t.rec.unsold, { u: r.unsold, n: r.produced });
    case "capital-short": return fmt(t.rec["capital-short"], { a: r.affordablePP.toString(), n: r.neededPP.toString() });
    default: return t.rec[r.kind];
  }
}
const reasonText = (r: Reason, t: Text): string => (r.code === "anchor" ? fmt(t.r.anchor, { p: r.percentile }) : r.code === "capped" ? fmt(t.r.capped, { c: r.capPct }) : t.r[r.code]);
const SCEN_SUB: Record<ScenarioId, "sConservative" | "sBalanced" | "sCompetitive"> = { conservative: "sConservative", balanced: "sBalanced", competitive: "sCompetitive" };

type Outcome = CompanyView["analysis"]["outcomes"][number];
const DETAIL_ROWS = (t: Text): [string, (o: Outcome) => string][] => [
  [t.co.perPoint, (o) => money(o.rec.wage)], [t.co.workerShift, (o) => money(o.workerNetPerShift)], [t.co.salaries, (o) => money(o.plan.labourCost, 2)],
  [t.co.unitsMade, (o) => String(o.plan.unitsAfterProductionTax)], [t.co.revenue, (o) => money(o.plan.netRevenue, 2)], [t.co.inputs, (o) => money(o.plan.ingredientCost, 2)],
  [t.co.profitDay, (o) => money(o.plan.profit, 2)], [t.co.margin, (o) => pct(o.plan.marginBp)], [t.co.breakEven, (o) => money(o.plan.breakEvenPrice)],
];

export function CompanyList({ views, sel, setSel, t, names }: { views: (CompanyView | null)[]; sel: number; setSel: (i: number) => void; t: Text; names: Record<string, string> }) {
  return (
    <div className={s.cards}>
      {views.map((v, i) => {
        if (!v) return null;
        const bal = v.analysis.outcomes.find((o) => o.rec.id === "balanced"); const p = bal?.plan.profit ?? null;
        return (
          <button key={v.state.id} type="button" className={s.card} aria-pressed={i === sel} onClick={() => setSel(i)}>
            <div className={s.head}><span className={`${s.dot} ${p === null ? "" : p >= 0n ? s.g : s.r}`} aria-hidden /><ItemIcon code={v.state.itemCode} /><strong>{v.state.name}</strong></div>
            <div className={s.sub}>{names[v.state.itemCode] ?? v.state.itemCode}</div>
            <div className={`${s.big} ${tone(p)}`}>{p === null ? t.co.unknown : `${p > 0n ? "+" : ""}${money(p, 0)}`}</div>
            <div className={s.sub}>{p !== null && p < 0n ? t.co.loss : t.co.profit}</div>
          </button>
        );
      })}
    </div>
  );
}

export function CompanyDetail({ v, c, set, t, names, scen, setScen }: { v: CompanyView; c: Controls; set: <K extends keyof Controls>(k: K, x: Controls[K]) => void; t: Text; names: Record<string, string>; scen: ScenarioId; setScen: (x: ScenarioId) => void }) {
  const nm = (x: string) => names[x] ?? x;
  const a = v.analysis, m = v.market;
  const cur = a.outcomes.find((o) => o.rec.id === scen);
  const maxAbs = Math.max(1, ...a.outcomes.map((o) => Math.abs(Number(o.plan.profit))));
  const [open, setOpen] = useState(false);
  return (
    <div className={s.root}>
      <div className={s.head}><ItemIcon code={v.state.itemCode} size={40} /><div><h2 style={{ margin: 0 }}>{v.state.name}</h2><span className={s.sub}>{nm(v.state.itemCode)}</span></div><span style={{ marginInlineStart: "auto" }}><EvTag e={a.confidence} t={t} /></span></div>
      {!a.ok && <div className={s.err} role="alert">{a.problems.map((p) => t.problems[p]).join(" ")}</div>}
      {a.notes.map((x) => <div key={x} className={`${s.banner} ${s.warn}`}><Icon name="flame" size={18} /><p>{t.notes[x as keyof Text["notes"]] ?? x}</p></div>)}
      {v.workers.skillLevel === null && <div className={`${s.banner} ${s.warn}`}><p>{t.co.skillMissing}</p></div>}
      <div className={s.recs}>{v.recs.slice(0, 4).map((r, i) => <div key={i} className={`${s.banner} ${s[r.severity]}`}><Icon name={r.severity === "good" ? "coins" : r.severity === "bad" ? "flame" : "trend"} size={18} /><p>{recText(r, t, nm)}</p></div>)}</div>

      {a.ok && (<>
        <section aria-label={t.co.wageTitle} className={s.root}>
          <h3 style={{ margin: 0 }}>{t.co.wageTitle}</h3>
          <div className={s.cards}>
            {SCENARIO_ORDER.map((id) => {
              const o = a.outcomes.find((x) => x.rec.id === id)!;
              return (
                <button key={id} type="button" className={s.card} aria-pressed={scen === id} onClick={() => setScen(id)}>
                  <div className={s.head}><strong>{t.co[id]}</strong><span className={s.sub}>{t.co[SCEN_SUB[id]]}</span></div>
                  <div><span className={s.big}>{money(o.rec.wage)}</span> <span className={s.sub}>{t.co.perPoint}</span></div>
                  <div className={tone(o.plan.profit)}>{o.plan.profit > 0n ? "+" : ""}{money(o.plan.profit, 0)} <span className={s.sub}>{t.co.profitDay}</span></div>
                  <Meter value={Math.abs(Number(o.plan.profit))} max={maxAbs} kind={o.plan.profit >= 0n ? "gain" : "loss"} />
                  {!o.rec.viable && <span className={`${s.chip} ${s.bad}`}>{t.co.notViable}</span>}
                </button>
              );
            })}
          </div>
          {cur && (
            <div className={s.panel2}>
              <h3>{t.co.today}</h3>
              <dl className={s.kv}>
                <dt>{t.co.profitDay}</dt><dd className={tone(cur.plan.profit)}>{money(cur.plan.profit, 0)}</dd>
                <dt>{t.co.margin}</dt><dd>{pct(cur.plan.marginBp)}</dd>
                <dt>{t.co.worker}</dt><dd>{cur.workerNetPerDay === null ? "-" : money(cur.workerNetPerDay)}</dd>
                <dt>{t.co.breakEven}</dt><dd>{money(cur.plan.breakEvenPrice)}</dd>
                <dt>{fmt(t.co.sold, { a: cur.plan.unitsSold, b: cur.plan.unitsAfterProductionTax })}</dt><dd />
              </dl>
              <div className={s.chips}><strong>{t.co.why}:</strong></div>
              <ul className={s.why}>{cur.rec.reasons.map((r, i) => <li key={i}>{reasonText(r, t)}</li>)}</ul>
            </div>
          )}
        </section>

        <div className={s.two}>
          <section className={s.panel2}>
            <h3>{t.co.whatIf}</h3>
            <label className={s.ctl}>{t.co.workers}: <output>{c.workers}</output><input className={s.range} type="range" min={0} max={30} value={Math.min(30, c.workers)} onChange={(e) => set("workers", Number(e.target.value))} /></label>
            <label className={s.ctl}>{t.co.priceShift}: <output>{c.priceShiftPct > 0 ? "+" : ""}{c.priceShiftPct}%</output><input className={s.range} type="range" min={-50} max={100} value={c.priceShiftPct} onChange={(e) => set("priceShiftPct", Number(e.target.value))} /></label>
            <label className={s.ctl}>{t.co.yourWage}<input className={s.input} inputMode="decimal" value={c.customWage} placeholder="0.1500" onChange={(e) => set("customWage", e.target.value)} /></label>
            {v.custom && <p className={tone(v.custom.plan.profit)}>{money(v.custom.plan.profit, 0)} {t.co.profitDay} · {pct(v.custom.plan.marginBp)}</p>}
            <details className={s.details} open={open} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
              <summary>{t.co.more}</summary>
              <div>
                <label className={s.ctl}>{t.co.ownPP}<input className={s.input} type="number" min={0} value={c.ownPPPerDay} onChange={(e) => set("ownPPPerDay", Math.max(0, Number(e.target.value) || 0))} /></label>
                <label className={s.ctl}>{t.co.sellMode}<select className={s.input} value={c.sellMode} onChange={(e) => set("sellMode", e.target.value === "patient" ? "patient" : "instant")}><option value="instant">{t.co.instant}</option><option value="patient">{t.co.patient}</option></select></label>
                <label className={s.ctl}>{t.co.absorb}: <output>{c.absorbSharePct}</output><input className={s.range} type="range" min={1} max={100} value={c.absorbSharePct} onChange={(e) => set("absorbSharePct", Number(e.target.value))} /></label>
                <label className={s.ctl}>{t.co.capital}<input className={s.input} inputMode="decimal" value={c.capital} onChange={(e) => set("capital", e.target.value)} /></label>
                {SCENARIO_ORDER.map((id) => <label key={id} className={s.ctl}>{t.co.caps} · {t.co[id]}: <output>{c.caps[id]}</output><input className={s.range} type="range" min={10} max={100} value={c.caps[id]} onChange={(e) => set("caps", { ...c.caps, [id]: Number(e.target.value) })} /></label>)}
              </div>
            </details>
          </section>
          <section className={s.panel2}>
            <h3>{t.co.curveTitle}</h3>
            <CurveChart curve={v.curve} label={t.co.curveTitle} marks={a.outcomes.map((o) => ({ wage: o.rec.wage, profit: o.plan.profit, label: t.co[o.rec.id] }))} />
            <p className={s.note}>{t.co.curveHint}</p>
          </section>
        </div>
      </>)}

      <div className={s.two}>
        <section className={s.panel2}>
          <h3>{t.co.marketTitle}</h3>
          {v.sparkSource && <><Spark points={v.spark} label={v.sparkSource === "history" ? t.co.price7 : t.co.priceRecent} /><p className={s.note}>{v.sparkSource === "history" ? `${t.co.price7} · ${t.co.priceNote}` : t.co.priceRecent}</p></>}
          <dl className={s.kv}>
            <dt>{t.co.vwap}</dt><dd>{money(m.vwap7d)}</dd>
            <dt>{t.co.perDay}</dt><dd>{m.unitsPerDay === null ? "-" : Math.round(m.unitsPerDay)}</dd>
            <dt>{t.co.supply}</dt><dd>{t.sup[m.supply]}</dd>
            <dt>{t.co.trend}</dt><dd className={m.trendPct === null ? "" : m.trendPct >= 0 ? s.gain : s.loss}>{m.trendPct === null ? "-" : `${m.trendPct > 0 ? "+" : ""}${m.trendPct.toFixed(1)}%`}</dd>
            <dt>{t.co.volatility}</dt><dd>{m.volatilityPct === null ? "-" : `${m.volatilityPct.toFixed(1)}%`}</dd>
          </dl>
          <p className={s.note}>{t.supNote}</p>
        </section>
        {v.upgrades.length > 0 && (
          <section className={s.panel2}>
            <h3>{t.co.upgradeTitle}</h3>
            {v.upgrades.map((u) => (
              <div key={u.code} className={s.card}>
                <div className={s.head}><Icon name="tool" size={18} /><strong>{u.code === "automatedEngine" ? t.co.engine : t.co.storage}</strong><span className={s.sub}>{u.fromLevel} → {u.toLevel}</span></div>
                <div className={s.sub}>{t.co.costLabel}: {u.cost === null ? t.co.priceMissing : money(u.cost, 0)}</div>
                {u.code === "automatedEngine"
                  ? <div className={u.paybackDays !== null && u.paybackDays <= 30 ? s.gain : ""}>{fmt(t.co.extraPP, { n: u.gain })}{u.paybackDays !== null ? ` · ${fmt(t.co.payback, { d: u.paybackDays.toFixed(0) })}` : ""}</div>
                  : <div>{fmt(t.co.extraCap, { n: u.gain })} · <span className={u.binding ? s.warnTag : s.muted}>{u.binding === null ? "-" : u.binding ? t.co.storeFull : t.co.storeRoom}</span></div>}
              </div>
            ))}
          </section>
        )}
      </div>

      <details className={s.details}>
        <summary>{t.co.details}</summary>
        <div>
          <p className={s.note}>{t.co.stored}: {v.state.storedPP?.toString() ?? "-"}/{v.state.capacityPP?.toString() ?? "-"} · {t.co.engineDay}: {v.state.enginePerDay ?? "-"} · {t.co.bonus}: {v.state.bonusTotalPct}% · {t.co.skill}: {v.workers.skillLevel ?? "-"} <EvTag e={v.workers.skillEvidence} t={t} /> · {t.co.ppShift}: {v.workers.ppPerShiftWithBonus} · {t.co.shifts}: {v.workers.shiftsPerDay}</p>
          {a.ok && <div className={s.scroll}><table className={s.tbl}>
            <thead><tr><th />{a.outcomes.map((o) => <th key={o.rec.id} className={s.num}>{t.co[o.rec.id]}</th>)}</tr></thead>
            <tbody>
              {(DETAIL_ROWS(t)).map(([label, f]) => <tr key={label}><th scope="row">{label}</th>{a.outcomes.map((o) => <td key={o.rec.id} className={s.num}>{f(o)}</td>)}</tr>)}
            </tbody>
          </table></div>}
          <strong>{t.caveatsTitle}</strong><ul className={s.why}>{t.caveats.map((x) => <li key={x}>{x}</li>)}</ul>
        </div>
      </details>
      
    </div>
  );
}
