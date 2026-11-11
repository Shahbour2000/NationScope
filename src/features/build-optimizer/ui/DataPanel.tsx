"use client";
import { Check, Field, Num, Section, Seg } from "./controls";
import { ConsumableTiles } from "./ConsumableTiles";
import { EquipmentStatus } from "./EquipmentStatus";
import { GearTiles } from "./GearTiles";
import { SKILL_OPTIONS, sectionsFor, type FormIssue, type FormState } from "./form";
import type { ImportVM } from "../view-model";
import type { BuilderMessages } from "./messages";

type Patch = (fn: (f: FormState) => FormState) => void;

/** Step 3: only the inputs the chosen goal can use, grouped in collapsible sections. */
export function DataPanel({ t, form, update, imp, issues }: { t: BuilderMessages; form: FormState; update: Patch; imp: ImportVM; issues: FormIssue[] }) {
  const d = t.data; const sec = sectionsFor(form);
  const bad = (field: string) => issues.some((i) => i.field === field);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => update((f) => ({ ...f, [k]: v }));
  const gearSlot = (k: import("../api-schema").SlotKey, patch: Partial<import("./form").SlotForm>) => update((f) => ({ ...f, gear: { ...f.gear, [k]: { ...f.gear[k], ...patch } } }));
  const fixed = form.mode === "war" && form.gearMode === "fixed";
  return (
    <section className="bo-step" aria-labelledby="bo-step-data">
      <h2 id="bo-step-data" className="bo-step-title"><span className="bo-num-badge">3</span>{d.title}</h2>
      <p className="note">{d.intro}</p>

      <Section title={d.pointsTitle} hint={imp.points.exact ? d.pointsExactHint : d.pointsHint} open={!imp.points.exact}>
        <Seg label={d.pointsTitle} value={form.pointsMethod} onChange={(v) => set("pointsMethod", v)} options={[
          { value: "unknown", label: d.pmUnknown }, { value: "available", label: d.pmAvailable }, { value: "prestige", label: d.pmPrestige }, { value: "total", label: d.pmTotal },
        ]} />
        {form.pointsMethod === "available" ? <Field label={d.availablePoints} hint={d.availableHint} error={bad("availablePoints")} htmlFor="bo-avail"><Num id="bo-avail" value={form.availablePoints} onChange={(v) => set("availablePoints", v)} /></Field> : null}
        {form.pointsMethod === "prestige" ? <Field label={d.prestigeCount} hint={d.prestigeHint} error={bad("prestige")} htmlFor="bo-prestige"><Num id="bo-prestige" value={form.prestige} onChange={(v) => set("prestige", v)} /></Field> : null}
        {form.pointsMethod === "total" ? <Field label={d.totalPoints} hint={d.totalHint} error={bad("totalPoints")} htmlFor="bo-total"><Num id="bo-total" value={form.totalPoints} onChange={(v) => set("totalPoints", v)} /></Field> : null}
        <Field label={d.firstReset} hint={d.firstResetHint}><Seg label={d.firstReset} value={form.firstReset} onChange={(v) => set("firstReset", v)} options={[{ value: "unknown", label: d.unknown }, { value: "free", label: d.resetFree }, { value: "used", label: d.resetUsed }]} /></Field>
      </Section>

      {sec.fight ? (
        <Section title={d.fightTitle} hint={form.warKind === "fixedHits" ? d.fightHintFixed : d.fightHintSustain}>
          {form.warKind === "fixedHits" ? <Field label={d.hits} hint={d.hitsHint} error={bad("hits")} htmlFor="bo-hits"><Num id="bo-hits" value={form.hits} onChange={(v) => set("hits", v)} unit={d.hitsUnit} /></Field> : null}
          <Check checked={form.startKnown} onChange={(v) => set("startKnown", v)} label={d.startKnown} />
          {form.startKnown ? (
            <div className="bo-row">
              <Field label={d.startHealth} htmlFor="bo-sh"><Num id="bo-sh" value={form.startHealthPct} onChange={(v) => set("startHealthPct", v)} unit="%" /></Field>
              <Field label={d.startHunger} htmlFor="bo-shu"><Num id="bo-shu" value={form.startHunger} onChange={(v) => set("startHunger", v)} /></Field>
            </div>
          ) : <p className="hint">{d.startAssumed}</p>}
        </Section>
      ) : null}

      {sec.gear && form.mode === "war" ? (
        <Section title={fixed ? d.gearFixedTitle : d.gearOwnedTitle} hint={fixed ? d.gearFixedHint : d.gearOwnedHint}>
          {bad("gear") ? <p className="bo-err" role="alert">{fixed ? d.needGearStats : d.needCandidates}</p> : null}
          <EquipmentStatus t={t} eq={imp.equipment} form={form.gear} onUse={(k, v) => gearSlot(k, { equipped: true, stat1: String(v.stat1), stat2: v.stat2 === undefined ? "" : String(v.stat2), usesAmmo: v.usesAmmo ?? true, durability: v.durability === undefined ? "" : String(v.durability) })} />
          <GearTiles t={t} gear={form.gear} fixed={fixed} update={update} hasError={bad("gear")} />
          {!fixed ? (
            <div className="bo-optrow">
              <Check checked={form.useMarket} onChange={(v) => set("useMarket", v)} label={d.useMarket.replace("{n}", String(imp.offers?.total ?? 0))} />
              <Check checked={form.allowEmpty} onChange={(v) => set("allowEmpty", v)} label={d.allowEmpty} />
              <Field label={d.estimate} hint={d.estimateHint}><Seg label={d.estimate} value={form.estimate} onChange={(v) => set("estimate", v)} options={[{ value: "low", label: d.low }, { value: "mid", label: d.mid }, { value: "high", label: d.high }]} /></Field>
            </div>
          ) : null}
        </Section>
      ) : null}

      {sec.consumables ? (
        <Section title={d.consumablesTitle} hint={d.consumablesHint}>
          <ConsumableTiles t={t} form={form} update={update} showPill={sec.pill} ammoError={bad("ammo")} foodError={bad("food")} />
        </Section>
      ) : null}

      {sec.objective ? (
        <Section title={d.objectiveTitle} hint={d.objectiveHint}>
          <Field label={d.budget} hint={d.budgetHint} htmlFor="bo-budget"><Num id="bo-budget" value={form.budget} onChange={(v) => set("budget", v)} unit={d.gold} /></Field>
          {form.warKind === "fixedHits" && form.objective === "bestValue" ? <Field label={d.minShare} hint={d.minShareHint} error={bad("minSharePct")} htmlFor="bo-share"><Num id="bo-share" value={form.minSharePct} onChange={(v) => set("minSharePct", v)} unit="%" /></Field> : null}
          {form.warKind === "fixedHits" && form.objective === "maxNet" ? (
            <div className="bo-row">
              <Field label={d.goldPerDamage} hint={d.goldPerDamageHint} error={bad("goldPerDamage")} htmlFor="bo-gpd"><Num id="bo-gpd" value={form.goldPerDamage} onChange={(v) => set("goldPerDamage", v)} /></Field>
              <Field label={d.crateValue} hint={d.crateValueHint} htmlFor="bo-cv"><Num id="bo-cv" value={form.crateValue} onChange={(v) => set("crateValue", v)} unit={d.gold} /></Field>
            </div>
          ) : null}
          {bad("goldPerDamage") ? <p className="bo-err" role="alert">{d.needRevenue}</p> : null}
        </Section>
      ) : null}

      {sec.pill ? (
        <Section title={d.pillTitle} hint={d.pillHint} open={form.pill.enabled}>
          {!form.pill.enabled ? <p className="hint">{d.tilePillHelp}</p> : null}
          {form.pill.enabled ? (
            <>
              <Field label={d.pillState} hint={d.pillStateHint} error={bad("pill.state")}>
                <Seg label={d.pillState} value={form.pill.state} onChange={(v) => update((f) => ({ ...f, pill: { ...f.pill, state: v } }))} options={[{ value: "unknown", label: d.unknown }, { value: "none", label: d.pillNone }, { value: "buff", label: d.pillBuff }, { value: "debuff", label: d.pillDebuff }]} />
              </Field>
              {form.pill.state === "buff" || form.pill.state === "debuff" ? <Field label={d.pillMinutes} error={bad("pill.minutes")} htmlFor="bo-pm"><Num id="bo-pm" value={form.pill.minutes} onChange={(v) => update((f) => ({ ...f, pill: { ...f.pill, minutes: v } }))} unit={d.minutes} /></Field> : null}
              <Field label={d.pillCost} hint={d.pillCostHint}>
                <Seg label={d.pillCost} value={form.pill.costMode} onChange={(v) => update((f) => ({ ...f, pill: { ...f.pill, costMode: v } }))} options={[{ value: "buy", label: d.pillBuy }, { value: "craft", label: d.pillCraft }, { value: "owned", label: d.pillOwned }]} />
              </Field>
              {form.pill.costMode !== "owned" ? <Field label={form.pill.costMode === "buy" ? d.pillPrice : d.cocaPrice} hint={d.pillPriceHint} htmlFor="bo-pp"><Num id="bo-pp" value={form.pill.price} onChange={(v) => update((f) => ({ ...f, pill: { ...f.pill, price: v } }))} unit={d.gold} /></Field> : null}
              <h3>{d.battles}</h3>
              <p className="hint">{d.battlesHint}</p>
              {form.pill.battles.map((b, i) => (
                <div key={i} className="bo-row bo-battle">
                  <Field label={d.battleStart} htmlFor={`bo-b${i}-s`}><Num id={`bo-b${i}-s`} value={b.start} onChange={(v) => update((f) => ({ ...f, pill: { ...f.pill, battles: f.pill.battles.map((x, j) => (j === i ? { ...x, start: v } : x)) } }))} unit={d.minutes} /></Field>
                  <Field label={d.battleDuration} htmlFor={`bo-b${i}-d`}><Num id={`bo-b${i}-d`} value={b.duration} onChange={(v) => update((f) => ({ ...f, pill: { ...f.pill, battles: f.pill.battles.map((x, j) => (j === i ? { ...x, duration: v } : x)) } }))} unit={d.minutes} /></Field>
                  <Field label={d.battleHits} htmlFor={`bo-b${i}-h`}><Num id={`bo-b${i}-h`} value={b.hits} onChange={(v) => update((f) => ({ ...f, pill: { ...f.pill, battles: f.pill.battles.map((x, j) => (j === i ? { ...x, hits: v } : x)) } }))} /></Field>
                  <button type="button" className="bo-ghost" onClick={() => update((f) => ({ ...f, pill: { ...f.pill, battles: f.pill.battles.filter((_, j) => j !== i) } }))} aria-label={d.removeBattle}>✕</button>
                </div>
              ))}
              {form.pill.battles.length < 8 ? <button type="button" className="bo-ghost" onClick={() => update((f) => ({ ...f, pill: { ...f.pill, battles: [...f.pill.battles, { start: "0", duration: "30", hits: "30" }] } }))}>+ {d.addBattle}</button> : null}
            </>
          ) : null}
        </Section>
      ) : null}

      {sec.economic ? (
        <Section title={d.economicTitle} hint={d.economicHint}>
          <div className="bo-row">
            <Field label={d.marketTax} hint={d.taxHint} htmlFor="bo-mt"><Num id="bo-mt" value={form.econ.marketTax} onChange={(v) => update((f) => ({ ...f, econ: { ...f.econ, marketTax: v } }))} unit="%" /></Field>
            <Field label={d.incomeTax} htmlFor="bo-it"><Num id="bo-it" value={form.econ.incomeTax} onChange={(v) => update((f) => ({ ...f, econ: { ...f.econ, incomeTax: v } }))} unit="%" /></Field>
            <Field label={d.productionTax} htmlFor="bo-pt"><Num id="bo-pt" value={form.econ.productionTax} onChange={(v) => update((f) => ({ ...f, econ: { ...f.econ, productionTax: v } }))} unit="%" /></Field>
          </div>
          <Field label={d.jobWage} hint={d.jobWageHint} htmlFor="bo-jw"><Num id="bo-jw" value={form.econ.jobWage} onChange={(v) => update((f) => ({ ...f, econ: { ...f.econ, jobWage: v } }))} unit={d.goldPerPoint} /></Field>
          <div className="bo-row">
            <Field label={d.workerPoints} hint={d.workersHint} htmlFor="bo-wp"><Num id="bo-wp" value={form.econ.workerPoints} onChange={(v) => update((f) => ({ ...f, econ: { ...f.econ, workerPoints: v } }))} /></Field>
            <Field label={d.workerWage} htmlFor="bo-ww"><Num id="bo-ww" value={form.econ.workerWage} onChange={(v) => update((f) => ({ ...f, econ: { ...f.econ, workerWage: v } }))} unit={d.goldPerPoint} /></Field>
          </div>
          <Field label={d.sellBasis} hint={d.sellBasisHint}><Seg label={d.sellBasis} value={form.econ.sellBasis} onChange={(v) => update((f) => ({ ...f, econ: { ...f.econ, sellBasis: v } }))} options={[{ value: "bid", label: d.bid }, { value: "last", label: d.last }, { value: "ask", label: d.ask }]} /></Field>
        </Section>
      ) : null}

      {sec.hybrid ? (
        <Section title={d.hybridTitle} hint={d.hybridHint}>
          <Seg label={d.hybridTitle} cards value={form.hybrid.kind} onChange={(v) => update((f) => ({ ...f, hybrid: { ...f.hybrid, kind: v } }))} options={[{ value: "constrained", label: d.hyConstrained, desc: d.hyConstrainedDesc }, { value: "weighted", label: d.hyWeighted, desc: d.hyWeightedDesc }]} />
          {form.hybrid.kind === "constrained" ? <Field label={d.minDailyNet} hint={d.minDailyNetHint} error={bad("hybrid.minDailyNet")} htmlFor="bo-mdn"><Num id="bo-mdn" value={form.hybrid.minDailyNet} onChange={(v) => update((f) => ({ ...f, hybrid: { ...f.hybrid, minDailyNet: v } }))} unit={d.goldPerDay} /></Field> : (
            <div className="bo-row">
              <Field label={d.weightCombat} htmlFor="bo-wc"><Num id="bo-wc" value={form.hybrid.wCombat} onChange={(v) => update((f) => ({ ...f, hybrid: { ...f.hybrid, wCombat: v } }))} /></Field>
              <Field label={d.weightEconomy} htmlFor="bo-we"><Num id="bo-we" value={form.hybrid.wEconomy} onChange={(v) => update((f) => ({ ...f, hybrid: { ...f.hybrid, wEconomy: v } }))} /></Field>
            </div>
          )}
        </Section>
      ) : null}

      <Section title={d.constraintsTitle} hint={d.constraintsHint} open={form.constraints.length > 0 || form.keepCurrent}>
        <Check checked={form.keepCurrent} onChange={(v) => set("keepCurrent", v)} label={d.keepCurrent} />
        <p className="hint">{d.keepCurrentHint}</p>
        {form.constraints.map((c, i) => (
          <div key={i} className="bo-row bo-constraint">
            <Field label={d.skill}><select className="field" value={c.skill} onChange={(e) => update((f) => ({ ...f, constraints: f.constraints.map((x, j) => (j === i ? { ...x, skill: e.target.value as typeof c.skill } : x)) }))}>{SKILL_OPTIONS.map((s) => <option key={s} value={s}>{t.skills[s]}</option>)}</select></Field>
            <Field label={d.rule}><select className="field" value={c.kind} onChange={(e) => update((f) => ({ ...f, constraints: f.constraints.map((x, j) => (j === i ? { ...x, kind: e.target.value as typeof c.kind } : x)) }))}><option value="min">{d.ruleMin}</option><option value="max">{d.ruleMax}</option><option value="exact">{d.ruleExact}</option></select></Field>
            <Field label={d.level} error={bad(`constraint.${c.skill}`)} htmlFor={`bo-c${i}`}><Num id={`bo-c${i}`} value={c.level} onChange={(v) => update((f) => ({ ...f, constraints: f.constraints.map((x, j) => (j === i ? { ...x, level: v } : x)) }))} unit="0–10" /></Field>
            <button type="button" className="bo-ghost" aria-label={d.removeConstraint} onClick={() => update((f) => ({ ...f, constraints: f.constraints.filter((_, j) => j !== i) }))}>✕</button>
          </div>
        ))}
        {form.constraints.length < 14 ? <button type="button" className="bo-ghost" onClick={() => update((f) => ({ ...f, constraints: [...f.constraints, { skill: "companySlots", kind: "min", level: "1" }] }))}>+ {d.addConstraint}</button> : null}
        {imp.companies.count ? <p className="hint">{d.companiesAuto.replace("{n}", String(imp.companies.count))}</p> : null}
      </Section>
    </section>
  );
}
