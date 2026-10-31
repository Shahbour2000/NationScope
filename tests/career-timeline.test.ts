import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CareerTimeline, type CareerEvent } from "@/features/players/CareerTimeline";

const ev = (id: string, category: CareerEvent["category"], day: string, end: string | null = null): CareerEvent => ({
  id, category, title: id, startMs: Date.parse(day), endMs: end ? Date.parse(end) : null, ongoing: !end && category !== "account", lines: [{ label: "Start", value: day }],
});
const legend = { account: "Account", president: "President", vice: "VP", minister: "Minister", congress: "Congress", other: "Other" };
const render = (items: CareerEvent[]) => renderToStaticMarkup(createElement(CareerTimeline, { items, nowMs: Date.parse("2026-10-30T00:00:00Z"), nl: "en-US", rtl: false, label: "t", legend, ongoingLabel: "Current" }));

describe("CareerTimeline", () => {
  it("stacks events from the same day in different lanes so they never overlap", () => {
    const html = render([ev("a", "president", "2026-10-10T08:00:00Z"), ev("b", "congress", "2026-10-10T09:00:00Z"), ev("c", "minister", "2026-10-10T10:00:00Z"), ev("z", "account", "2026-09-01T00:00:00Z")]);
    expect(html.match(/class="ctl-ev"/g)).toHaveLength(4);
    const heights = new Set([...html.matchAll(/class="ctl-ev" style="[^"]*block-size:(\d+)px"/g)].map((m) => m[1]));
    expect(heights.size).toBeGreaterThanOrEqual(3);
  });
  it("uses a distinct marker per category and only lists categories that occur", () => {
    const html = render([ev("a", "president", "2026-10-01T00:00:00Z", "2026-10-05T00:00:00Z"), ev("b", "vice", "2026-10-06T00:00:00Z")]);
    expect(html).toContain("President");
    expect(html).toContain("VP");
    expect(html).not.toContain("Congress");
    expect(html).not.toContain("NaN");
  });
  it("handles a single event without dividing by zero", () => {
    expect(render([ev("only", "congress", "2026-10-10T00:00:00Z")])).not.toContain("NaN");
  });
});
