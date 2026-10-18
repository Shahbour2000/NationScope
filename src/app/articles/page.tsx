import Link from "next/link";
import { ApiErrorState } from "@/components/ApiErrorState";
import { Icon } from "@/components/Icon";
import { Provenance } from "@/components/Provenance";
import { Avatar, CountryBadge, Dt } from "@/features/entities/entities";
import { getDisplay } from "@/features/entities/display.server";
import { getLocale, getMessages } from "@/i18n";
import { getArticles } from "@/lib/data/world";

export const dynamic = "force-dynamic";

export default async function ArticlesPage() {
  const m = getMessages(await getLocale());
  const a = m.articlesPage;
  let res;
  try { res = await getArticles(); } catch (e) { return <ApiErrorState error={e} retryLabel={m.common.retry} />; }
  const d = await getDisplay();
  const nf = new Intl.NumberFormat(d.nl);
  return (
    <>
      <div className="page-head"><h1><Icon name="news" size={26} />{a.title}</h1></div>
      <p className="note">{a.intro}</p>
      {res.rows.length === 0 ? <p className="empty-mini">{a.noArticles}</p> : (
        <div className="card-grid">
          {res.rows.map((x) => (
            <article key={x.id} className="card">
              <h2 style={{ margin: 0 }}><Link href={`/articles/${encodeURIComponent(x.id)}`} dir="auto">{x.title}</Link></h2>
              {x.excerpt ? <p className="hint" dir="auto">{x.excerpt}</p> : null}
              <p className="kv">
                {x.authorName ? <span className="ichip"><Avatar path={x.authorAvatarUrl} d={d} /><span>{a.by} {x.authorName}</span></span> : null}
                {x.countryId ? <CountryBadge id={x.countryId} d={d} /> : null}
                {x.official ? <span className="badge" data-tone="good">{a.official}</span> : null}
              </p>
              <p className="kv"><span><Dt iso={x.publishedAt} d={d} /></span><span>{nf.format(x.views ?? 0)} {a.views}</span><span>{nf.format(x.commentCount ?? 0)} {a.comments}</span>{x.newspaperName ? <span dir="auto">{x.newspaperName}</span> : null}</p>
            </article>
          ))}
        </div>
      )}
      <Provenance meta={res.meta} m={m} />
    </>
  );
}
