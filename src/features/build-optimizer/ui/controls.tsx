"use client";
import type { ReactNode } from "react";
import type { Evidence } from "../view-model";
import type { BuilderMessages } from "./messages";

/** Small shared controls built on the site's existing classes (.field, .check, .badge, .panel). */
export function Field({ label, hint, error, children, htmlFor }: { label: string; hint?: string; error?: boolean; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="bo-field" data-error={error ? "true" : undefined}>
      <label className="bo-label" htmlFor={htmlFor}>{label}</label>
      {children}
      {hint ? <p className="hint">{hint}</p> : null}
    </div>
  );
}
export function Num({ id, value, onChange, placeholder, unit, disabled, label }: { id: string; value: string; onChange: (v: string) => void; placeholder?: string; unit?: string; disabled?: boolean; label?: string }) {
  return (
    <span className="bo-num">
      <input id={id} className="field" inputMode="decimal" autoComplete="off" value={value} placeholder={placeholder} disabled={disabled} aria-label={label} onChange={(e) => onChange(e.target.value)} />
      {unit ? <span className="bo-unit">{unit}</span> : null}
    </span>
  );
}
export interface SegOption<T extends string> { value: T; label: string; desc?: string; disabled?: boolean }
export function Seg<T extends string>({ value, options, onChange, label, cards }: { value: T; options: SegOption<T>[]; onChange: (v: T) => void; label: string; cards?: boolean }) {
  return (
    <div className={cards ? "bo-cards" : "bo-seg"} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} data-active={value === o.value ? "true" : undefined} disabled={o.disabled} className={cards ? "bo-choice" : "bo-segbtn"} onClick={() => onChange(o.value)}>
          <span className="bo-choice-title">{o.label}</span>
          {o.desc ? <span className="bo-choice-desc">{o.desc}</span> : null}
        </button>
      ))}
    </div>
  );
}
export function Check({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <label className="check bo-check">
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}
export function Section({ title, hint, children, open = true, badge }: { title: string; hint?: string; children: ReactNode; open?: boolean; badge?: ReactNode }) {
  return (
    <details className="bo-sec panel" open={open}>
      <summary><span className="bo-sec-title">{title}</span>{badge}</summary>
      {hint ? <p className="note">{hint}</p> : null}
      <div className="bo-sec-body">{children}</div>
    </details>
  );
}
const TONE: Record<Evidence, string> = { verified: "good", documented: "good", estimated: "warn", unverified: "bad", unknown: "muted" };
export function Ev({ status, t, title }: { status: Evidence; t: BuilderMessages; title?: string }) {
  return <span className="badge bo-ev" data-ev={status} data-tone={TONE[status]} title={title ?? t.evidence[`${status}Desc` as const]}>{t.evidence[status]}</span>;
}
export function Notice({ tone, title, children }: { tone: "info" | "warn" | "bad"; title?: string; children: ReactNode }) {
  return <div className="bo-notice" data-tone={tone} role={tone === "bad" ? "alert" : "note"}>{title ? <strong>{title}</strong> : null}<div>{children}</div></div>;
}
