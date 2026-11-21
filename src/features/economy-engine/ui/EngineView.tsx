"use client";
import { useMemo, useState } from "react";
import type { EngineContext, Slot } from "../data/context";
import { readCompany } from "../domain/company";
import { weakest, type Evidence } from "../domain/evidence";
import { parseGoldDecimal } from "../domain/fixed";
import type { ScenarioId } from "../domain/salary";
import { capacityFromPlayer, companyView, DEFAULT_CAPS, overview, type Controls } from "../view";
import { CompanyDetail, CompanyList } from "./CompaniesTab";
import { OppTab } from "./OppTab";
import { EvTag } from "./parts";
import { fmt, textFor, type Text } from "./text";
import s from "./engine.module.css";

const off = (sl: Slot<unknown> | null, t: Text) => (sl === null ? null : sl.state === "ok" ? <EvTag e={sl.evidence} t={t} /> : <span className={`${s.chip} ${s.bad}`}>{sl.state === "rate_limited" ? "429" : t.dq.off}</span>);
const reason = (sl: Slot<unknown> | null, t: Text): string | null => (sl === null || sl.state === "ok" ? null : sl.state === "rate_limited" ? t.errors.rate : sl.state === "missing" ? null : fmt(t.errors.failed, { reason: sl.reason }));

export function EngineView({ ctx, nowMs, locale, names }: { ctx: EngineContext; nowMs: number; locale: string; names: Record<string, string> }) {
  const t = textFor(locale);
  const companies = useMemo(() => (ctx.companies?.state === "ok" ? ctx.companies.value : []), [ctx.companies]);
  const first = companies[0] ? readCompany(companies[0]) : null;
  const [tab, setTab] = useState<"opp" | "mine">(companies.length ? "mine" : "opp");
  const [sel, setSel] = useState(0); const [scen, setScen] = useState<ScenarioId>("balanced");
  const [c, setC] = useState<Controls>({ workers: Math.max(1, first?.workers ?? 1), ownPPPerDay: first?.enginePerDay ?? 0, sellMode: "instant", absorbSharePct: 20, priceShiftPct: 0, caps: { ...DEFAULT_CAPS }, customWage: "", capital: "" });
  const set = <K extends keyof Controls>(k: K, v: Controls[K]) => setC((p) => ({ ...p, [k]: v }));

  const cap = useMemo(() => capacityFromPlayer(ctx, c.workers), [ctx, c.workers]);
  const ov = useMemo(() => overview(ctx, { capacityPP: cap?.pp ?? null, capital: parseGoldDecimal(c.capital) }, nowMs), [ctx, cap, c.capital, nowMs]);
  const best = ov.opps.find((o) => o.vppInstant !== null && !o.signals.includes("no-bids") && !o.signals.includes("thin-depth")) ?? null;
  const views = useMemo(() => companies.map((raw) => companyView(ctx, raw, c, nowMs, best)), [ctx, companies, c, nowMs, best]);
  const cur = views[sel] ?? null;

  const evs: Evidence[] = [ctx.market, ctx.jobs, ctx.activity, ...(ctx.player ? [ctx.player] : []), ...(ctx.taxes ? [ctx.taxes] : [])].flatMap((x) => (x.state === "ok" ? [x.evidence] : []));
  const errs = [ctx.market, ctx.jobs, ctx.player, ctx.companies].map((x) => reason(x, t)).filter((x): x is string => x !== null);
  const capInfo = cap ? { w: c.workers, s: cap.shifts, p: cap.ppShift } : null;

  return (
    <div className={s.root}>
      <div className={s.bar}>
        <div className={s.tabs} role="tablist">
          <button role="tab" type="button" className={s.tab} aria-selected={tab === "opp"} onClick={() => setTab("opp")}>{t.tabs.opp}</button>
          <button role="tab" type="button" className={s.tab} aria-selected={tab === "mine"} onClick={() => setTab("mine")}>{t.tabs.mine}{companies.length ? ` (${companies.length})` : ""}</button>
        </div>
        <details className={s.details} style={{ minInlineSize: "12rem" }}>
          <summary>{t.dq.title}: {evs.length ? <EvTag e={weakest(evs)} t={t} /> : <span className={`${s.chip} ${s.bad}`}>{t.dq.off}</span>}</summary>
          <div>
            <div className={s.chips}>{t.dq.market} {off(ctx.market, t)} {t.dq.jobs} {off(ctx.jobs, t)} {t.dq.trades} {off(ctx.activity, t)} {t.dq.player} {off(ctx.player, t)} {t.dq.taxes} {off(ctx.taxes, t)}</div>
            <p className={s.note}>{t.requests}: {ctx.requests}</p>
          </div>
        </details>
      </div>
      {errs.map((e) => <div key={e} className={s.err} role="alert">{e}</div>)}
      {ctx.player?.state === "missing" && <div className={s.err} role="alert">{t.errors.player}</div>}

      {tab === "opp" && <OppTab ov={ov} names={names} t={t} capacityPP={cap?.pp ?? null} capacityInfo={capInfo} capital={c.capital} setCapital={(v) => set("capital", v)} />}
      {tab === "mine" && (
        <div className={s.root}>
          {!ctx.player && <div className={s.empty}>{t.errors.noPlayer}</div>}
          {ctx.companies?.state === "ok" && companies.length === 0 && <div className={s.empty}>{t.errors.noCompanies}</div>}
          {companies.length > 0 && <CompanyList views={views} sel={sel} setSel={setSel} t={t} names={names} />}
          {cur && <CompanyDetail v={cur} c={c} set={set} t={t} names={names} scen={scen} setScen={setScen} />}
        </div>
      )}
    </div>
  );
}
