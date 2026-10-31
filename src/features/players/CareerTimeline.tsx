"use client";

import { useEffect, useMemo, useState } from "react";

export type CareerCategory = "account" | "president" | "vice" | "minister" | "congress" | "other";
export interface CareerEvent {
  id: string;
  category: CareerCategory;
  title: string;
  startMs: number;
  /** End of the term; null while it is still running (or for single-moment events). */
  endMs: number | null;
  /** True for offices still held: the bar runs to "now". */
  ongoing: boolean;
  lines: { label: string; value: string }[];
}

const COLOR: Record<CareerCategory, string> = { account: "#34d399", president: "#facc15", vice: "#fb923c", minister: "#a78bfa", congress: "#22d3ee", other: "#94a3b8" };
const ORDER: CareerCategory[] = ["account", "president", "vice", "minister", "congress", "other"];
const LANE_H = 30, MARK = 24, MIN_GAP_PCT = 5, PAD_PCT = 4;

/** One distinct silhouette per category so the roles stay recognisable without colour. */
export function Shape({ cat, size = MARK }: { cat: CareerCategory; size?: number }) {
  const c = COLOR[cat];
  const body = {
    president: <path d="M12 2.5l2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17l-5.9 3.3 1.3-6.5L2.5 9.3l6.6-.8z" fill={c} />,
    vice: <path d="M12 2.5l9 9.5-9 9.5L3 12z" fill={c} />,
    minister: <path d="M12 2.5l8 4.5v10l-8 4.5-8-4.5V7z" fill={c} />,
    congress: <rect x="3.5" y="3.5" width="17" height="17" rx="4" fill={c} />,
    account: <circle cx="12" cy="12" r="8" fill="none" stroke={c} strokeWidth="3.5" />,
    other: <circle cx="12" cy="12" r="6.5" fill={c} />,
  }[cat];
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">{body}</svg>;
}

interface Placed extends CareerEvent { xPct: number; endPct: number; lane: number }

export function CareerTimeline({ items, nowMs, nl, rtl, label, legend, ongoingLabel }: {
  items: CareerEvent[]; nowMs: number; nl: string; rtl: boolean; label: string; legend: Record<CareerCategory, string>; ongoingLabel: string;
}) {
  const [open, setOpen] = useState<{ id: string; rect: { left: number; top: number; bottom: number; width: number } } | null>(null);

  const layout = useMemo(() => {
    const min = Math.min(...items.map((e) => e.startMs));
    const max = Math.max(nowMs, ...items.map((e) => e.endMs ?? e.startMs));
    const span = Math.max(max - min, 24 * 3600 * 1000);
    const x = (t: number) => PAD_PCT + ((100 - 2 * PAD_PCT) * (t - min)) / span;
    const lanes: number[] = [];
    const placed: Placed[] = [...items].sort((a, b) => a.startMs - b.startMs || a.id.localeCompare(b.id)).map((e) => {
      const xPct = x(e.startMs);
      let lane = lanes.findIndex((last) => xPct - last >= MIN_GAP_PCT);
      if (lane === -1) lane = lanes.length;
      lanes[lane] = xPct;
      return { ...e, xPct, endPct: x(e.ongoing ? nowMs : e.endMs ?? e.startMs), lane };
    });
    const ticks = Array.from({ length: 5 }, (_, i) => ({ pct: PAD_PCT + ((100 - 2 * PAD_PCT) * i) / 4, ms: min + (span * i) / 4 }));
    return { placed, ticks, laneCount: Math.max(1, lanes.length) };
  }, [items, nowMs]);

  const fmt = useMemo(() => new Intl.DateTimeFormat(nl, { month: "short", year: "numeric", timeZone: "UTC" }), [nl]);
  const cats = ORDER.filter((c) => items.some((e) => e.category === c));
  const active = open ? layout.placed.find((e) => e.id === open.id) : null;

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(null);
    const key = (ev: KeyboardEvent) => { if (ev.key === "Escape") close(); };
    window.addEventListener("keydown", key);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => { window.removeEventListener("keydown", key); window.removeEventListener("scroll", close, true); window.removeEventListener("resize", close); };
  }, [open]);

  const show = (id: string, el: HTMLElement) => { const r = el.getBoundingClientRect(); setOpen({ id, rect: { left: r.left, top: r.top, bottom: r.bottom, width: r.width } }); };
  const trackH = 26 + 10 + MARK + (layout.laneCount - 1) * LANE_H + 12;
  const popW = 240;
  const pop = open && active ? (() => {
    const vw = typeof window === "undefined" ? 800 : window.innerWidth;
    const left = Math.min(Math.max(8, open.rect.left + open.rect.width / 2 - popW / 2), vw - popW - 8);
    const above = open.rect.top > 170;
    return { left, ...(above ? { bottom: (typeof window === "undefined" ? 0 : window.innerHeight) - open.rect.top + 8 } : { top: open.rect.bottom + 8 }) };
  })() : null;

  return (
    <div className="ctl" aria-label={label}>
      <ul className="ctl-legend">{cats.map((c) => <li key={c}><Shape cat={c} size={16} /> {legend[c]}</li>)}</ul>
      <div className="ctl-scroll">
        <div className="ctl-track" style={{ blockSize: trackH }} dir="ltr">
          <div className="ctl-axis" />
          {layout.placed.filter((e) => e.category !== "account" && e.endPct > e.xPct).map((e) => (
            <span key={`bar-${e.id}`} className="ctl-span" style={{ insetInlineStart: `${e.xPct}%`, inlineSize: `${e.endPct - e.xPct}%`, background: COLOR[e.category] }} aria-hidden="true" />
          ))}
          {layout.ticks.map((t) => <span key={t.pct} className="ctl-tick" style={{ insetInlineStart: `${t.pct}%` }}><i />{fmt.format(t.ms)}</span>)}
          {layout.placed.map((e) => (
            <div key={e.id} className="ctl-ev" style={{ insetInlineStart: `${e.xPct}%`, blockSize: 10 + MARK / 2 + e.lane * LANE_H }}>
              <span className="ctl-stem" style={{ background: COLOR[e.category] }} aria-hidden="true" />
              <button
                type="button" className="ctl-mark" data-cat={e.category} aria-expanded={open?.id === e.id}
                onMouseEnter={(ev) => show(e.id, ev.currentTarget)} onMouseLeave={() => setOpen(null)}
                onFocus={(ev) => show(e.id, ev.currentTarget)} onBlur={() => setOpen(null)}
                onClick={(ev) => (open?.id === e.id ? setOpen(null) : show(e.id, ev.currentTarget))}
              >
                <Shape cat={e.category} /><span className="sr-only">{e.title}</span>
              </button>
            </div>
          ))}
        </div>
      </div>
      {active && pop && (
        <div className="ctl-pop" role="tooltip" dir={rtl ? "rtl" : "ltr"} style={{ ...pop, inlineSize: popW, borderColor: COLOR[active.category] }}>
          <strong dir="auto"><Shape cat={active.category} size={16} /> {active.title}</strong>
          <dl>
            {active.lines.map((l) => <div key={l.label}><dt>{l.label}</dt><dd dir="auto">{l.value}</dd></div>)}
            {active.ongoing && <div><dt /><dd><span className="chip">{ongoingLabel}</span></dd></div>}
          </dl>
        </div>
      )}
    </div>
  );
}
