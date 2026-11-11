"use client";
import { useState } from "react";
import { SLOT_KEYS, type SlotKey } from "../api-schema";
import { Check, Field, Num } from "./controls";
import type { FormState, SlotForm } from "./form";
import type { BuilderMessages } from "./messages";

const STAT_UNIT: Record<SlotKey, string> = { weapon: "attack", helmet: "critDamage", gloves: "accuracy", chest: "armor", legs: "armor", boots: "dodge" };

/**
 * Six gear tiles (weapon, helmet, gloves, chest, legs, boots). A tile selects a slot; the editor below it edits exactly the same
 * `form.gear[slot]` fields as before (equipped, stats, durability, uses ammo), so every control maps to the existing OptimizeInput.
 * No item pictures: the API supplies codes and rarities, not images. Per-slot "lock" is NOT supported by the engine: Fixed Gear
 * needs all six slots, Optimize treats entered items as candidates; the tiles therefore only reflect that existing choice.
 */
export function GearTiles({ t, gear, fixed, update, hasError }: { t: BuilderMessages; gear: FormState["gear"]; fixed: boolean; update: (fn: (f: FormState) => FormState) => void; hasError: boolean }) {
  const d = t.data; const [sel, setSel] = useState<SlotKey>("weapon");
  const patch = (k: SlotKey, p: Partial<SlotForm>) => update((f) => ({ ...f, gear: { ...f.gear, [k]: { ...f.gear[k], ...p } } }));
  const s = gear[sel];
  const summary = (k: SlotKey) => { const g = gear[k]; if (!g.equipped) return fixed ? d.tileEmpty : d.tileNone; const a = g.stat1.trim() || "…"; return k === "weapon" ? `${a} / ${g.stat2.trim() || "…"}` : a; };
  return (
    <div className="bo-tilebox" data-error={hasError ? "true" : undefined}>
      <p className="hint">{d.tileGearHelp}</p>
      <div className="bo-tiles" role="group" aria-label={fixed ? d.gearFixedTitle : d.gearOwnedTitle}>
        {SLOT_KEYS.map((k) => (
          <button key={k} type="button" className="bo-tile" aria-pressed={sel === k} data-selected={sel === k ? "true" : undefined} data-on={gear[k].equipped ? "true" : undefined} onClick={() => setSel(k)}>
            <span className="bo-tile-name">{t.slots[k]}</span><span className="bo-tile-val">{summary(k)}</span>
          </button>
        ))}
      </div>
      <div className="bo-tile-editor" role="group" aria-label={d.tileEditing.replace("{slot}", t.slots[sel])}>
        <h3>{d.tileEditing.replace("{slot}", t.slots[sel])}</h3>
        <Check checked={s.equipped} onChange={(v) => patch(sel, { equipped: v })} label={fixed ? d.tileHaveFixed : d.tileHaveOwned} />
        {s.equipped ? (
          <div className="bo-row">
            <Field label={t.stats[STAT_UNIT[sel]] ?? STAT_UNIT[sel]} htmlFor={`bo-${sel}-1`}><Num id={`bo-${sel}-1`} value={s.stat1} onChange={(v) => patch(sel, { stat1: v })} /></Field>
            {sel === "weapon" ? <Field label={t.stats.critChance ?? ""} htmlFor="bo-weapon-2"><Num id="bo-weapon-2" value={s.stat2} onChange={(v) => patch(sel, { stat2: v })} /></Field> : null}
            <Field label={d.durability} hint={fixed ? d.durabilityHintFixed : d.durabilityHintOwned} htmlFor={`bo-${sel}-d`}><Num id={`bo-${sel}-d`} value={s.durability} onChange={(v) => patch(sel, { durability: v })} /></Field>
            {sel === "weapon" ? <Check checked={s.usesAmmo} onChange={(v) => patch(sel, { usesAmmo: v })} label={d.usesAmmo} /> : null}
          </div>
        ) : <p className="hint">{fixed ? d.slotEmpty : d.slotNone}</p>}
      </div>
    </div>
  );
}
