import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CareerTimeline, type CareerEvent } from "@/features/players/CareerTimeline";

const ev = (id: string, category: CareerEvent["category"], day: string, end: string | null = null): CareerEvent => ({
  id, category, title: `T-${id}`, startMs: Date.parse(day), endMs: end ? Date.parse(end) : null, ongoing: !end && category !== "account", lines: [{ label: "Start", value: day }],
});
const render = (items: CareerEvent[]) => renderToStaticMarkup(createElement(CareerTimeline, { items, nowMs: Date.parse("2026-10-30T00:00:00Z"), nl: "en-US", rtl: false, label: "t", ongoingLabel: "Current", todayLabel: "Today" }));
const lanes = (html: string) => [...html.matchAll(/data-slot="(\d+)"/g)].map((m) => Number(m[1]));

describe("CareerTimeline", () => {
  it("puts same-day events on different rows so they never overlap", () => {
    const html = render([ev("a", "president", "2026-10-10T08:00:00Z"), ev("b", "congress", "2026-10-10T09:00:00Z"), ev("c", "minister", "2026-10-10T10:00:00Z"), ev("z", "account", "2026-09-01T00:00:00Z")]);
    expect(lanes(html)).toHaveLength(4);
    // the three same-day offices (sorted after the account event) each get their own row
    const sameDay = lanes(html).slice(1);
    expect(new Set(sameDay).size).toBe(3);
  });
  it("reuses the first slot when events are far apart and alternates above/below on collisions", () => {
    const far = render([ev("a", "president", "2026-09-01T00:00:00Z", "2026-09-03T00:00:00Z"), ev("b", "vice", "2026-10-25T00:00:00Z", "2026-10-26T00:00:00Z")]);
    expect(Math.max(...lanes(far))).toBe(0);
    const same = render([ev("a", "president", "2026-10-10T00:00:00Z"), ev("b", "vice", "2026-10-10T00:00:00Z"), ev("c", "minister", "2026-10-10T00:00:00Z")]);
    expect(same.match(/data-above="true"/g)?.length).toBe(2);
    expect(same.match(/data-above="false"/g)?.length).toBe(1);
  });
  it("does not draw duration bars: no element width depends on how long a term lasted", () => {
    const short = render([ev("a", "president", "2026-10-01T00:00:00Z", "2026-10-02T00:00:00Z"), ev("z", "account", "2026-09-01T00:00:00Z")]);
    const long = render([ev("a", "president", "2026-10-01T00:00:00Z", "2026-10-29T00:00:00Z"), ev("z", "account", "2026-09-01T00:00:00Z")]);
    expect(short).toBe(long.replace(/Oct 29/g, "Oct 2"));
  });
  it("renders every event as an accessible button and never produces NaN", () => {
    const html = render([ev("only", "congress", "2026-10-10T00:00:00Z")]);
    expect(html).toContain('aria-label="T-only"');
    expect(html).not.toContain("NaN");
  });
});

describe("CareerTimeline density", () => {
  it("keeps 60 events on one axis with a bounded number of rows, and terminates", () => {
    const items = Array.from({ length: 60 }, (_, i) => ev(`e${i}`, (["president", "vice", "minister", "congress"] as const)[i % 4]!, new Date(Date.parse("2026-10-01T00:00:00Z") + (i % 12) * 86400_000).toISOString(), null));
    const html = render(items);
    expect(html.match(/<button/g)).toHaveLength(60);
    expect(html.match(/class="[^"]*axis[^"]*"/g)).toHaveLength(1);
    expect(Math.max(...lanes(html))).toBeLessThan(60);
  });
});
