import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Provenance } from "@/components/Provenance";
import { CountriesBoard } from "@/features/countries/CountriesBoard";
import type { Display } from "@/features/entities/display";
import { Source } from "@/features/entities/entities";
import { getMessages, numberLocale } from "@/i18n";
import { EMPTY_DIRECTORY } from "@/lib/domain/directory";
import { countrySchema } from "@/lib/domain/world";

const display = (locale: "en" | "ar"): Display => {
  const m = getMessages(locale);
  return { locale, nl: numberLocale(locale), mediaOrigin: "", dir: EMPTY_DIRECTORY, m: { t: m.t, items: m.items, time: m.time, ui: m.ui } };
};
const countries = (JSON.parse(readFileSync("tests/fixtures/real/countries.json", "utf8")) as { countries: unknown[] }).countries.map((c) => countrySchema.parse(c));

describe("provenance clutter is gone", () => {
  it("Source renders nothing", () => {
    expect(renderToStaticMarkup(createElement(Source, { kind: "calc", d: display("en") }))).toBe("");
  });
  it("Provenance shows no API host or source label", () => {
    const meta = { host: "app.example.test", source: "live", fetchedAt: "2026-10-31T12:34:56.000Z", ageMs: 0 } as never;
    const html = renderToStaticMarkup(createElement(Provenance, { meta, m: getMessages("en") }));
    expect(html).not.toContain("app.example.test");
    expect(html).not.toContain("Live from the API");
    expect(html).toContain("12:34");
  });
  it("Provenance still warns when data is stale", () => {
    const meta = { host: "h", source: "stale", fetchedAt: "2026-10-31T12:34:56.000Z", ageMs: 180000, staleReason: "network" } as never;
    const html = renderToStaticMarkup(createElement(Provenance, { meta, m: getMessages("en") }));
    expect(html).toContain("3 min");
    expect(html).not.toContain("network");
  });
});

describe.each(["en", "ar"] as const)("CountriesBoard (%s)", (loc) => {
  it("renders one linked card per country, ranked by development", () => {
    const html = renderToStaticMarkup(createElement(CountriesBoard, { rows: countries, d: display(loc), m: getMessages(loc).countriesPage }));
    expect(html.match(/<article/g)).toHaveLength(countries.length);
    expect(html).toContain(`href="/countries/${countries[0]!.id}"`);
    expect(html).not.toContain("undefined");
    expect(html).not.toContain("NaN");
  });
});
