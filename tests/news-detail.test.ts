import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Display } from "@/features/entities/display";
import { ArticleView, NewspaperView } from "@/features/news/NewsViews";
import { getMessages, numberLocale } from "@/i18n";
import { EMPTY_DIRECTORY } from "@/lib/domain/directory";
import { parseArticleDetail, parseNewspaper, plainText } from "@/lib/domain/news-detail";

const row = (JSON.parse(readFileSync("tests/fixtures/real/articles.json", "utf8")) as { items: Record<string, unknown>[] }).items[0]!; // real list row
const display = (locale: "en" | "ar"): Display => { const m = getMessages(locale); return { locale, nl: numberLocale(locale), mediaOrigin: "", dir: EMPTY_DIRECTORY, m: { t: m.t, items: m.items, time: m.time, ui: m.ui } }; };
const clean = (h: string) => { for (const bad of ["undefined", "NaN", "[object", "Infinity"]) expect(h).not.toContain(bad); };

describe("plainText", () => {
  it("never produces markup and keeps paragraph breaks", () => {
    expect(plainText("<p>Hello &amp; <b>world</b></p><p>Two<br>lines</p>")).toBe("Hello & world\n\nTwo\nlines");
    expect(plainText("<script>alert(1)</script>x")).not.toContain("<");
    expect(plainText("a\n\n\n\nb")).toBe("a\n\nb");
  });
});

describe("article detail (real list row; text and comments are SYNTHETIC)", () => {
  it("accepts the bare row: summary only, no body", () => {
    const a = parseArticleDetail(row)!; expect(a.hasBody).toBe(false); expect(a.article.title).toBe(row.title);
    for (const loc of ["en", "ar"] as const) {
      const html = renderToStaticMarkup(createElement(ArticleView, { detail: a, d: display(loc), m: getMessages(loc) })); clean(html);
      expect(html).toContain(getMessages(loc).articlePage.noBody); expect(html).toContain(getMessages(loc).articlePage.noComments);
      expect(html).toContain(`href="/newspapers/${row.newspaperId}"`); expect(html).toContain(`href="/players/${row.authorId}"`);
    }
  });
  it("reads text under common names and comments under common shapes", () => {
    const a = parseArticleDetail({ ...row, content: "<p>First</p><p>Second</p>", comments: [{ id: "c1", text: "Nice", authorName: "Zed", authorId: "usr_z", createdAt: "2026-10-18T00:00:00Z", score: 2 }, { junk: 1 }, { content: "<b>Bold</b>", user: { id: "usr_y", username: "Why" } }] })!;
    expect(a.paragraphs).toEqual(["First", "Second"]); expect(a.comments).toHaveLength(2); expect(a.commentsUnread).toBe(1); expect(a.comments[1]!.text).toBe("Bold");
    const html = renderToStaticMarkup(createElement(ArticleView, { detail: a, d: display("en"), m: getMessages("en") })); clean(html);
    expect(html).toContain("First"); expect(html).toContain('href="/players/usr_z"'); expect(html).toContain("1 comments could not be read"); expect(html).not.toContain("<b>Bold");
  });
  it("rejects bodies that are not articles", () => { expect(parseArticleDetail({ x: 1 })).toBeNull(); expect(parseArticleDetail(null)).toBeNull(); });
});

describe("newspaper detail (SYNTHETIC shape built from the real article row)", () => {
  it("reads name, owner, counts and a list of article rows", () => {
    const p = parseNewspaper({ id: "nws_1", name: "Paper", description: "About", owner: { id: "usr_o", username: "Owner" }, subscribers: 12, articles: [row, { bad: 1 }] })!;
    expect(p).toMatchObject({ id: "nws_1", name: "Paper", ownerId: "usr_o", ownerName: "Owner", subscribers: 12, articleCount: 2, skipped: 1 }); expect(p.articles).toHaveLength(1);
    for (const loc of ["en", "ar"] as const) {
      const html = renderToStaticMarkup(createElement(NewspaperView, { paper: p, d: display(loc), m: getMessages(loc) })); clean(html);
      expect(html).toContain(`href="/articles/${row.id}"`); expect(html).toContain('href="/players/usr_o"');
    }
  });
  it("copes with a minimal body and rejects others", () => {
    const p = parseNewspaper({ id: "n" })!; expect(p.articles).toEqual([]); expect(p.articleCount).toBeNull();
    expect(renderToStaticMarkup(createElement(NewspaperView, { paper: p, d: display("en"), m: getMessages("en") }))).toContain(getMessages("en").newspaperPage.noArticles);
    expect(parseNewspaper({ name: "x" })).toBeNull(); expect(parseNewspaper([])).toBeNull();
  });
});
