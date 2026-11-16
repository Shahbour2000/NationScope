import Link from "next/link";
import type { Display } from "@/features/entities/display";
import { CountryBadge, Dt, PlayerChip } from "@/features/entities/entities";
import type { Messages } from "@/i18n/messages";
import type { ArticleDetail, NewspaperDetail } from "@/lib/domain/news-detail";
import type { Article } from "@/lib/domain/world";
import s from "../regions/region.module.css";

const idOk = (v: string) => /^[A-Za-z0-9_-]{1,80}$/.test(v);

export function ArticleView({ detail, d, m }: { detail: ArticleDetail; d: Display; m: Messages }) {
  const t = m.articlePage, nf = new Intl.NumberFormat(d.nl), a = detail.article;
  return (
    <>
      <div className={s.cardMeta} style={{ marginBlockEnd: "0.8rem" }}>
        {a.authorId && a.authorName && idOk(a.authorId) ? <><span>{t.by}</span><PlayerChip id={a.authorId} name={a.authorName} avatar={a.authorAvatarUrl ?? null} d={d} /></> : a.authorName ? <span>{t.by} {a.authorName}</span> : null}
        {a.newspaperId && idOk(a.newspaperId) ? <Link href={`/newspapers/${encodeURIComponent(a.newspaperId)}`} dir="auto">{a.newspaperName ?? t.openNewspaper}</Link> : null}
        {a.countryId ? <CountryBadge id={a.countryId} d={d} /> : null}
        {a.official ? <span className={s.badge} data-tone="ok">{t.official}</span> : null}
        {a.publishedAt ? <span className={s.dim}>{t.published} <Dt iso={a.publishedAt} d={d} /></span> : null}
      </div>
      <div className={s.kpis}>
        {a.views != null ? <div><b>{nf.format(a.views)}</b><span>{t.views}</span></div> : null}
        {a.score != null ? <div><b>{nf.format(a.score)}</b><span>{t.score}</span></div> : null}
        <div><b>{nf.format(a.commentCount ?? detail.comments.length)}</b><span>{t.comments}</span></div>
        {detail.extra.tipsTotal != null ? <div><b>{nf.format(detail.extra.tipsTotal)}</b><span>{t.tips}</span></div> : null}
      </div>
      <article className={`panel ${s.panel}`} dir="auto">
        {detail.hasBody ? detail.paragraphs.map((p, i) => <p key={i} style={{ whiteSpace: "pre-line" }}>{p}</p>) : <>{a.excerpt ? <p>{a.excerpt}</p> : null}<p className={s.note}>{t.noBody}</p></>}
      </article>
      {detail.hasBody ? <p className={s.dim}>{t.plainNote}</p> : null}
      <h2 className={s.sec}>{t.comments}</h2>
      {detail.comments.length === 0 ? <p className={s.empty}>{t.noComments}</p> : (
        <ul className={s.list}>
          {detail.comments.map((c, i) => (
            <li key={c.id ?? i}>
              {c.authorId && c.authorName ? <PlayerChip id={c.authorId} name={c.authorName} avatar={null} d={d} /> : c.authorName ? <b>{c.authorName}</b> : null}
              {c.createdAt ? <span className={s.dim}><Dt iso={c.createdAt} d={d} /></span> : null}
              {c.score != null ? <span className={s.dim}>{nf.format(c.score)}</span> : null}
              <p className={s.note} style={{ flexBasis: "100%", whiteSpace: "pre-line" }} dir="auto">{c.text}</p>
            </li>
          ))}
        </ul>
      )}
      {detail.commentsUnread > 0 ? <p className={s.dim}>{t.unreadComments.replace("{n}", nf.format(detail.commentsUnread))}</p> : null}
    </>
  );
}

function Row({ x, d, m }: { x: Article; d: Display; m: Messages }) {
  return (
    <li>
      <Link href={`/articles/${encodeURIComponent(x.id)}`} dir="auto"><b>{x.title}</b></Link>
      {x.publishedAt ? <span className={s.dim}><Dt iso={x.publishedAt} d={d} /></span> : null}
      {x.views != null ? <span className={s.dim}>{new Intl.NumberFormat(d.nl).format(x.views)} {m.articlesPage.views}</span> : null}
      {x.excerpt ? <p className={s.note} style={{ flexBasis: "100%" }} dir="auto">{x.excerpt}</p> : null}
    </li>
  );
}

export function NewspaperView({ paper, d, m }: { paper: NewspaperDetail; d: Display; m: Messages }) {
  const t = m.newspaperPage, nf = new Intl.NumberFormat(d.nl);
  return (
    <>
      {paper.description ? <p dir="auto">{paper.description}</p> : <p className={s.dim}>{t.noInfo}</p>}
      <div className={s.kpis}>
        {paper.ownerId && paper.ownerName ? <div><b><PlayerChip id={paper.ownerId} name={paper.ownerName} avatar={null} d={d} /></b><span>{t.owner}</span></div> : paper.ownerName ? <div><b>{paper.ownerName}</b><span>{t.owner}</span></div> : null}
        {paper.subscribers != null ? <div><b>{nf.format(paper.subscribers)}</b><span>{t.subscribers}</span></div> : null}
        {paper.articleCount != null ? <div><b>{nf.format(paper.articleCount)}</b><span>{t.articles}</span></div> : null}
      </div>
      <h2 className={s.sec}>{t.articles}</h2>
      {paper.articles.length === 0 ? <p className={s.empty}>{t.noArticles}</p> : <ul className={s.list}>{paper.articles.map((x) => <Row key={x.id} x={x} d={d} m={m} />)}</ul>}
      {paper.skipped > 0 ? <p className={s.dim}>{t.skipped.replace("{n}", nf.format(paper.skipped))}</p> : null}
      <p className={s.dim}>{t.listNote}</p>
    </>
  );
}
