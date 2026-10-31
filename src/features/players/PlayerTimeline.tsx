"use client";

import { useState } from "react";
import { Icon, type IconName } from "@/components/Icon";

export interface TimelineItem {
  id: string;
  kind: "account" | "political";
  title: string;
  /** Pre-formatted date text (server side, locale aware). */
  when: string;
  lines: { label: string; value: string }[];
}

const ICON: Record<TimelineItem["kind"], IconName> = { account: "user", political: "landmark" };

/** Vertical chronological timeline. Each event opens a small popover on hover, keyboard focus or tap. */
export function PlayerTimeline({ items, label }: { items: TimelineItem[]; label: string }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <ol className="ptl" aria-label={label} onMouseLeave={() => setOpen(null)}>
      {items.map((e) => {
        const isOpen = open === e.id;
        return (
          <li key={e.id} className="ptl-item" data-kind={e.kind} data-open={isOpen}>
            <button
              type="button"
              className="ptl-dot"
              aria-expanded={isOpen}
              aria-controls={`ptl-${e.id}`}
              onClick={() => setOpen(isOpen ? null : e.id)}
              onMouseEnter={() => setOpen(e.id)}
              onFocus={() => setOpen(e.id)}
              onBlur={() => setOpen((cur) => (cur === e.id ? null : cur))}
            >
              <Icon name={ICON[e.kind]} size={14} />
              <span className="sr-only">{e.title}</span>
            </button>
            <div className="ptl-body">
              <b dir="auto">{e.title}</b>
              <small>{e.when}</small>
            </div>
            <div id={`ptl-${e.id}`} role="tooltip" className="ptl-pop" hidden={!isOpen}>
              <strong dir="auto">{e.title}</strong>
              <dl>
                <div><dd>{e.when}</dd></div>
                {e.lines.map((l) => <div key={l.label}><dt>{l.label}</dt><dd dir="auto">{l.value}</dd></div>)}
              </dl>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
