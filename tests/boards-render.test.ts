import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BattlesBoard } from "@/features/wars/BattlesBoard";
import { isBattleOngoing } from "@/features/wars/state";
import { WarsBoard } from "@/features/wars/WarsBoard";
import type { Display } from "@/features/entities/display";
import { getMessages, numberLocale } from "@/i18n";
import { EMPTY_DIRECTORY } from "@/lib/domain/directory";
import { battleSchema, warSchema } from "@/lib/domain/world";

const load = (f: string) => JSON.parse(readFileSync(`tests/fixtures/real/${f}`, "utf8")) as unknown[];
const wars = load("wars.json").map((r) => warSchema.parse(r));
const battles = load("battles.json").map((r) => battleSchema.parse(r));
const display = (locale: "en" | "ar"): Display => {
  const m = getMessages(locale);
  return { locale, nl: numberLocale(locale), mediaOrigin: "", dir: EMPTY_DIRECTORY, m: { t: m.t, items: m.items, time: m.time, ui: m.ui } };
};
// 2026-10-17T12:00Z: inside the recorded initiative windows of the two newest wars.
const NOW = Date.parse("2026-10-17T12:00:00Z");

describe.each(["en", "ar"] as const)("boards render (%s)", (loc) => {
  const m = getMessages(loc);
  it("wars: shows one card per active war and an initiative pill only for running windows", () => {
    const html = renderToStaticMarkup(createElement(WarsBoard, { rows: wars, d: display(loc), m: m.warsPage, nowMs: NOW }));
    const active = wars.filter((w) => w.status === "active" && !w.endedAt).length;
    expect(html.match(/class="wcard"/g)?.length ?? 0).toBe(Math.min(active, 24));
    const running = wars.filter((w) => w.priority?.until && Date.parse(w.priority.until) > NOW && w.status === "active").length;
    expect(html.match(/data-tone="initiative"/g)?.length ?? 0).toBe(running);
    expect(html).not.toContain("undefined");
  });
  it("battles: renders live cards with scores and a damage bar, no stray undefined", () => {
    const html = renderToStaticMarkup(createElement(BattlesBoard, { rows: battles, d: display(loc), m: m.battlesPage, nowMs: NOW }));
    expect(html.match(/class="bcard"/g)?.length).toBe(Math.min(battles.filter(isBattleOngoing).length, 18));
    expect(html).toContain("btug-bar");
    expect(html).not.toContain("undefined");
    expect(html).not.toContain("NaN");
  });
});
