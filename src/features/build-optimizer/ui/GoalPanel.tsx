"use client";
import { Icon } from "@/components/Icon";
import { Seg } from "./controls";
import { sectionsFor, type FormState, type Mode } from "./form";
import type { BuilderMessages } from "./messages";

/**
 * Step 2: what does the player want? Only the choices that change the calculation are offered. The top switch picks the goal; the groups
 * below it appear only for the combat goal (the only goal with sub-choices). The summary and the "next step asks for" list are derived from
 * the same form state and `sectionsFor` that drive step 3, so they cannot disagree with what step 3 shows.
 */
export function GoalPanel({ t, form, set }: { t: BuilderMessages; form: FormState; set: (patch: Partial<FormState>) => void }) {
  const g = t.goal, d = t.data, sec = sectionsFor(form), war = form.mode === "war";
  const modeLabel = { war: g.war, economic: g.economic, hybrid: g.hybrid }[form.mode];
  const chips = [modeLabel, ...(war ? [form.warKind === "fixedHits" ? g.fixedHits : g.sustainable, form.gearMode === "fixed" ? g.gearFixed : g.gearOptimize, ...(form.warKind === "sustainable" ? [] : [{ maxDamage: g.maxDamage, bestValue: g.bestValue, maxNet: g.maxNet }[form.objective]])] : [])];
  const next = [d.pointsTitle, sec.fight && d.fightTitle, war && sec.gear && (form.gearMode === "fixed" ? d.gearFixedTitle : d.gearOwnedTitle), sec.consumables && d.consumablesTitle, sec.objective && d.objectiveTitle, sec.pill && d.pillTitle, sec.economic && d.economicTitle, sec.hybrid && d.hybridTitle, d.constraintsTitle].filter((x): x is string => typeof x === "string");
  return (
    <section className="bo-step panel" aria-labelledby="bo-step-goal">
      <h2 id="bo-step-goal"><span className="bo-num-badge">2</span>{g.title}</h2>
      <div className="bo-goal-switch">
        <Seg<Mode> cards label={g.title} value={form.mode} onChange={(mode) => set({ mode })} options={[
          { value: "war", label: g.war, desc: g.warDesc }, { value: "economic", label: g.economic, desc: g.economicDesc }, { value: "hybrid", label: g.hybrid, desc: g.hybridDesc },
        ]} />
      </div>
      {war ? (
        <div className="bo-goal-body">
          <div className="bo-goal-group">
            <h3><Icon name="war" size={16} /> {g.fightKind}</h3>
            <Seg label={g.fightKind} cards value={form.warKind} onChange={(warKind) => set({ warKind })} options={[
              { value: "fixedHits", label: g.fixedHits, desc: g.fixedHitsDesc }, { value: "sustainable", label: g.sustainable, desc: g.sustainableDesc },
            ]} />
          </div>
          <div className="bo-goal-group">
            <h3><Icon name="shield" size={16} /> {g.gearKind}</h3>
            <Seg label={g.gearKind} cards value={form.gearMode} onChange={(gearMode) => set({ gearMode })} options={[
              { value: "optimize", label: g.gearOptimize, desc: g.gearOptimizeDesc }, { value: "fixed", label: g.gearFixed, desc: g.gearFixedDesc },
            ]} />
          </div>
          <div className="bo-goal-group">
            <h3><Icon name="scale" size={16} /> {g.objective}</h3>
            {form.warKind === "sustainable" ? <p className="note">{g.sustainableObjective}</p> : (
              <Seg label={g.objective} cards value={form.objective} onChange={(objective) => set({ objective })} options={[
                { value: "maxDamage", label: g.maxDamage, desc: g.maxDamageDesc }, { value: "bestValue", label: g.bestValue, desc: g.bestValueDesc }, { value: "maxNet", label: g.maxNet, desc: g.maxNetDesc },
              ]} />
            )}
          </div>
        </div>
      ) : null}
      {form.mode === "economic" ? <p className="note">{g.economicNote}</p> : null}
      {form.mode === "hybrid" ? <p className="note">{g.hybridNote}</p> : null}
      <div className="bo-goal-summary" aria-label={d.goalSummary}>
        <h3>{d.goalSummary}</h3>
        <ul className="bo-chiplist">{chips.map((c) => <li key={c} className="badge">{c}</li>)}</ul>
        <p className="hint">{d.goalNext} {next.join(" · ")}</p>
      </div>
    </section>
  );
}
