import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CareerTimeline, type CareerEvent } from "@/features/players/CareerTimeline";

const ev = (id: string, category: CareerEvent["category"], day: string, end: string | null = null): CareerEvent => ({
  id, category, title: `T-${id}`, startMs: Date.parse(day), endMs: end ? Date.parse(end) : null, ongoing: !end && category !== "account", lines: [{ label: "Start", value: day }],
});
const render = (items: CareerEvent[]) => renderToStaticMarkup(createElement(CareerTimeline, { items, nowMs: Date.parse("2026-10-30T00:00:00Z"), nl: "en-US", rtl: false, label: "t", ongoingLabel: "Current" }));
const lanes = (html: string) => [...html.matchAll(/data-lane="(\d+)"/g)].map((m) => Number(m[1]));

describe("CareerTimeline", () => {
  it("puts same-day events on different rows so they never overlap", () => {
    const html = render([ev("a", "president", "2026-10-10T08:00:00Z"), ev("b", "congress", "2026-10-10T09:00:00Z"), ev("c", "minister", "2026-10-10T10:00:00Z"), ev("z", "account", "2026-09-01T00:00:00Z")]);
    expect(lanes(html)).toHaveLength(4);
    // the three same-day offices (sorted after the account event) each get their own row
    const sameDay = lanes(html).slice(1);
    expect(new Set(sameDay).size).toBe(3);
  });
  it("reuses a row when events do not collide in time", () => {
    const html = render([ev("a", "president", "2026-09-01T00:00:00Z", "2026-09-03T00:00:00Z"), ev("b", "vice", "2026-10-25T00:00:00Z", "2026-10-26T00:00:00Z")]);
    expect(Math.max(...lanes(html))).toBe(0);
  });
  it("renders every event as an accessible button and never produces NaN", () => {
    const html = render([ev("only", "congress", "2026-10-10T00:00:00Z")]);
    expect(html).toContain('aria-label="T-only"');
    expect(html).not.toContain("NaN");
  });
});
