"use client";
import { Icon } from "@/components/Icon";
import { Seg } from "./controls";
import type { FormState, Mode } from "./form";
import type { BuilderMessages } from "./messages";

/** Step 2: what does the player want? Only the choices that change the calculation are offered. */
export function GoalPanel({ t, form, set }: { t: BuilderMessages; form: FormState; set: (patch: Partial<FormState>) => void }) {
  const g = t.goal;
  return (
    <section className="bo-step panel" aria-labelledby="bo-step-goal">
      <h2 id="bo-step-goal"><span className="bo-num-badge">2</span>{g.title}</h2>
      <Seg<Mode> cards label={g.title} value={form.mode} onChange={(mode) => set({ mode })} options={[
        { value: "war", label: g.war, desc: g.warDesc }, { value: "economic", label: g.economic, desc: g.economicDesc }, { value: "hybrid", label: g.hybrid, desc: g.hybridDesc },
      ]} />
      {form.mode === "war" ? (
        <div className="bo-goal-body">
          <h3><Icon name="war" size={16} /> {g.fightKind}</h3>
          <Seg label={g.fightKind} cards value={form.warKind} onChange={(warKind) => set({ warKind })} options={[
            { value: "fixedHits", label: g.fixedHits, desc: g.fixedHitsDesc }, { value: "sustainable", label: g.sustainable, desc: g.sustainableDesc },
          ]} />
          <h3><Icon name="shield" size={16} /> {g.gearKind}</h3>
          <Seg label={g.gearKind} cards value={form.gearMode} onChange={(gearMode) => set({ gearMode })} options={[
            { value: "optimize", label: g.gearOptimize, desc: g.gearOptimizeDesc }, { value: "fixed", label: g.gearFixed, desc: g.gearFixedDesc },
          ]} />
          <h3><Icon name="scale" size={16} /> {g.objective}</h3>
          {form.warKind === "sustainable" ? <p className="note">{g.sustainableObjective}</p> : (
            <Seg label={g.objective} cards value={form.objective} onChange={(objective) => set({ objective })} options={[
              { value: "maxDamage", label: g.maxDamage, desc: g.maxDamageDesc }, { value: "bestValue", label: g.bestValue, desc: g.bestValueDesc }, { value: "maxNet", label: g.maxNet, desc: g.maxNetDesc },
            ]} />
          )}
        </div>
      ) : null}
      {form.mode === "economic" ? <p className="note">{g.economicNote}</p> : null}
      {form.mode === "hybrid" ? <p className="note">{g.hybridNote}</p> : null}
    </section>
  );
}
