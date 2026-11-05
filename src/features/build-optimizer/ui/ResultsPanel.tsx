"use client";
import { useState } from "react";
import { Icon } from "@/components/Icon";
import type { BuildVM, CurrentVM, ResultOk, ResultVM, PillVM } from "../view-model";
import { Ev, Notice } from "./controls";
import { DASH, fmt, fmtGold, minutesLabel, signed } from "./format";
import type { BuilderMessages } from "./messages";

type T = BuilderMessages;
function Metric({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "good" | "bad" }) {
  return <div className="metric" data-tone={tone}><dt>{label}</dt><dd>{value}</dd>{sub ? <dd className="metric-sub">{sub}</dd> : null}</div>;
}

function Skills({ b, t }: { b: BuildVM; t: T }) {
  const r = t.results;
  return (
    <div className="bo-skillgrid">
      {(["war", "economic"] as const).map((g) => {
        const rows = b.skills.filter((s) => s.group === g);
        return (
          <div key={g}>
            <h4>{t.player.groups[g]}</h4>
            <ul className="bo-skills">
              {rows.map((s) => { const d = s.current === null ? 0 : s.proposed - s.current; return (
                <li key={s.id} data-changed={d !== 0 ? "true" : undefined}>
                  <span>{t.skills[s.id]}</span>
                  <span className="progress" aria-hidden="true"><span style={{ inlineSize: `${s.proposed * 10}%` }} /></span>
                  <b>{s.current !== null && d !== 0 ? `${s.current} → ${s.proposed}` : `${s.proposed}`}</b>
                  <em title={s.interpolated ? r.valueEstimated : undefined}>{fmt(s.proposedValue, "en", 1)}{s.interpolated ? "*" : ""}</em>
                </li>); })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function Gear({ b, t, numLocale }: { b: BuildVM; t: T; numLocale: string }) {
  const r = t.results;
  if (!b.gear) return null;
  return (
    <div className="tablewrap"><table className="table">
      <thead><tr><th>{r.slot}</th><th>{r.item}</th><th>{r.stats}</th><th>{r.durability}</th></tr></thead>
      <tbody>{b.gear.map((g) => (
        <tr key={g.slot}>
          <th scope="row">{t.slots[g.slot]}</th>
          <td>{g.id === null ? <span className="hint">{r.empty}</span> : <>{g.owned ? <span className="badge" data-tone="good">{r.owned}</span> : <span className="badge">{r.market}</span>} {g.estimated ? <span className="badge" data-tone="warn">{r.estimateBadge}</span> : null}</>}</td>
          <td>{g.stats ? Object.entries(g.stats).filter(([k]) => k !== "usesAmmo").map(([k, v]) => `${t.stats[k] ?? k} ${typeof v === "number" ? fmt(v, numLocale, 1) : ""}`).join(" · ") : DASH}</td>
          <td>{g.durability !== null ? fmt(g.durability, numLocale) : DASH}</td>
        </tr>))}</tbody>
    </table></div>
  );
}

function Cost({ b, t, numLocale }: { b: BuildVM; t: T; numLocale: string }) {
  const r = t.results; const c = b.cost;
  if (!c) return null;
  return (
    <>
      <table className="table bo-kv"><tbody>
        <tr><th scope="row">{r.acquisition}</th><td>{fmtGold(c.acquisition, numLocale)}</td></tr>
        <tr><th scope="row">{r.ammoCost}</th><td>{fmtGold(c.ammo, numLocale)}</td></tr>
        <tr><th scope="row">{r.foodCost}</th><td>{fmtGold(c.food, numLocale)}</td></tr>
        <tr><th scope="row">{r.replacement}</th><td>{fmtGold(c.replacement, numLocale)}</td></tr>
        <tr className="bo-total"><th scope="row">{r.total}</th><td>{c.lowerBound ? "≥ " : ""}{fmtGold(c.total, numLocale)}</td></tr>
      </tbody></table>
      {c.lowerBound ? <Notice tone="warn" title={r.lowerBoundTitle}>{r.lowerBoundBody}{c.missing.length ? <ul>{c.missing.map((m) => <li key={m}>{m}</li>)}</ul> : null}</Notice> : null}
    </>
  );
}

function BuildCard({ b, res, current, t, numLocale }: { b: BuildVM; res: ResultOk; current: CurrentVM | null; t: T; numLocale: string }) {
  const r = t.results; const war = b.combat, ses = b.session, eco = b.economy;
  const dmgDelta = current?.damage !== null && current?.damage !== undefined && (war || ses) ? (war?.damage ?? ses!.damage) - current.damage : null;
  const netDelta = current?.economyNet !== null && current?.economyNet !== undefined && eco ? eco.net - current.economyNet : null;
  return (
    <article className="bo-build" aria-live="polite">
      <dl className="metrics">
        {war && res.kind === "war" ? <>
          <Metric label={r.expectedDamage.replace("{n}", fmt(war.hits, numLocale))} value={fmt(war.damage, numLocale)} sub={war.damageLow !== null ? `${fmt(war.damageLow, numLocale)} – ${fmt(war.damageHigh, numLocale)} (${r.estimateBadge})` : dmgDelta !== null ? `${signed(dmgDelta, numLocale)} ${r.vsCurrent}` : undefined} tone={dmgDelta !== null && dmgDelta > 0 ? "good" : undefined} />
          <Metric label={r.perHit} value={fmt(war.perHit, numLocale, 1)} sub={r.perHitNote} />
          <Metric label={r.totalCost} value={b.cost ? `${b.cost.lowerBound ? "≥ " : ""}${fmtGold(b.cost.total, numLocale)}` : DASH} sub={b.costPer1000 !== null ? `${fmtGold(b.costPer1000, numLocale)} / ${r.per1000}` : undefined} />
          {b.net !== null ? <Metric label={r.net} value={`${b.netUpperBound ? "≤ " : ""}${fmtGold(b.net, numLocale)}`} sub={b.netUpperBound ? r.netUpperNote : undefined} tone={b.net > 0 ? "good" : "bad"} /> : <Metric label={r.crates} value={fmt(war.crates, numLocale, 1)} sub={`${fmt(war.lootChancePct, numLocale)}% ${t.stats.lootChance}`} />}
        </> : null}
        {ses ? <>
          <Metric label={r.sustainHits} value={fmt(ses.hits, numLocale)} sub={`${r.limitedBy}: ${r.limits[ses.limiting as keyof typeof r.limits] ?? ses.limiting}`} />
          <Metric label={r.sessionDamage} value={fmt(ses.damage, numLocale)} sub={dmgDelta !== null ? `${signed(dmgDelta, numLocale)} ${r.vsCurrent}` : undefined} tone={dmgDelta !== null && dmgDelta > 0 ? "good" : undefined} />
          <Metric label={r.perHit} value={fmt(ses.perHit, numLocale, 1)} sub={r.perHitNote} />
          <Metric label={r.totalCost} value={b.cost ? `${b.cost.lowerBound ? "≥ " : ""}${fmtGold(b.cost.total, numLocale)}` : DASH} sub={b.costPer1000 !== null ? `${fmtGold(b.costPer1000, numLocale)} / ${r.per1000}` : undefined} />
        </> : null}
        {eco ? <>
          <Metric label={r.dailyNet} value={fmtGold(eco.net, numLocale)} sub={netDelta !== null ? `${signed(netDelta, numLocale)} ${r.vsCurrent}` : r.estimateBadge} tone={netDelta !== null && netDelta > 0 ? "good" : undefined} />
          <Metric label={r.ownProfit} value={fmtGold(eco.ownProfit, numLocale)} sub={`${fmt(eco.ownWorksPerDay, numLocale, 1)} ${r.worksPerDay}`} />
          <Metric label={r.jobIncome} value={fmtGold(eco.jobIncome, numLocale)} />
          <Metric label={r.workerMargin} value={fmtGold(eco.workerMargin, numLocale)} sub={`${fmt(eco.effectiveWorkers, numLocale)} ${r.workers}`} />
        </> : null}
        {res.kind === "hybrid" && war ? <Metric label={r.perHit} value={fmt(war.perHit, numLocale, 1)} sub={current?.perHit != null ? `${signed(war.perHit - current.perHit, numLocale, 1)} ${r.vsCurrent}` : r.perHitNote} /> : null}
      </dl>

      <h3>{r.skillsTitle}</h3>
      <p className="hint">{r.pointsLine.replace("{spent}", fmt(b.pointsSpent, numLocale)).replace("{left}", fmt(b.pointsRemaining, numLocale)).replace("{total}", fmt(res.totalPoints, numLocale))}{!res.pointsExact ? ` ${r.pointsLowerBound}` : ""}</p>
      {b.reset.required ? <Notice tone="warn" title={r.resetTitle}>{r.resetBody.replace("{cost}", b.reset.costGold === null ? DASH : fmtGold(b.reset.costGold, numLocale))}</Notice> : <p className="hint">{r.noReset}</p>}
      <Skills b={b} t={t} />
      <p className="hint">* {r.valueEstimated}</p>

      {b.gear ? <><h3>{r.gearTitle}</h3><Gear b={b} t={t} numLocale={numLocale} /></> : null}
      {b.ammo ? <p className="bo-line"><strong>{r.ammo}:</strong> {t.data.ammo[b.ammo as keyof typeof t.data.ammo] ?? b.ammo}{b.food ? <> · <strong>{r.food}:</strong> {b.food.type} ({fmt(b.food.meals, numLocale)} {r.meals})</> : null}</p> : null}
      {war && res.kind === "war" ? <p className="bo-line"><strong>{r.survival}:</strong> {r.survivalLine.replace("{loss}", fmt(war.lossPerHit, numLocale, 2)).replace("{meals}", fmt(war.meals, numLocale)).replace("{hunger}", fmt(war.hungerAvailable, numLocale))}</p> : null}
      {ses ? <p className="bo-line"><strong>{r.survival}:</strong> {r.sessionLine.replace("{loss}", fmt(ses.lossPerHit, numLocale, 2)).replace("{meals}", fmt(ses.mealsTotal, numLocale)).replace("{left}", fmt(ses.hungerLeft, numLocale))}</p> : null}
      {b.cost ? <><h3>{r.costTitle}</h3><Cost b={b} t={t} numLocale={numLocale} /></> : null}
      {b.preserved.length ? <p className="hint">{r.preserved}: {b.preserved.join(", ")}</p> : null}
    </article>
  );
}

function Compare({ res, t, numLocale }: { res: ResultOk; t: T; numLocale: string }) {
  const r = t.results; const cur = res.current;
  if (res.builds.length < 2 && !cur) return null;
  const val = (b: BuildVM) => b.combat?.damage ?? b.session?.damage ?? null;
  return (
    <section className="card" aria-labelledby="bo-compare">
      <h2 id="bo-compare"><Icon name="scale" size={18} />{r.compareTitle}</h2>
      <div className="tablewrap"><table className="table">
        <thead><tr><th>{r.build}</th><th>{res.kind === "economic" || res.kind === "hybrid" ? r.dailyNet : r.damage}</th><th>{r.totalCost}</th><th>{r.points}</th></tr></thead>
        <tbody>
          {cur ? <tr><th scope="row">{r.currentBuild}</th><td>{res.kind === "economic" || res.kind === "hybrid" ? fmtGold(cur.economyNet, numLocale) : fmt(cur.damage, numLocale)}</td><td>{DASH}</td><td>—</td></tr> : null}
          {res.builds.map((b, i) => <tr key={i}><th scope="row">{r.roles[b.role]}</th><td>{res.kind === "economic" || res.kind === "hybrid" ? fmtGold(b.economy?.net ?? null, numLocale) : fmt(val(b), numLocale)}</td><td>{b.cost ? `${b.cost.lowerBound ? "≥ " : ""}${fmtGold(b.cost.total, numLocale)}` : DASH}</td><td>{fmt(b.pointsSpent, numLocale)}</td></tr>)}
        </tbody>
      </table></div>
    </section>
  );
}

function Pill({ pill, t, numLocale }: { pill: PillVM; t: T; numLocale: string }) {
  const r = t.results;
  if (!pill.ok) return <Notice tone="warn" title={r.pillTitle}>{r.pillErr[pill.reason as keyof typeof r.pillErr] ?? pill.message}</Notice>;
  return (
    <section className="card" aria-labelledby="bo-pill">
      <h2 id="bo-pill"><Icon name="flame" size={18} />{r.pillTitle}</h2>
      <p className="note">{r.pillIntro}</p>
      <div className="tablewrap"><table className="table">
        <thead><tr><th>{r.plan}</th><th>{r.damage}</th><th>{r.extra}</th><th>{r.pillCost}</th><th>{r.pillNet}</th></tr></thead>
        <tbody>
          <tr><th scope="row">{r.noPill}</th><td>{fmt(pill.baselineDamage, numLocale)}</td><td>—</td><td>—</td><td>—</td></tr>
          {pill.plans.map((p) => <tr key={p.label} data-best={p.label === pill.best ? "true" : undefined}><th scope="row">{p.useAtMinutes === null ? p.label : r.useAt.replace("{t}", minutesLabel(p.useAtMinutes))}{p.label === pill.best ? <span className="badge" data-tone="good">{r.best}</span> : null}</th><td>{fmt(p.totalDamage, numLocale)}</td><td>{signed(p.deltaDamage, numLocale)}</td><td>{fmtGold(p.goldCost, numLocale)}</td><td>{p.net === null ? DASH : signed(p.net, numLocale)}</td></tr>)}
        </tbody>
      </table></div>
      <p className="hint">{r.pillScope}</p>
      <ul className="hint-list">{pill.assumptions.map((a) => <li key={a}>{a}</li>)}</ul>
    </section>
  );
}

export function ResultsPanel({ result, t, numLocale }: { result: ResultVM; t: T; numLocale: string }) {
  const [tab, setTab] = useState(0);
  const r = t.results;
  if (!result.ok) {
    return (
      <section className="bo-step panel" aria-labelledby="bo-step-res">
        <h2 id="bo-step-res"><span className="bo-num-badge">5</span>{r.title}</h2>
        <Notice tone={result.reason === "infeasible" || result.reason === "conflict" ? "warn" : "bad"} title={r.reasons[result.reason]}>
          <p>{result.message}</p>{result.details.length ? <ul>{result.details.map((d) => <li key={d}>{d}</li>)}</ul> : null}
          <p className="hint">{r.reasonHelp[result.reason]}</p>
        </Notice>
      </section>
    );
  }
  const b = result.builds[Math.min(tab, result.builds.length - 1)]!;
  return (
    <section className="bo-step" aria-labelledby="bo-step-res">
      <h2 id="bo-step-res" className="bo-step-title"><span className="bo-num-badge">5</span>{r.title}</h2>
      <div className="bo-banner panel">
        <div><strong>{r.kindLabel[result.kind]}</strong> <span className="hint">· {r.objectiveLabel[result.objective as keyof typeof r.objectiveLabel] ?? result.objective}</span></div>
        <div className="bo-banner-ev"><Ev status={result.evidence} t={t} /><span>{r.estimateNote}</span></div>
      </div>
      {result.lowerBoundCost ? <Notice tone="warn" title={r.lowerBoundTitle}>{r.lowerBoundBody}</Notice> : null}
      {result.estimatedGear ? <Notice tone="warn" title={r.estimatedGearTitle}>{r.estimatedGearBody}</Notice> : null}
      {result.notes.length ? <Notice tone="info"><ul>{result.notes.map((n) => <li key={n}>{n}</li>)}</ul></Notice> : null}

      <div className="panel">
        {result.builds.length > 1 ? (
          <div className="bo-tabs" role="tablist" aria-label={r.title}>
            {result.builds.map((x, i) => <button key={i} type="button" role="tab" aria-selected={i === tab} data-active={i === tab ? "true" : undefined} onClick={() => setTab(i)}>{r.roles[x.role]}</button>)}
          </div>
        ) : null}
        <BuildCard b={b} res={result} current={result.current} t={t} numLocale={numLocale} />
        <section className="bo-why"><h3>{r.whyTitle}</h3><p>{r.why[result.objective as keyof typeof r.why] ?? r.why.default}</p></section>
      </div>

      <Compare res={result} t={t} numLocale={numLocale} />
      {result.pill ? <Pill pill={result.pill} t={t} numLocale={numLocale} /> : null}

      <details className="bo-sec panel">
        <summary><span className="bo-sec-title">{r.assumptionsTitle}</span></summary>
        <ul>{result.assumptions.map((a) => <li key={a}>{a}</li>)}</ul>
      </details>
      <details className="bo-sec panel">
        <summary><span className="bo-sec-title">{r.formulasTitle}</span></summary>
        <p className="note">{r.formulasNote}</p>
        <ul className="bo-formulas">{result.formulas.map((f) => <li key={f.id}><Ev status={f.status} t={t} /> <code>{f.id}</code>{f.kind === "algorithm" ? <span className="badge">{r.algorithm}</span> : null}<p>{f.summary}</p></li>)}</ul>
      </details>
    </section>
  );
}
