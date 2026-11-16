import Link from "next/link";
import { notFound } from "next/navigation";
import { ApiErrorState } from "@/components/ApiErrorState";
import { PageHero } from "@/components/PageHero";
import { Provenance } from "@/components/Provenance";
import { StateMessage } from "@/components/StateMessage";
import { getDisplay } from "@/features/entities/display.server";
import { ArticleView } from "@/features/news/NewsViews";
import { getLocale, getMessages } from "@/i18n";
import { getArticleDetail } from "@/lib/data/news-detail";

export const dynamic = "force-dynamic";
const safe = (v: string) => /^[A-Za-z0-9_-]{1,80}$/.test(v);

export default async function ArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!safe(id)) notFound();
  const m = getMessages(await getLocale());
  const t = m.articlePage;
  const back = <Link className="btn-ghost" href="/articles">{t.back}</Link>;
  let res;
  try { res = await getArticleDetail(id); } catch (e) { return <>{back}<ApiErrorState error={e} retryLabel={m.common.retry} /></>; }
  if (!res.detail) return <>{back}<StateMessage tone="empty" title={t.notFound} detail={t.notRecognised} /></>;
  const d = await getDisplay();
  return (
    <>
      <PageHero icon="news" kicker={m.articlesPage.title} title={res.detail.article.title} actions={back} />
      <ArticleView detail={res.detail} d={d} m={m} />
      <Provenance meta={res.meta} m={m} />
    </>
  );
}
