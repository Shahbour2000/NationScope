"use client";
import type { ImportVM } from "../view-model";
import { SKILLS, MAX_LEVEL, type SkillId } from "../engine/skills";
import { Notice } from "./controls";
import { fmt } from "./format";
import type { ConstraintForm } from "./form";
import type { BuilderMessages } from "./messages";
import { clearPins, isLocked, otherRules, pinCurrent, pinOf, pinnedCost, setPin } from "./skill-pins";

const COMBAT: readonly SkillId[] = ["attack", "critChance", "critDamage", "accuracy", "armor", "dodge", "health", "hunger", "lootChance"];
const ECON: readonly SkillId[] = ["energy", "business", "production", "companySlots", "leadership"];

/**
 * Skill Builder grid: current level (filled) and pinned minimum (outlined) for every skill, 10 segments each.
 * A pin is a mandatory minimum that the optimizer may never go below; unpinned = "Any" (the optimizer decides).
 * Pins are real `min` constraints (see skill-pins.ts); verified to be honoured by war, economic and hybrid runs (tests/build-optimizer/skill-pins.test.ts).
 * Locked skills (player level below the unlock level) cannot be pinned.
 */
export function SkillPinGrid({ t, numLocale, imp, constraints, onChange }: { t: BuilderMessages; numLocale: string; imp: ImportVM; constraints: ConstraintForm[]; onChange: (next: ConstraintForm[]) => void }) {
  const p = t.player;
  const skills = imp.skills; if (!skills) return null;
  const lvl = imp.player.level;
  const cur = Object.fromEntries(skills.map((s) => [s.id, s.current])) as Partial<Record<SkillId, number | null>>;
  const cost = pinnedCost(constraints);
  const earned = imp.points.earned;
  const over = imp.points.exact && earned !== null && cost > earned;
  const anyPins = constraints.some((c) => c.kind === "min");
  const apply = (next: ConstraintForm[] | null) => { if (next) onChange(next); };
  const full = constraints.length >= 14;

  const row = (id: SkillId) => {
    const c = cur[id] ?? null, pin = pinOf(constraints, id), locked = isLocked(id, lvl), rules = otherRules(constraints, id);
    return (
      <li key={id} className="bo-pin" data-locked={locked ? "true" : undefined} data-pinned={pin !== null ? "true" : undefined}>
        <span className="bo-pin-name">{t.skills[id]}</span>
        <span className="bo-pin-state">{locked ? p.pinLocked.replace("{n}", String(SKILLS[id].unlockLevel)) : pin !== null ? `≥ ${fmt(pin, numLocale)}` : p.pinAny}</span>
        <span className="bo-segs" role="group" aria-label={t.skills[id]}>
          {Array.from({ length: MAX_LEVEL }, (_, i) => i + 1).map((n) => (
            <button key={n} type="button" className="bo-seg10" disabled={locked} data-have={c !== null && n <= c ? "true" : undefined} data-pin={pin !== null && n <= pin ? "true" : undefined} data-edge={pin === n ? "true" : undefined}
              aria-pressed={pin === n} aria-label={`${t.skills[id]}: ${p.pinSet.replace("{n}", String(n))}`} onClick={() => apply(setPin(constraints, id, pin === n ? null : n))} />
          ))}
        </span>
        <span className="bo-pin-cur" title={p.pinCurrent}>{c === null ? "—" : `${fmt(c, numLocale)}/${MAX_LEVEL}`}</span>
        <span className="bo-pin-btns">
          <button type="button" className="bo-step-btn" disabled={locked || pin === null} aria-label={`${t.skills[id]}: ${p.pinLower}`} onClick={() => apply(setPin(constraints, id, pin === null ? null : pin - 1))}>−</button>
          <button type="button" className="bo-step-btn" disabled={locked || pin === MAX_LEVEL} aria-label={`${t.skills[id]}: ${p.pinRaise}`} onClick={() => apply(setPin(constraints, id, (pin ?? 0) + 1))}>+</button>
        </span>
        {rules.length > 0 ? <span className="bo-pin-rule">{p.pinOtherRule}</span> : null}
      </li>
    );
  };
  const group = (title: string, ids: readonly SkillId[]) => <div key={title}><h3>{title}</h3><ul className="bo-pins">{ids.map(row)}</ul></div>;
  return (
    <section className="card bo-pingrid" aria-labelledby="bo-skills">
      <header className="bo-pin-head">
        <h2 id="bo-skills">{p.pinTitle}</h2>
        <span className="bo-pin-points" data-over={over ? "true" : undefined}>{p.pinReserved.replace("{n}", fmt(cost, numLocale))}{earned !== null ? ` / ${fmt(earned, numLocale)}${imp.points.exact ? "" : " ≥"}` : ""}</span>
      </header>
      <p className="note">{p.pinHint}</p>
      <div className="bo-pin-actions">
        <button type="button" className="bo-ghost" onClick={() => apply(pinCurrent(constraints, cur, lvl))}>{p.pinCurrentAll}</button>
        <button type="button" className="bo-ghost" disabled={!anyPins} onClick={() => onChange(clearPins(constraints))}>{p.pinClear}</button>
      </div>
      {over ? <Notice tone="bad" title={p.pinOverTitle}>{p.pinOver}</Notice> : null}
      {full ? <Notice tone="info">{p.pinLimit}</Notice> : null}
      <div className="bo-skillgrid">
        {group(p.groups.war, COMBAT)}
        {group(p.groups.economic, ECON)}
      </div>
      <p className="hint">{p.pinEstimated}</p>
    </section>
  );
}
