import { articleSchema, type Article } from "./world";
import { asRecord, parseRows } from "./parse";

/**
 * GET /articles/{id} and /newspapers/{id}. Neither detail response has ever been captured; the article LIST row shape is real
 * (tests/fixtures/real/articles.json). The detail is read as that same row plus whatever text/comments fields are present under common
 * names. The article text format (plain, HTML or markup) is unknown, so it is shown as plain text and the page says so.
 */
const TEXT_KEYS = ["content", "body", "text", "html", "markdown"] as const;
const ID = /^[A-Za-z0-9_-]{1,80}$/;

/** Plain-text view of a text field that may contain simple HTML. Never produces markup. */
export function plainText(s: string): string {
  return s
    .replace(/<\s*br\s*\/?>/gi, "\n").replace(/<\/\s*(p|div|h[1-6]|li|blockquote)\s*>/gi, "\n\n").replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n").trim();
}

export interface ArticleComment { id: string | null; text: string; authorName: string | null; authorId: string | null; createdAt: string | null; score: number | null }
export interface ArticleDetail { article: Article; paragraphs: string[]; hasBody: boolean; comments: ArticleComment[]; commentsUnread: number; extra: { visibility: string | null; tipsTotal: number | null } }

export function parseArticleDetail(raw: unknown): ArticleDetail | null {
  const base = articleSchema.safeParse(raw);
  if (!base.success) return null;
  const o = asRecord(raw);
  const key = TEXT_KEYS.find((k) => typeof o[k] === "string" && (o[k] as string).trim().length > 0);
  const paragraphs = key ? plainText(o[key] as string).split(/\n{2,}/).map((p) => p.trim()).filter(Boolean) : [];
  const comments: ArticleComment[] = []; let commentsUnread = 0;
  for (const c of Array.isArray(o.comments) ? o.comments : []) {
    const r = asRecord(c), user = asRecord(r.author ?? r.user);
    const text = [r.text, r.content, r.body].find((v) => typeof v === "string" && v.trim()) as string | undefined;
    if (!text) { commentsUnread++; continue; }
    const name = [r.authorName, r.username, user.username, user.name].find((v) => typeof v === "string") as string | undefined;
    const id = [r.authorId, r.userId, user.id].find((v) => typeof v === "string" && ID.test(v as string)) as string | undefined;
    comments.push({ id: typeof r.id === "string" ? r.id : null, text: plainText(text), authorName: name ?? null, authorId: id ?? null, createdAt: typeof r.createdAt === "string" ? r.createdAt : null, score: typeof r.score === "number" ? r.score : null });
  }
  return { article: base.data, paragraphs, hasBody: paragraphs.length > 0, comments, commentsUnread, extra: { visibility: typeof o.visibility === "string" ? o.visibility : null, tipsTotal: typeof o.tipsTotal === "number" ? o.tipsTotal : typeof o.tipsTotal === "string" && /^\d+$/.test(o.tipsTotal) ? Number(o.tipsTotal) : null } };
}

export interface NewspaperDetail { id: string; name: string | null; description: string | null; ownerId: string | null; ownerName: string | null; subscribers: number | null; articleCount: number | null; articles: Article[]; skipped: number }
export function parseNewspaper(raw: unknown): NewspaperDetail | null {
  const o = asRecord(raw);
  if (typeof o.id !== "string" || !o.id) return null;
  const owner = asRecord(o.owner ?? o.author);
  const str = (...vs: unknown[]) => (vs.find((v) => typeof v === "string" && v.trim()) as string | undefined) ?? null;
  const num = (...vs: unknown[]) => (vs.find((v) => typeof v === "number" && Number.isFinite(v)) as number | undefined) ?? null;
  const list = [o.articles, o.items, o.recentArticles].find(Array.isArray);
  const parsed = parseRows(list, articleSchema);
  const ownerId = str(o.ownerId, o.authorId, owner.id);
  return {
    id: o.id, name: str(o.name, o.title), description: str(o.description, o.about), ownerId: ownerId && ID.test(ownerId) ? ownerId : null, ownerName: str(o.ownerName, o.authorName, owner.username, owner.name),
    subscribers: num(o.subscribers, o.subscriberCount, o.subscribersCount), articleCount: num(o.articleCount, o.articlesCount) ?? (Array.isArray(list) ? list.length : null), articles: parsed.rows, skipped: parsed.skipped,
  };
}
