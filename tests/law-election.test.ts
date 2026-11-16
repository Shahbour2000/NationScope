import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Display } from "@/features/entities/display";
import { ElectionDetailView } from "@/features/politics/ElectionDetailView";
import { LawDetailView } from "@/features/politics/LawDetailView";
import { getMessages, numberLocale } from "@/i18n";
import { EMPTY_DIRECTORY } from "@/lib/domain/directory";
import { parseElectionDetail, readCandidates, voteSharePct } from "@/lib/domain/election-detail";
import { parseLawDetail, readBallots, readElectorate, scalarParams, voteSummary } from "@/lib/domain/law-detail";

const sample = (p: string): unknown => JSON.parse(readFileSync(`API/samples/${p}`, "utf8")); // real captures
const display = (locale: "en" | "ar"): Display => { const m = getMessages(locale); return { locale, nl: numberLocale(locale), mediaOrigin: "", dir: EMPTY_DIRECTORY, m: { t: m.t, items: m.items, time: m.time, ui: m.ui } }; };
const clean = (h: string) => { for (const bad of ["undefined", "NaN", "[object", "Infinity"]) expect(h).not.toContain(bad); };

describe("law proposal (real capture)", () => {
  const law = parseLawDetail(sample("politics/Law proposal details.txt"))!;
  it("parses the capture", () => {
    expect(law.id).toBe("law_xg5p3ivr8d68cd36"); expect(law.status).toBe("voting"); expect(law.passRule?.earlyAt).toBe(5);
    expect(readElectorate(law).rows).toHaveLength(9); expect(readElectorate(law).skipped).toBe(0); expect(readBallots(law).rows.length).toBe(5);
    expect(scalarParams(law.params)).toEqual([["scheme", "gray"]]);
  });
  it("rejects other bodies", () => { expect(parseLawDetail({ x: 1 })).toBeNull(); expect(parseLawDetail([])).toBeNull(); });
  it("calculates vote shares", () => {
    expect(voteSummary(law)).toMatchObject({ yes: 4, no: 1, cast: 5, electorate: 9, absent: 4 });
    expect(voteSummary(law).yesPct).toBe(80); expect(voteSummary(law).turnoutPct).toBeCloseTo(55.56, 1);
    expect(voteSummary({})).toMatchObject({ cast: 0, yesPct: null, turnoutPct: null, absent: null });
  });
  it.each(["en", "ar"] as const)("renders (%s)", (loc) => {
    const m = getMessages(loc);
    const html = renderToStaticMarkup(createElement(LawDetailView, { law, d: display(loc), m })); clean(html);
    expect(html).toContain(m.lawPage.status.voting); expect(html).toContain(m.lawPage.ruleEnd);
    expect(html).toContain(m.lawPage.ruleEarly.replace("{n}", "5")); expect(html).toContain('href="/players/usr_b3h3h9vkt3shvdda"'); expect(html).toContain('href="/countries/eg/laws"');
  });
  it("SYNTHETIC: a failed law with no ballots and no voter list", () => {
    const x = parseLawDetail({ id: "l", status: "failed", yes: 0, no: 0, failureReason: "not_enough_votes" })!;
    const html = renderToStaticMarkup(createElement(LawDetailView, { law: x, d: display("en"), m: getMessages("en") })); clean(html);
    expect(html).toContain("No votes have been cast yet."); expect(html).toContain("Not enough votes");
  });
});

describe("election (real captures)", () => {
  const pres = parseElectionDetail(sample("elections/Election details(_presidential_eg).txt"))!;
  const cong = parseElectionDetail(sample("elections/Election details(congress_eg).txt"))!;
  it("parses both captures and orders candidates winner-first", () => {
    const p = readCandidates(pres); expect(p.rows).toHaveLength(20); expect(p.skipped).toBe(0); expect(p.rows[0]!.elected).toBe(true);
    const c = readCandidates(cong); expect(c.rows.filter((r) => r.elected)).toHaveLength(10); expect(c.rows.slice(0, 10).every((r) => r.elected)).toBe(true);
  });
  it("computes the share of ballots, and hides it when the tally is hidden", () => {
    const top = readCandidates(pres).rows[0]!;
    expect(voteSharePct(top, pres)).toBe(Math.round((top.votes! / pres.ballotsCast!) * 1000) / 10);
    expect(voteSharePct(top, { ...pres, tallyHidden: true })).toBeNull(); expect(voteSharePct({ votes: null }, pres)).toBeNull();
  });
  it.each(["en", "ar"] as const)("renders both elections (%s)", (loc) => {
    const m = getMessages(loc);
    for (const e of [pres, cong]) {
      const html = renderToStaticMarkup(createElement(ElectionDetailView, { election: e, d: display(loc), m })); clean(html);
      expect(html).toContain(m.electionPage.elected); expect(html).toContain(m.electionPage.derived); expect(html).toContain(m.electionPage.tieBreakValue.earliestCandidacy);
    }
  });
  it("SYNTHETIC: hidden tally shows no counts; no candidates is explicit", () => {
    const m = getMessages("en");
    const hidden = parseElectionDetail({ ...(sample("elections/Election details(_presidential_eg).txt") as object), tallyHidden: true, status: "voting" })!;
    const h = renderToStaticMarkup(createElement(ElectionDetailView, { election: hidden, d: display("en"), m }));
    expect(h).toContain(m.electionPage.tallyHidden); expect(h).not.toMatch(/>\d[\d,]* votes/);
    expect(renderToStaticMarkup(createElement(ElectionDetailView, { election: parseElectionDetail({ id: "e", candidates: [] })!, d: display("en"), m }))).toContain(m.electionPage.noCandidates);
  });
});
