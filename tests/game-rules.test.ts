import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Display } from "@/features/entities/display";
import { GameRulesView } from "@/features/game/GameRulesView";
import { boardLabel } from "@/features/rankings/boardLabels";
import { getMessages, numberLocale } from "@/i18n";
import { EMPTY_DIRECTORY } from "@/lib/domain/directory";
import { parseGameRules } from "@/lib/domain/game-rules";

const raw = JSON.parse(readFileSync("API/samples/game/Game information.txt", "utf8")) as { leaderboards: { id: string; label: string }[] }; // real capture
const display = (locale: "en" | "ar"): Display => { const m = getMessages(locale); return { locale, nl: numberLocale(locale), mediaOrigin: "", dir: EMPTY_DIRECTORY, m: { t: m.t, items: m.items, time: m.time, ui: m.ui } }; };
const clean = (h: string) => { for (const bad of ["undefined", "NaN", "[object", "Infinity"]) expect(h).not.toContain(bad); };

describe("game rules (real capture)", () => {
  const g = parseGameRules(raw)!;
  it("parses every rule table", () => {
    expect(g.rulesetVersion).toBe("warmap-1");
    expect(g.battle.find((r) => r.key === "pointsToWinRound")!.value).toBe(250);
    expect(g.tickPoints).toEqual([{ from: 1, points: 1 }, { from: 80, points: 2 }, { from: 160, points: 3 }, { from: 240, points: 4 }, { from: 320, points: 5 }, { from: 400, points: 6 }]);
    expect(g.auction.find((r) => r.key === "maxDuration")!.value).toBe(25); expect(g.reputation.length).toBeGreaterThan(5);
    expect(g.boards).toHaveLength(16); expect(g.boardsSkipped).toBe(0); expect(g.historyTypes).toContain("ownership");
    expect(g.contract.some((r) => r.key === "auction")).toBe(false); // nested objects are separate tables, not flattened into rows
  });
  it("rejects bodies without any rule table", () => { expect(parseGameRules({ serverTime: "x" })).toBeNull(); expect(parseGameRules(null)).toBeNull(); });
  it.each(["en", "ar"] as const)("renders every board and rule with a label (%s)", (loc) => {
    const m = getMessages(loc);
    const html = renderToStaticMarkup(createElement(GameRulesView, { rules: g, d: display(loc), m })); clean(html);
    expect(html.match(/href="\/rankings\/[A-Za-z]+"/g)).toHaveLength(16);
    expect(html.match(/href="\/rankings\/[A-Za-z]+\/archive"/g)).toHaveLength(5); // only boards the API marks `archived`
    expect(html).toContain(m.gamePage.label.pointsToWinRound); expect(html).toContain(m.gamePage.label.maxPerK); expect(html).toContain(m.gamePage.tickNote);
    // every key present in the capture has a translated label (no humanized fallback leaking into the UI)
    const keys = [...g.battle, ...g.contract, ...g.auction, ...g.reputation].map((r) => r.key);
    for (const k of keys) expect(Object.keys(m.gamePage.label), k).toContain(k);
  });
  it("names all 16 boards in Arabic and keeps the API label for unknown ones", () => {
    for (const b of raw.leaderboards) { expect(boardLabel(b.id, b.label, "ar")).not.toBe(b.label); expect(boardLabel(b.id, b.label, "en")).toBe(b.label); }
    expect(boardLabel("newBoard", "New board", "ar")).toBe("New board"); expect(boardLabel("newBoard", null, "en")).toBe("newBoard");
  });
});
