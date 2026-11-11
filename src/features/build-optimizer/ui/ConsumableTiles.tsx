"use client";
import { Check, Field, Num } from "./controls";
import type { AmmoKey, FoodKey, FormState } from "./form";
import type { BuilderMessages } from "./messages";

const AMMO: AmmoKey[] = ["none", "light", "medium", "heavy"], FOODS: FoodKey[] = ["bread", "steak", "cookedFish"];

/**
 * Ammo, food and Pill tiles. Each tile toggles an existing input: ammo types and foods the optimizer may use (form.ammo / form.food[*].use)
 * and whether a Pill analysis is included (form.pill.enabled, only offered for fixed-hit fights, where the engine supports it).
 * "Excluded" is a real restriction (the engine only considers the allowed ones); nothing here is decorative.
 */
export function ConsumableTiles({ t, form, update, showPill, ammoError, foodError }: { t: BuilderMessages; form: FormState; update: (fn: (f: FormState) => FormState) => void; showPill: boolean; ammoError: boolean; foodError: boolean }) {
  const d = t.data;
  const setFood = (k: FoodKey, p: Partial<FormState["food"][FoodKey]>) => update((f) => ({ ...f, food: { ...f.food, [k]: { ...f.food[k], ...p } } }));
  const tile = (key: string, label: string, on: boolean, onClick: () => void, sub?: string) => (
    <button key={key} type="button" className="bo-tile" aria-pressed={on} data-on={on ? "true" : undefined} data-selected={on ? "true" : undefined} onClick={onClick}>
      <span className="bo-tile-name">{label}</span><span className="bo-tile-val">{sub ?? (on ? d.tileAllowed : d.tileExcluded)}</span>
    </button>
  );
  return (
    <div className="bo-tilebox">
      <h3>{d.ammoTitle}</h3>
      <p className="hint">{d.tileAmmoHelp}</p>
      <div className="bo-tiles" role="group" aria-label={d.ammoTitle} data-error={ammoError ? "true" : undefined}>
        {AMMO.map((a) => tile(a, d.ammo[a], form.ammo[a], () => update((f) => ({ ...f, ammo: { ...f.ammo, [a]: !f.ammo[a] } }))))}
      </div>
      {ammoError ? <p className="bo-err" role="alert">{d.needAmmo}</p> : null}
      <div className="bo-row">
        <Field label={d.leadStock} hint={d.leadStockHint} htmlFor="bo-lead"><Num id="bo-lead" value={form.leadStock} onChange={(v) => update((f) => ({ ...f, leadStock: v }))} /></Field>
        <Check checked={form.buyAmmo} onChange={(v) => update((f) => ({ ...f, buyAmmo: v }))} label={d.buyAmmo} />
      </div>

      <h3>{d.foodTitle}</h3>
      <p className="hint">{d.tileFoodHelp}</p>
      <div className="bo-tiles" role="group" aria-label={d.foodTitle} data-error={foodError ? "true" : undefined}>
        {FOODS.map((k) => tile(k, d.food[k], form.food[k].use, () => setFood(k, { use: !form.food[k].use }), form.food[k].use && form.food[k].price.trim() ? `${form.food[k].price} ${d.gold}` : undefined))}
      </div>
      {foodError ? <p className="bo-err" role="alert">{d.needFoodPrices}</p> : null}
      {FOODS.filter((k) => form.food[k].use).map((k) => (
        <div key={k} className="bo-food bo-row">
          <strong>{d.food[k]}</strong>
          <Field label={d.price} htmlFor={`bo-f-${k}-p`}><Num id={`bo-f-${k}-p`} value={form.food[k].price} onChange={(v) => setFood(k, { price: v })} unit={d.gold} /></Field>
          <Field label={d.stock} hint={form.warKind === "sustainable" ? d.foodStockHint : undefined} htmlFor={`bo-f-${k}-s`}><Num id={`bo-f-${k}-s`} value={form.food[k].stock} onChange={(v) => setFood(k, { stock: v })} /></Field>
        </div>
      ))}

      {showPill ? (
        <>
          <h3>{d.pillTitle}</h3>
          <div className="bo-tiles" role="group" aria-label={d.pillTitle}>
            {tile("pill", d.pillTitle, form.pill.enabled, () => update((f) => ({ ...f, pill: { ...f.pill, enabled: !f.pill.enabled } })), form.pill.enabled ? d.tilePillOn : d.tilePillOff)}
          </div>
          <p className="hint">{d.tilePillHelp}</p>
        </>
      ) : null}
    </div>
  );
}
