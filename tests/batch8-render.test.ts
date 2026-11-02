import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Display } from "@/features/entities/display";
import { UnitsBoard } from "@/features/units/UnitsBoard";
import { getMessages, numberLocale } from "@/i18n";
import { EMPTY_DIRECTORY } from "@/lib/domain/directory";
import { parseUnits } from "@/lib/domain/units";

const display = (locale: "en" | "ar"): Display => {
  const m = getMessages(locale);
  return { locale, nl: numberLocale(locale), mediaOrigin: "", dir: EMPTY_DIRECTORY, m: { t: m.t, items: m.items, time: m.time, ui: m.ui } };
};
const raw = JSON.parse(readFileSync("tests/fixtures/real/units.json", "utf8")) as unknown;
const list = (Array.isArray(raw) ? raw : (raw as { units: unknown[] }).units);
const { units } = parseUnits(list, "https://example.test");

describe.each(["en", "ar"] as const)("UnitsBoard (%s)", (loc) => {
  it("renders linked cards, 24 at a time, without placeholder text", () => {
    const m = getMessages(loc);
    const html = renderToStaticMarkup(createElement(UnitsBoard, { rows: units, m: m.units, noneLabel: m.common.none, allLabel: m.common.all, numberLocale: numberLocale(loc), d: display(loc), moreLabel: "more" }));
    expect(html.match(/<article/g)?.length).toBe(Math.min(units.length, 24));
    expect(html).toContain(`href="/units/${units[0]!.id}"`);
    expect(html).not.toContain("undefined");
    expect(html).not.toContain("NaN");
  });
});
