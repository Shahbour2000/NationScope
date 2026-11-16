import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Display } from "@/features/entities/display";
import { CompanyProfile } from "@/features/companies/CompanyProfile";
import { getMessages, numberLocale } from "@/i18n";
import { parseCompanyDetail, msUntilFull, readOffer, readUpgrades, readWorkers, storageFill } from "@/lib/domain/company-detail";
import { EMPTY_DIRECTORY } from "@/lib/domain/directory";

const sample = JSON.parse(readFileSync("API/samples/companies/Company details.txt", "utf8")) as Record<string, unknown>; // real capture
const display = (locale: "en" | "ar"): Display => { const m = getMessages(locale); return { locale, nl: numberLocale(locale), mediaOrigin: "", dir: EMPTY_DIRECTORY, m: { t: m.t, items: m.items, time: m.time, ui: m.ui } }; };
const clean = (h: string) => { for (const bad of ["undefined", "NaN", "[object"]) expect(h).not.toContain(bad); };
const NOW = Date.parse("2026-10-20T00:00:00Z");

describe("company detail (real capture)", () => {
  const c = parseCompanyDetail(sample)!;
  it("parses the captured company", () => {
    expect(c.id).toBe("cmp_n9d864hmr8wfqypq"); expect(c.itemCode).toBe("concrete"); expect(c.owner?.username).toBe("AbuDujana");
    expect(c.production?.needs).toEqual({ limestone: 8 }); expect(c.bonuses).toHaveLength(2); expect(c.bonusTotal).toBe(18);
  });
  it("rejects bodies that are not a company", () => { expect(parseCompanyDetail({ error: "x" })).toBeNull(); expect(parseCompanyDetail([])).toBeNull(); expect(parseCompanyDetail({ id: "a", name: "n" })).toBeNull(); });
  it("computes fill (BigInt) and time to full", () => {
    expect(storageFill(c.production)).toBe(4.8); // 195537 / 4000000
    expect(storageFill({ points: "1", capacity: "0" })).toBeNull(); expect(storageFill(null)).toBeNull();
    expect(msUntilFull(c.production, NOW)).toBe(Date.parse("2026-10-26T16:23:21.276Z") - NOW);
    expect(msUntilFull({ ...c.production, full: true }, NOW)).toBeNull();
    expect(msUntilFull(c.production, Date.parse("2026-12-01T00:00:00Z"))).toBeNull(); // already in the past: unknown, not negative
  });
  it("reads upgrades, workers and offers without guessing", () => {
    const u = readUpgrades([...(sample.upgrades as unknown[]), "x", { level: 2 }]);
    expect(u.rows.map((x) => x.code)).toEqual(["storage", "automatedEngine"]); expect(u.skipped).toBe(2);
    expect(readWorkers([])).toEqual({ rows: [], unreadable: 0 });
    expect(readWorkers([{ id: "usr_1", username: "A" }, { user: { id: "usr_2", username: "B" } }, { foo: 1 }])).toEqual({ rows: [{ id: "usr_1", username: "A", avatarUrl: null }, { id: "usr_2", username: "B", avatarUrl: null }], unreadable: 1 });
    expect(readOffer(null)).toEqual({ open: false, slots: null, minLevel: null });
    expect(readOffer({ slots: 3, minLevel: 5 })).toEqual({ open: true, slots: 3, minLevel: 5 });
    expect(readOffer({})).toEqual({ open: true, slots: null, minLevel: null });
  });
  it.each(["en", "ar"] as const)("renders the profile (%s)", (loc) => {
    const m = getMessages(loc);
    const html = renderToStaticMarkup(createElement(CompanyProfile, { company: c, d: display(loc), m, nowMs: NOW }));
    clean(html);
    expect(html).toContain(new Intl.NumberFormat(numberLocale(loc)).format(195537)); // locale-formatted points
    expect(html).toContain(m.companyPage.upgradeName.automatedEngine);
    expect(html).toContain(m.companyPage.bonusSource.destiny);
    expect(html).toContain(m.companyPage.notHiring);
    expect(html).toContain(m.companyPage.noWorkers);
    expect(html).toContain('href="/market/limestone"'); // ingredient links to its market
    expect(html).toContain('aria-label="2/7"');
  });
  it("SYNTHETIC: hiring company with workers, a full store and an unknown bonus source", () => {
    const x = parseCompanyDetail({ ...sample, production: { ...(sample.production as object), full: true }, bonuses: [{ source: "regional.deposit", percent: 12 }], offer: { slots: 2, minLevel: 4 }, workers: [{ id: "usr_9", username: "Zed" }, { nope: 1 }] })!;
    const m = getMessages("en");
    const html = renderToStaticMarkup(createElement(CompanyProfile, { company: x, d: display("en"), m, nowMs: NOW }));
    clean(html);
    expect(html).toContain(m.companyPage.full); expect(html).toContain("Regional deposit"); expect(html).toContain(m.companyPage.hiring);
    expect(html).toContain('href="/players/usr_9"'); expect(html).toContain("1 worker entries");
  });
});
