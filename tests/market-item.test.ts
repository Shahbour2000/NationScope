import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Display } from "@/features/entities/display";
import { AsReturned, HistoryView, OrderBookView, TradesView } from "@/features/market/MarketItemViews";
import { getMessages, numberLocale } from "@/i18n";
import { EMPTY_DIRECTORY } from "@/lib/domain/directory";
import { bookStats, cumulative, historyStats, isEmptyList, readHistory, readOrderBook, readTrades, tradeStats } from "@/lib/domain/market-item";

const trades = JSON.parse(readFileSync("tests/fixtures/real/market-trades.json", "utf8")) as { itemCode: string }[]; // real capture (global trades)
const display = (locale: "en" | "ar"): Display => { const m = getMessages(locale); return { locale, nl: numberLocale(locale), mediaOrigin: "", dir: EMPTY_DIRECTORY, m: { t: m.t, items: m.items, time: m.time, ui: m.ui } }; };
const clean = (h: string) => { for (const bad of ["undefined", "NaN", "[object", "Infinity"]) expect(h).not.toContain(bad); };

describe("item trades (real global-trade rows)", () => {
  const one = trades.filter((t) => t.itemCode === trades[0]!.itemCode);
  const r = readTrades({ trades: one });
  it("parses rows from a bare array or a wrapper, newest first", () => {
    expect(readTrades(one).rows).toHaveLength(one.length);
    expect(r.rows).toHaveLength(one.length); expect(r.shapeOk).toBe(true);
    const ts = r.rows.map((x) => Date.parse(x.createdAt ?? ""));
    expect([...ts].sort((a, b) => b - a)).toEqual(ts);
  });
  it("flags an unrecognised body instead of calling it empty", () => {
    expect(readTrades({ nope: 1 }).shapeOk).toBe(false); expect(readTrades(null).shapeOk).toBe(false);
    expect(readTrades([{ junk: 1 }, { junk: 2 }]).shapeOk).toBe(false);
    expect(readTrades([]).shapeOk).toBe(true);
  });
  it("computes exact stats with BigInt", () => {
    const st = tradeStats(readTrades([{ id: "a", itemCode: "x", price: "100", qty: 2, createdAt: "2026-01-02T00:00:00Z" }, { id: "b", itemCode: "x", price: "400", qty: 2, createdAt: "2026-01-01T00:00:00Z" }]).rows)!;
    expect(st).toMatchObject({ count: 2, volume: 4, last: 100n, high: 400n, low: 100n, vwap: 250n, value: 1000n });
    expect(tradeStats([])).toBeNull();
  });
  it.each(["en", "ar"] as const)("renders (%s)", (loc) => {
    const m = getMessages(loc);
    const html = renderToStaticMarkup(createElement(TradesView, { rows: r.rows, skipped: 0, d: display(loc), m }));
    clean(html);
    expect(html.match(/<li>/g)!.length).toBe(r.rows.length);
    expect(renderToStaticMarkup(createElement(TradesView, { rows: [], skipped: 0, d: display(loc), m }))).toContain(m.marketItem.noTrades);
  });
});

// SYNTHETIC: the per-item orders and history responses have never been captured; these cases test the readers' conventions only.
describe("order book (SYNTHETIC shapes)", () => {
  const raw = { buy: [{ price: "2500", qty: 10 }, { price: "2600", qty: 5 }], sell: [{ price: "3600", qty: 4 }, { price: "3490", qty: 7 }] };
  const b = readOrderBook(raw)!;
  it("sorts each side best-first and computes the spread", () => {
    expect(b.buys.map((x) => x.price)).toEqual([2600n, 2500n]); expect(b.sells.map((x) => x.price)).toEqual([3490n, 3600n]);
    expect(bookStats(b)).toMatchObject({ bestBid: 2600n, bestAsk: 3490n, spread: 890n, bidDepth: 15, askDepth: 11 });
    expect(bookStats(b).spreadPct).toBe(25.5);
    expect(cumulative(b.buys)).toEqual([5, 15]);
  });
  it("also reads bids/asks and a flat list with a side field", () => {
    expect(readOrderBook({ bids: [{ price: "1", quantity: 2 }], asks: [] })!.buys).toHaveLength(1);
    expect(readOrderBook([{ side: "buy", price: "5", qty: 1 }, { side: "sell", price: "9", qty: 2 }])).toMatchObject({ buys: [{ price: 5n }], sells: [{ price: 9n }] });
  });
  it("returns null when nothing is recognisable, and an empty book for empty sides", () => {
    expect(readOrderBook({ foo: [1] })).toBeNull(); expect(readOrderBook(null)).toBeNull(); expect(readOrderBook({ buy: [{ x: 1 }] })).toBeNull();
    expect(readOrderBook({ buy: [], sell: [] })).toMatchObject({ buys: [], sells: [] });
  });
  it("renders both languages, an empty book, and one-sided books", () => {
    for (const loc of ["en", "ar"] as const) {
      const m = getMessages(loc);
      const html = renderToStaticMarkup(createElement(OrderBookView, { book: b, d: display(loc), m })); clean(html);
      expect(html).toContain(m.marketItem.bookNote);
      expect(renderToStaticMarkup(createElement(OrderBookView, { book: { buys: [], sells: [], rawUnits: false }, d: display(loc), m }))).toContain(m.marketItem.bookEmpty);
    }
    const oneSide = renderToStaticMarkup(createElement(OrderBookView, { book: readOrderBook({ buy: [{ price: "10", qty: 1 }], sell: [] })!, d: display("en"), m: getMessages("en") })); clean(oneSide);
    expect(oneSide).toContain("No sell orders.");
  });
});

describe("price history (SYNTHETIC shapes)", () => {
  const raw = { points: [{ at: "2026-11-01T00:00:00Z", close: "2000", volume: 5 }, { at: "2026-11-02T00:00:00Z", close: "2500", volume: 7 }, { time: "bad", close: "1" }, { foo: 1 }] };
  it("reads points, ignores unreadable ones, sorts by time", () => {
    const h = readHistory(raw)!; expect(h.points).toHaveLength(2);
    expect(historyStats(h)).toMatchObject({ first: 2000n, last: 2500n, high: 2500n, low: 2000n, changePct: 25, volume: 12 });
    expect(readHistory([{ t: 1_700_000_000, price: "7" }])!.points[0]!.at).toBe(new Date(1_700_000_000_000).toISOString());
  });
  it("distinguishes unrecognised from empty", () => {
    expect(readHistory({ foo: 1 })).toBeNull(); expect(readHistory([{ foo: 1 }])).toBeNull();
    expect(isEmptyList([])).toBe(true); expect(isEmptyList({ points: [] })).toBe(true); expect(isEmptyList({ foo: 1 })).toBe(false);
  });
  it("renders the chart and falls back to the data as returned", () => {
    for (const loc of ["en", "ar"] as const) {
      const html = renderToStaticMarkup(createElement(HistoryView, { history: readHistory(raw)!, d: display(loc), m: getMessages(loc) })); clean(html);
      expect(html).toContain("<svg");
    }
    const html = renderToStaticMarkup(createElement(AsReturned, { data: { weird: "shape" }, d: display("en"), m: getMessages("en") }));
    expect(html).toContain(getMessages("en").marketItem.unrecognised); expect(html).toContain("shape");
  });
});
