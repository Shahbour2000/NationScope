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
const ROW = 34, CHIP_H = 28, PAD = 22, CHAR_W = 8.9, GAP = 8, LABEL_PAD = 14;
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

interface Placed extends CareerEvent { x0: number; slot: number; above: boolean; level: number; chipW: number; flip: boolean }

export function CareerTimeline({ items, nowMs, nl, rtl, label, ongoingLabel, todayLabel }: {
  items: CareerEvent[]; nowMs: number; nl: string; rtl: boolean; label: string; ongoingLabel: string; todayLabel: string;
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
    const span = Math.max(nowMs - min, 24 * 3600 * 1000);
    const x = (t: number) => PAD + (plotW * (t - min)) / span;
    const sorted = [...items].sort((a, b) => a.startMs - b.startMs || a.id.localeCompare(b.id));
    // Slots alternate above / below the axis (0 = first above, 1 = first below, 2 = second above ...), so any number of
    // events stays around ONE axis. An event takes the first slot whose existing chips it does not collide with.
    const slots: [number, number][][] = [];
    const chips: { above: boolean; level: number; ext: [number, number]; stem: number }[] = [];
    const placed: Placed[] = sorted.map((e) => {
      const x0 = x(e.startMs);
      const chipW = CHIP_H + 8 + e.title.length * CHAR_W + 6;
      const flip = x0 - LABEL_PAD + chipW > width - 4;
      const ext: [number, number] = flip ? [x0 + LABEL_PAD - chipW, x0 + LABEL_PAD] : [x0 - LABEL_PAD, x0 - LABEL_PAD + chipW];
      // First slot where the chip neither overlaps a chip in its row nor lets a stem cut through a chip (its own stem
      // through nearer chips, or an earlier stem through this chip).
      const rowFree = (slot: number) => (slots[slot] ?? []).every(([a, b]) => ext[1] + GAP <= a || ext[0] >= b + GAP);
      const stemsClear = (slot: number) => {
        const above = slot % 2 === 0, level = Math.floor(slot / 2);
        return chips.every((c) => {
          if (c.above !== above || Math.abs(c.stem - x0) < 2) return true; // same date: chips stack on one shared stem
          if (c.level < level) return x0 < c.ext[0] - 3 || x0 > c.ext[1] + 3;
          if (c.level > level) return c.stem < ext[0] - 3 || c.stem > ext[1] + 3;
          return true;
        });
      };
      // Prefer a spot where no stem crosses another chip; in dense clusters that may not exist within a few rows, so fall
      // back to the first free spot (stems then run behind the chips, as in a shared-stem stack).
      let slot = 0;
      while (slot < 8 && !(rowFree(slot) && stemsClear(slot))) slot++;
      if (slot >= 8) { slot = 0; while (!rowFree(slot)) slot++; }
      (slots[slot] ??= []).push(ext);
      chips.push({ above: slot % 2 === 0, level: Math.floor(slot / 2), ext, stem: x0 });
      return { ...e, x0, slot, above: slot % 2 === 0, level: Math.floor(slot / 2), chipW, flip };
    });
    const aboveLevels = Math.max(0, ...placed.filter((e) => e.above).map((e) => e.level + 1));
    const belowLevels = Math.max(0, ...placed.filter((e) => !e.above).map((e) => e.level + 1));
    return { placed, aboveLevels, belowLevels, startX: x(min), endX: x(nowMs), min };
  }, [items, nowMs, width]);

  const fmt = useMemo(() => new Intl.DateTimeFormat(nl, { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }), [nl]);
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
  const top = layout.aboveLevels * ROW + 10;
  const plotH = top + layout.belowLevels * ROW + 44;
  const popW = 250;
  const pos = open && active ? (() => {
    const vw = window.innerWidth;
    const left = Math.min(Math.max(8, open.rect.left + open.rect.width / 2 - popW / 2), vw - popW - 8);
    return open.rect.top > 190 ? { left, bottom: window.innerHeight - open.rect.top + 8 } : { left, top: open.rect.bottom + 8 };
  })() : null;

  return (
    <div className={s.wrap} ref={box} aria-label={label}>
      <div className={s.plot} style={{ blockSize: plotH }}>
        <div className={s.axis} style={{ top }} />
        <span className={s.end} style={{ left: layout.startX, top }} aria-hidden="true" />
        <span className={s.end} style={{ left: layout.endX, top }} aria-hidden="true" />
        <span className={s.edge} data-end="start" style={{ left: layout.startX, top: plotH - 20 }}>{fmt.format(layout.min)}</span>
        <span className={s.edge} data-end="end" style={{ left: layout.endX, top: plotH - 20 }}>{todayLabel}</span>
        <span className={s.edgeLine} style={{ left: layout.startX, top, blockSize: plotH - 20 - top }} aria-hidden="true" />
        <span className={s.edgeLine} style={{ left: layout.endX, top, blockSize: plotH - 20 - top }} aria-hidden="true" />
        {layout.placed.map((e) => {
          const y = e.above ? top - (e.level + 1) * ROW + (ROW - CHIP_H) / 2 : top + e.level * ROW + (ROW - CHIP_H) / 2 + 8;
          const stemTop = e.above ? y + CHIP_H / 2 : top;
          const stemH = e.above ? top - stemTop : y + CHIP_H / 2 - top;
          return (
            <div key={e.id} data-slot={e.slot} data-above={e.above}>
              <span className={s.stem} style={{ left: e.x0, top: stemTop, blockSize: stemH, ["--c" as string]: COLOR[e.category] }} aria-hidden="true" />
              <button
                type="button" className={s.chip} data-flip={e.flip} data-ongoing={e.ongoing} aria-expanded={open?.id === e.id}
                style={{ left: e.flip ? e.x0 + LABEL_PAD - e.chipW : e.x0 - LABEL_PAD, top: y, inlineSize: e.chipW, ["--c" as string]: COLOR[e.category] }}
                onMouseEnter={(ev) => show(e.id, ev.currentTarget)} onMouseLeave={() => setOpen(null)}
                onFocus={(ev) => show(e.id, ev.currentTarget)} onBlur={() => setOpen(null)}
                onClick={(ev) => (open?.id === e.id ? setOpen(null) : show(e.id, ev.currentTarget))}
                aria-label={e.title}
              >
                <i className={s.icon}><Icon name={ICON[e.category]} size={14} /></i>
                <span dir="auto">{e.title}</span>
              </button>
            </div>
          );
        })}
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
