"use client";
import type { BuilderMessages } from "./messages";
import type { EquipmentFillVM, ImportVM } from "../view-model";
import type { SlotKey } from "../api-schema";
import type { SlotForm } from "./form";

/** Read-only status of the profile's equipment, slot by slot, with an explicit per-slot "use these values" action (a user fill-in). */
type FormCmp = "same" | "differs" | "empty";
/** How the gear form currently relates to what the profile reported for one slot (imported vs manual, field by field). */
function compare(form: SlotForm, fill: EquipmentFillVM | null): FormCmp | null {
  if (!fill) return null;
  if (!form.equipped) return "empty"; // an unticked slot is an explicit empty in the form
  const same = Number(form.stat1) === fill.stat1 && (fill.stat2 === undefined || Number(form.stat2) === fill.stat2) && (fill.durability === undefined || form.durability === "" || Number(form.durability) === fill.durability);
  return same ? "same" : "differs";
}
export function EquipmentStatus({ t, eq, form, onUse }: { t: BuilderMessages; eq: ImportVM["equipment"]; form: Record<SlotKey, SlotForm>; onUse: (slot: SlotKey, fill: EquipmentFillVM) => void }) {
  const d = t.data;
  const headline = !eq.reported ? d.eqNotReported : eq.completeness === "complete" ? d.eqComplete : eq.completeness === "partial" ? d.eqPartial : d.eqUnknown;
  const problem = (p: string) => { const [code, rest] = p.split(":"); const label = (d.eqProblem as Record<string, string>)[code ?? ""] ?? p; return rest ? `${label} (${rest})` : label; };
  return (
    <div className="bo-eq" data-completeness={eq.completeness}>
      <p><strong>{d.eqTitle}</strong></p>
      <p className={eq.completeness === "complete" ? "hint" : "note"} role={eq.completeness === "complete" ? undefined : "status"}>{headline}</p>
      <p className="hint">{d.eqHint}</p>
      {eq.reported ? (
        <ul className="bo-eq-list">
          {eq.slots.map((s) => (
            <li key={s.gear} data-status={s.status}>
              <strong>{t.slots[s.gear]}</strong>: {d.eqStatus[s.status]}
              {s.itemCode ? <> · {s.itemCode}{s.rarity ? ` · ${s.rarity}` : ""}</> : null}
              {s.durability !== null ? <> · {d.durability} {s.durability}</> : null}
              {s.problems.length ? <> · {s.problems.map(problem).join(", ")}</> : null}
              {s.fill ? <> · <em data-compare={compare(form[s.gear], s.fill)}>{d.eqForm[compare(form[s.gear], s.fill)!]}</em> <button type="button" className="bo-ghost" onClick={() => onUse(s.gear, s.fill!)}>{d.eqUse}</button></> : null}
            </li>
          ))}
        </ul>
      ) : null}
      {eq.rejected.length ? <p className="hint">{d.eqRejected} {eq.rejected.map((r) => `#${r.index}${r.slot ? ` ${r.slot}` : ""}: ${problem(r.reason)}`).join("; ")}</p> : null}
      {eq.unrecognized.length ? <p className="hint">{d.eqUnrecognized} {eq.unrecognized.join(", ")}</p> : null}
      {eq.slots.some((s) => s.fill) ? <p className="hint">{d.eqUsed}</p> : null}
    </div>
  );
}
