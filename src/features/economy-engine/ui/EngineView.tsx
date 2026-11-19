"use client";
import { useMemo, useState } from "react";
import type { EngineContext, Slot } from "../data/context";
import { rankProducts, type ProductRank } from "../domain/engine";
import type { Evidence } from "../domain/evidence";
import { confidenceOf } from "../domain/evidence";
import { goldText, pctToBp } from "../domain/fixed";
import { netOfTax, type PlanResult } from "../domain/economics";
import { RECIPES } from "../domain/recipes";
import { SCENARIO_ORDER, type Reason, type ScenarioId } from "../domain/salary";
import { companyView, DEFAULT_CAPS, toRows, type CompanyView, type Controls } from "../view";
import { readCompany } from "../domain/company";
import { fmt, textFor, type Text } from "./text";
import s from "./engine.module.css";

const bp = (v: bigint | null): string => (v === null ? "-" : `${(Number(v) / 100).toFixed(1)}%`);
const g = (v: bigint | null, d = 4): string => (v === null ? "-" : goldText(v, d));
const n0 = (v: number | null, d = 0): string => (v === null ? "-" : v.toLocaleString("en-US", { maximumFractionDigits: d }));
const Tag = ({ e, t }: { e: Evidence; t: Text }) => <span className={`${s.chip} ${s[e]}`} title={t.conf[confidenceOf(e)]}>{t.ev[e]}</span>;
const slotTag = (sl: Slot<unknown> | null, t: Text) => (sl === null ? <span className={`${s.chip} ${s.bad}`}>{t.dq.unavailable}</span> : sl.state === "ok" ? <Tag e={sl.evidence} t={t} /> : <span className={`${s.chip} ${s.bad}`}>{sl.state === "rate_limited" ? t.rateLimited.split(".")[0] : sl.state}</span>);

function reasonText(r: Reason, t: Text): string {
  switch (r.code) {
    case "anchor": return fmt(t.r.anchor, { p: r.percentile });
    case "capped": return fmt(t.r.capped, { c: r.capPct });
    default: return t.r[r.code];
  }
}

export function EngineView({ ctx, nowMs, locale }: { ctx: EngineContext; nowMs: number; locale: string }) {
  const t = textFor(locale);
  const companies = useMemo(() => (ctx.companies?.state === "ok" ? ctx.companies.value : []), [ctx.companies]);
  const [sel, setSel] = useState(0);
  const first = companies[0] ? readCompany(companies[0]) : null;
  const [c, setC] = useState<Controls>({ workers: Math.max(1, first?.workers ?? 1), ownPPPerDay: first?.enginePerDay ?? 0, sellMode: "instant", absorbSharePct: 20, priceShiftPct: 0, caps: { ...DEFAULT_CAPS }, customWage: "", capital: "" });
  const set = <K extends keyof Controls>(k: K, v: Controls[K]) => setC((p) => ({ ...p, [k]: v }));
  const view = useMemo(() => (companies[sel] ? companyView(ctx, companies[sel], c, nowMs) : null), [ctx, companies, sel, c, nowMs]);

  const marketPct = ctx.taxes?.state === "ok" ? ctx.taxes.value.marketPct : null;
  const rank = useMemo(() => (ctx.market.state === "ok" ? rankProducts(toRows(ctx.market.value), { marketBp: marketPct === null ? 0n : pctToBp(marketPct), productionBp: 0n }, RECIPES) : []), [ctx.market, marketPct]);
  const median = ctx.jobs.state === "ok" && ctx.jobs.value.allowed ? BigInt(ctx.jobs.value.allowed.median) : null;

  return (
    <div className={s.stack}>
      <section className="panel">
        <header><h2>{t.quality}</h2></header>
        <div className={s.chips}>
          <span>{t.dq.market}</span>{slotTag(ctx.market, t)}
          <span>{t.dq.jobs}</span>{slotTag(ctx.jobs, t)}
          <span>{t.dq.player}</span>{slotTag(ctx.player, t)}
          <span>{t.dq.taxes}</span>{slotTag(ctx.taxes, t)}
        </div>
        <p className={s.note}>{t.requests}: {ctx.requests}</p>
        {ctx.market.state !== "ok" && <p className={s.err} role="alert">{ctx.market.state === "rate_limited" ? t.rateLimited : fmt(t.failed, { reason: ctx.market.reason })}</p>}
        {ctx.player?.state === "missing" && <p className={s.err} role="alert">{t.playerMissing}</p>}
        {ctx.player && (ctx.player.state === "rate_limited" || ctx.player.state === "error") && <p className={s.err} role="alert">{ctx.player.state === "rate_limited" ? t.rateLimited : fmt(t.failed, { reason: ctx.player.reason })}</p>}
        {!ctx.player && <p className={s.note}>{t.noPlayer}</p>}
      </section>

      {ctx.market.state === "ok" && (
        <section className="panel">
          <header><h2>{t.rankTitle}</h2></header>
          <p className={s.note}>{t.rankNote}</p>
          <p className={s.note}>{marketPct === null ? t.taxNone : fmt(t.taxUsed, { p: marketPct, src: ctx.taxes?.state === "ok" ? t.ev[ctx.taxes.evidence] : "" })}</p>
          <div className="tablewrap"><table className={s.tbl}>
            <thead><tr><th>{t.product}</th><th className="num">{t.inputsCost}</th><th className="num">{t.vppInstant}</th><th className="num">{t.vppPatient}</th><th className="num">{t.headroom}</th></tr></thead>
            <tbody>{rank.slice(0, 14).map((r: ProductRank) => (
              <tr key={r.item}>
                <td>{r.item}{r.thin && r.vppInstant !== null ? <> <span className={`${s.chip} ${s.assumption}`}>{t.thin}</span></> : null}{r.recipe.mapping === "inferred" ? <> <span className={`${s.chip} ${s.inferred}`}>{t.ev.inferred}</span></> : null}</td>
                <td className="num">{g(r.ingredientCost)}</td>
                <td className="num">{r.vppInstant === null ? t.noPrice : g(r.vppInstant)}</td>
                <td className="num">{r.vppPatient === null ? t.noPrice : g(r.vppPatient)}</td>
                <td className={`num ${r.vppInstant !== null && median !== null ? (r.vppInstant >= median ? s.pos : s.neg) : ""}`}>{r.vppInstant !== null && median !== null ? g(r.vppInstant - median) : "-"}</td>
              </tr>))}</tbody>
          </table></div>
        </section>
      )}

      {ctx.player?.state === "ok" && ctx.companies && ctx.companies.state !== "ok" && <p className={s.err} role="alert">{ctx.companies.state === "rate_limited" ? t.rateLimited : fmt(t.failed, { reason: ctx.companies.reason })}</p>}
      {ctx.companies?.state === "ok" && companies.length === 0 && <p className={s.note}>{t.noCompanies}</p>}

      {companies.length > 0 && (
        <div className={s.tabs} role="tablist">{companies.map((raw, i) => { const co = readCompany(raw); return co ? <button key={co.id} role="tab" aria-selected={i === sel} className={s.btn} onClick={() => setSel(i)}>{co.name} · {co.itemCode}</button> : null; })}</div>
      )}

      {view && <CompanyPanel view={view} c={c} set={set} t={t} />}
      <section className="panel"><header><h2>{t.caveatsTitle}</h2></header><ul className={s.why}>{t.caveats.map((x) => <li key={x}>{x}</li>)}</ul><p className={s.note}>{t.hiringNote}</p></section>
    </div>
  );
}

function Row({ label, cells, cls }: { label: string; cells: (string | null)[]; cls?: (i: number) => string }) {
  return <tr><th scope="row">{label}</th>{cells.map((x, i) => <td key={i} className={`num ${cls ? cls(i) : ""}`}>{x ?? "-"}</td>)}</tr>;
}

function CompanyPanel({ view, c, set, t }: { view: CompanyView; c: Controls; set: <K extends keyof Controls>(k: K, v: Controls[K]) => void; t: Text }) {
  const a = view.analysis; const st = view.state; const m = view.market;
  const plans: { label: string; plan: PlanResult; wage: bigint; net: bigint; shift: bigint | null; day: bigint | null; reasons?: Reason[]; binding?: string; viable?: boolean }[] =
    a.outcomes.map((o) => ({ label: t[o.rec.id], plan: o.plan, wage: o.rec.wage, net: netOfTax(o.rec.wage, view.taxes.incomeBp), shift: o.workerNetPerShift, day: o.workerNetPerDay, reasons: o.rec.reasons, binding: t.bind[o.rec.binding], viable: o.rec.viable }));
  if (view.custom) plans.push({ label: t.custom, plan: view.custom.plan, wage: view.custom.wage, net: view.custom.netWagePerPP, shift: null, day: null });
  const cls = (i: number): string => ((plans[i]?.plan.profit ?? 0n) >= 0n ? s.pos : s.neg) ?? "";
  return (
    <div className={s.stack}>
      <section className="panel">
        <header><h2>{st.name} · {st.itemCode}</h2><Tag e={a.confidence} t={t} /></header>
        <p className={s.note}>{t.stored}: {st.storedPP?.toString() ?? "-"} / {t.capacity}: {st.capacityPP?.toString() ?? "-"} · {t.engine}: {st.enginePerDay ?? "-"} · {t.bonus}: {st.bonusTotalPct}%{st.bonuses.length ? ` (${st.bonuses.map((b) => `${b.source} ${b.percent}%`).join(", ")})` : ""}</p>
        <p className={s.note}>{t.skill}: {view.workers.skillLevel ?? "-"} <Tag e={view.workers.skillEvidence} t={t} /> · {t.ppShift}: {view.workers.ppPerShiftWithBonus} · {t.shifts}: {view.workers.shiftsPerDay}</p>
        {view.workers.skillLevel === null && <p className={s.warn}>{t.skillMissing}</p>}
        {!a.ok && <p className={s.err} role="alert">{a.problems.map((p) => t.problems[p]).join(" ")}</p>}
        {a.notes.map((x) => <p key={x} className={s.warn}>{t.notes[x as keyof Text["notes"]] ?? x}</p>)}
      </section>

      <section className="panel">
        <header><h2>{t.controls}</h2></header>
        <div className={s.grid}>
          <label className={s.ctl}>{t.workers}<input className={s.input} type="number" min={0} max={1000} value={c.workers} onChange={(e) => set("workers", Math.max(0, Number(e.target.value) || 0))} /></label>
          <label className={s.ctl}>{t.ownPP}<input className={s.input} type="number" min={0} value={c.ownPPPerDay} onChange={(e) => set("ownPPPerDay", Math.max(0, Number(e.target.value) || 0))} /></label>
          <label className={s.ctl}>{t.sellMode}<select className={s.input} value={c.sellMode} onChange={(e) => set("sellMode", e.target.value === "patient" ? "patient" : "instant")}><option value="instant">{t.instant}</option><option value="patient">{t.patient}</option></select></label>
          <label className={s.ctl}>{t.absorb}: <output>{c.absorbSharePct}</output><input className={s.range} type="range" min={1} max={100} value={c.absorbSharePct} onChange={(e) => set("absorbSharePct", Number(e.target.value))} /></label>
          <label className={s.ctl}>{t.priceShift}: <output>{c.priceShiftPct}</output><input className={s.range} type="range" min={-50} max={100} value={c.priceShiftPct} onChange={(e) => set("priceShiftPct", Number(e.target.value))} /></label>
          {SCENARIO_ORDER.map((id: ScenarioId) => <label key={id} className={s.ctl}>{t.caps} · {t[id]}: <output>{c.caps[id]}</output><input className={s.range} type="range" min={10} max={100} value={c.caps[id]} onChange={(e) => set("caps", { ...c.caps, [id]: Number(e.target.value) })} /></label>)}
          <label className={s.ctl}>{t.customWage}<input className={s.input} inputMode="decimal" value={c.customWage} placeholder="0.1500" onChange={(e) => set("customWage", e.target.value)} /></label>
          <label className={s.ctl}>{t.capital}<input className={s.input} inputMode="decimal" value={c.capital} onChange={(e) => set("capital", e.target.value)} /></label>
        </div>
        {view.affordablePP !== null && <p className={s.note}>{fmt(t.affordable, { n: view.affordablePP.toString() })}</p>}
      </section>

      {a.ok && (
        <section className="panel">
          <header><h2>{t.scenarios}</h2></header>
          <div className="tablewrap"><table className={s.tbl}>
            <thead><tr><th />{plans.map((p) => <th key={p.label} className="num">{p.label}</th>)}</tr></thead>
            <tbody>
              <Row label={t.wage} cells={plans.map((p) => g(p.wage))} />
              <Row label={t.netWage} cells={plans.map((p) => g(p.net))} />
              <Row label={t.salaryCost} cells={plans.map((p) => g(p.plan.labourCost, 2))} />
              <Row label={t.units} cells={plans.map((p) => String(p.plan.unitsAfterProductionTax))} />
              <Row label={t.sold} cells={plans.map((p) => `${p.plan.unitsSold} / ${p.plan.unitsUnsold}`)} />
              <Row label={t.revenue} cells={plans.map((p) => g(p.plan.netRevenue, 2))} />
              <Row label={t.otherCosts} cells={plans.map((p) => g(p.plan.ingredientCost, 2))} />
              <Row label={t.profit} cells={plans.map((p) => g(p.plan.profit, 2))} cls={cls} />
              <Row label={t.margin} cells={plans.map((p) => bp(p.plan.marginBp))} cls={cls} />
              <Row label={t.breakEven} cells={plans.map((p) => g(p.plan.breakEvenPrice))} />
              <Row label={t.workerShift} cells={plans.map((p) => (p.shift === null ? null : g(p.shift)))} />
              <Row label={t.workerDay} cells={plans.map((p) => (p.day === null ? null : g(p.day)))} />
            </tbody>
          </table></div>
          <h3 style={{ fontSize: "0.95rem" }}>{t.why}</h3>
          {plans.filter((p) => p.reasons).map((p) => <div key={p.label}><strong>{p.label}</strong> <span className={`${s.chip} ${p.viable ? s.cached : s.bad}`}>{p.binding}</span><ul className={s.why}>{p.reasons!.map((r, i) => <li key={i}>{reasonText(r, t)}</li>)}</ul></div>)}
          {a.depthCovers === false && <p className={s.warn}>{t.depthShort}</p>}
          {a.depthCovers === true && <p className={s.note}>{t.depthOk}</p>}
        </section>
      )}

      <section className="panel">
        <header><h2>{t.market}</h2></header>
        <dl className="rows">
          <dt>{t.vwap}</dt><dd>{g(m.vwap7d)} ({m.tradeCount} {t.trades})</dd>
          <dt>{t.perDay}</dt><dd>{m.unitsPerDay === null ? "-" : n0(m.unitsPerDay)}</dd>
          <dt>{t.supply}</dt><dd>{t.sup[m.supply]}{m.daysOfSupply !== null ? ` · ${m.daysOfSupply.toFixed(1)} ${t.dos}` : ""}</dd>
          <dt>{t.vol}</dt><dd>{m.volatilityPct === null ? "-" : `${m.volatilityPct.toFixed(1)}%`}</dd>
          <dt>{t.trend}</dt><dd>{m.trendPct === null ? "-" : `${m.trendPct.toFixed(1)}%`}</dd>
          <dt>{t.bidDepth}</dt><dd>{n0(m.bidQty)}</dd><dt>{t.askDepth}</dt><dd>{n0(m.askQty)}</dd><dt>{t.levels}</dt><dd>{m.bookLevels}</dd>
        </dl>
        <p className={s.note}>{t.supNote}</p>
      </section>

      {view.upgrades.length > 0 && (
        <section className="panel">
          <header><h2>{t.upgrades}</h2></header>
          {view.upgrades.map((u) => (
            <dl key={u.code} className="rows">
              <dt>{u.code === "automatedEngine" ? t.automation : t.storage}</dt><dd>{u.fromLevel} → {u.toLevel}</dd>
              <dt>{t.upCost}</dt><dd>{u.cost === null ? t.upUnknown : `${g(u.cost, 2)} ${t.gold}`}</dd>
              {u.code === "automatedEngine" ? <><dt>{t.upGain}</dt><dd>{u.gain}</dd><dt>{t.upValue}</dt><dd>{g(u.valuePerDay, 2)}</dd><dt>{t.upPayback}</dt><dd>{u.paybackDays === null ? "-" : u.paybackDays.toFixed(1)}</dd></> : <><dt>{t.upCap}</dt><dd>{u.gain}</dd><dt /><dd>{u.binding === null ? "-" : u.binding ? t.upBinding : t.upNotBinding}</dd></>}
            </dl>
          ))}
          <p className={s.note}>{t.upNote}</p>
        </section>
      )}
    </div>
  );
}
