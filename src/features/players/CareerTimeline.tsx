"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Icon, type IconName } from "@/components/Icon";
import s from "./CareerTimeline.module.css";

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

const COLOR: Record<CareerCategory, string> = { account: "#cbd5e1", president: "#f5c542", vice: "#93c5fd", minister: "#a78bfa", congress: "#2dd4bf", other: "#94a3b8" };
const ICON: Record<CareerCategory, IconName> = { account: "user", president: "crown", vice: "medal", minister: "briefcase", congress: "landmark", other: "flag" };
const ROW = 36, BAR_H = 28, PAD = 18, MIN_BAR = 30, CHAR_W = 7.1, GAP = 10;
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

interface Placed extends CareerEvent { x0: number; w: number; lane: number; inside: boolean; labelLeft: boolean; labelW: number }

/** Nice tick spacing (in days) so labels stay about 90px apart. */
function tickStepDays(spanDays: number, plotW: number): number {
  const want = Math.max(2, Math.floor(plotW / 90));
  for (const step of [1, 2, 3, 7, 14, 30, 60, 90, 180, 365]) if (spanDays / step <= want) return step;
  return 365;
}

export function CareerTimeline({ items, nowMs, nl, rtl, label, ongoingLabel }: {
  items: CareerEvent[]; nowMs: number; nl: string; rtl: boolean; label: string; ongoingLabel: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(720);
  const [open, setOpen] = useState<{ id: string; rect: { left: number; top: number; bottom: number; width: number } } | null>(null);

  useIsoLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const read = () => setWidth(Math.max(260, Math.floor(el.clientWidth)));
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const layout = useMemo(() => {
    const plotW = width - PAD * 2;
    const min = Math.min(...items.map((e) => e.startMs));
    const max = Math.max(nowMs, ...items.map((e) => e.endMs ?? e.startMs));
    const span = Math.max(max - min, 24 * 3600 * 1000);
    const x = (t: number) => PAD + (plotW * (t - min)) / span;
    const sorted = [...items].sort((a, b) => a.startMs - b.startMs || a.id.localeCompare(b.id));
    const lanes: [number, number][][] = [];
    const placed: Placed[] = sorted.map((e) => {
      const dot = e.category === "account";
      const x0 = x(e.startMs);
      const x1 = x(e.ongoing ? nowMs : e.endMs ?? e.startMs);
      const w = dot ? BAR_H : Math.max(x1 - x0, MIN_BAR);
      const labelW = e.title.length * CHAR_W;
      const inside = !dot && w >= labelW + 40;
      const labelLeft = !inside && x0 + w + 8 + labelW > width - 4;
      const ext: [number, number] = inside ? [x0, x0 + w] : labelLeft ? [x0 - 8 - labelW, x0 + w] : [x0, x0 + w + 8 + labelW];
      let lane = lanes.findIndex((row) => row.every(([a, b]) => ext[1] + GAP <= a || ext[0] >= b + GAP));
      if (lane === -1) { lane = lanes.length; lanes.push([]); }
      lanes[lane]!.push(ext);
      return { ...e, x0, w, lane, inside, labelLeft, labelW };
    });
    const day = 86400_000;
    const step = tickStepDays(span / day, plotW);
    const ticks: { x: number; ms: number }[] = [];
    for (let t = Math.ceil(min / (step * day)) * step * day; t <= max; t += step * day) ticks.push({ x: x(t), ms: t });
    return { placed, ticks, laneCount: Math.max(1, lanes.length), nowX: x(max), spanDays: span / day };
  }, [items, nowMs, width]);

  const fmt = useMemo(() => new Intl.DateTimeFormat(nl, layout.spanDays > 300 ? { month: "short", year: "numeric", timeZone: "UTC" } : { month: "short", day: "numeric", timeZone: "UTC" }), [nl, layout.spanDays]);
  const active = open ? layout.placed.find((e) => e.id === open.id) ?? null : null;

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
  const rowsH = layout.laneCount * ROW + 6;
  const axisY = rowsH + 6;
  const plotH = axisY + 30;
  const popW = 250;
  const pos = open && active ? (() => {
    const vw = window.innerWidth;
    const left = Math.min(Math.max(8, open.rect.left + open.rect.width / 2 - popW / 2), vw - popW - 8);
    return open.rect.top > 190 ? { left, bottom: window.innerHeight - open.rect.top + 8 } : { left, top: open.rect.bottom + 8 };
  })() : null;

  return (
    <div className={s.wrap} ref={box} aria-label={label}>
      <div className={s.plot} style={{ blockSize: plotH }}>
        {layout.placed.map((e) => <span key={`g-${e.id}`} className={s.guide} style={{ left: e.x0 + (e.category === "account" ? BAR_H / 2 : 0), top: e.lane * ROW + BAR_H, blockSize: axisY - (e.lane * ROW + BAR_H) }} aria-hidden="true" />)}
        <div className={s.axis} style={{ top: axisY }} />
        <span className={s.now} style={{ left: layout.nowX, top: axisY }} aria-hidden="true" />
        {layout.ticks.map((t) => <span key={t.ms} className={s.tick} style={{ left: t.x, top: axisY + 10 }}>{fmt.format(t.ms)}</span>)}
        {layout.placed.map((e) => (
          <div key={e.id} data-lane={e.lane}>
            <button
              type="button" className={s.bar} data-ongoing={e.ongoing} data-dot={e.category === "account"} aria-expanded={open?.id === e.id}
              style={{ left: e.x0, top: e.lane * ROW, inlineSize: e.w, ["--c" as string]: COLOR[e.category] }}
              onMouseEnter={(ev) => show(e.id, ev.currentTarget)} onMouseLeave={() => setOpen(null)}
              onFocus={(ev) => show(e.id, ev.currentTarget)} onBlur={() => setOpen(null)}
              onClick={(ev) => (open?.id === e.id ? setOpen(null) : show(e.id, ev.currentTarget))}
              aria-label={e.title}
            >
              <Icon name={ICON[e.category]} size={14} />
              {e.inside && <span dir="auto">{e.title}</span>}
            </button>
            {!e.inside && (
              <span className={s.out} dir="auto" style={e.labelLeft ? { left: e.x0 - 8 - e.labelW, inlineSize: e.labelW, justifyContent: "flex-end", top: e.lane * ROW } : { left: e.x0 + e.w + 8, top: e.lane * ROW }}>{e.title}</span>
            )}
          </div>
        ))}
      </div>
      {active && pos && (
        <div className={s.pop} role="tooltip" dir={rtl ? "rtl" : "ltr"} style={{ ...pos, inlineSize: popW, ["--c" as string]: COLOR[active.category] }}>
          <strong dir="auto"><Icon name={ICON[active.category]} size={15} /> {active.title}</strong>
          <dl>
            {active.lines.map((l) => <div key={l.label}><dt>{l.label}</dt><dd dir="auto">{l.value}</dd></div>)}
            {active.ongoing && <div><dt /><dd className={s.cur}>{ongoingLabel}</dd></div>}
          </dl>
        </div>
      )}
    </div>
  );
}
