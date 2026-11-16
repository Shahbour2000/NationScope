import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Display } from "@/features/entities/display";
import { MercenaryList } from "@/features/wars/MercenaryList";
import { getMessages, numberLocale } from "@/i18n";
import { readMercenaryEntry } from "@/lib/domain/contracts";
import { EMPTY_DIRECTORY } from "@/lib/domain/directory";

const display = (locale: "en" | "ar"): Display => { const m = getMessages(locale); return { locale, nl: numberLocale(locale), mediaOrigin: "", dir: EMPTY_DIRECTORY, m: { t: m.t, items: m.items, time: m.time, ui: m.ui } }; };
const clean = (h: string) => { for (const bad of ["undefined", "NaN", "[object", "Infinity"]) expect(h).not.toContain(bad); };

// SYNTHETIC: no auction or contract has ever been captured populated. These cases test the reader's conventions and the fallback only.
describe("mercenary entries", () => {
  it("recognises entries that use the documented auction vocabulary", () => {
    const e = readMercenaryEntry({ id: "auc_1", battleId: "btl_1", side: "attacker", status: "open", bestBid: { perK: "3500", bidder: { id: "usr_m", username: "Merc" } }, maxPerK: "50000", damageTarget: 100000, endsAt: "2026-11-12T10:00:00Z", bids: [1, 2] });
    expect(e).toMatchObject({ id: "auc_1", battleId: "btl_1", side: "attacker", perK: "3500", maxPerK: "50000", damageTarget: 100000, bidCount: 2, who: { id: "usr_m", name: "Merc" }, recognised: true });
  });
  it("does not recognise entries it cannot read, and never invents fields", () => {
    expect(readMercenaryEntry({ foo: 1 })).toMatchObject({ id: null, recognised: false });
    expect(readMercenaryEntry({ id: "x" }).recognised).toBe(false); expect(readMercenaryEntry(null).recognised).toBe(false);
    expect(readMercenaryEntry({ id: "x", perK: 12 }).perK).toBeNull(); // money must be a digit string
    expect(readMercenaryEntry({ id: "x", endsAt: "nonsense", side: "attacker" }).endsAt).toBeNull();
  });
  it.each(["en", "ar"] as const)("renders recognised cards and keeps unrecognised entries under Details (%s)", (loc) => {
    const m = getMessages(loc);
    const html = renderToStaticMarkup(createElement(MercenaryList, { title: m.mercenary.auctions, items: [{ id: "a", side: "defender", perK: "1000" }, { weird: "shape" }], d: display(loc), m })); clean(html);
    expect(html).toContain(m.mercenary.note); expect(html).toContain(m.mercenary.price); expect(html.match(/<details/g)!.length).toBeGreaterThanOrEqual(2); expect(html).toContain("shape");
    expect(renderToStaticMarkup(createElement(MercenaryList, { title: "x", items: [], d: display(loc), m }))).toBe("");
  });
});
