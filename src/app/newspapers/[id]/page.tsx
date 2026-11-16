import Link from "next/link";
import { notFound } from "next/navigation";
import { ApiErrorState } from "@/components/ApiErrorState";
import { PageHero } from "@/components/PageHero";
import { Provenance } from "@/components/Provenance";
import { StateMessage } from "@/components/StateMessage";
import { getDisplay } from "@/features/entities/display.server";
import { NewspaperView } from "@/features/news/NewsViews";
import { getLocale, getMessages } from "@/i18n";
import { getNewspaperDetail } from "@/lib/data/news-detail";

export const dynamic = "force-dynamic";
const safe = (v: string) => /^[A-Za-z0-9_-]{1,80}$/.test(v);

export default async function NewspaperPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!safe(id)) notFound();
  const m = getMessages(await getLocale());
  const t = m.newspaperPage;
  const back = <Link className="btn-ghost" href="/articles">{t.back}</Link>;
  let res;
  try { res = await getNewspaperDetail(id); } catch (e) { return <>{back}<ApiErrorState error={e} retryLabel={m.common.retry} /></>; }
  if (!res.paper) return <>{back}<StateMessage tone="empty" title={t.notFound} detail={t.notRecognised} /></>;
  const d = await getDisplay();
  return (
    <>
      <PageHero icon="news" kicker={m.articlesPage.title} title={res.paper.name ?? id} actions={back} />
      <NewspaperView paper={res.paper} d={d} m={m} />
      <Provenance meta={res.meta} m={m} />
    </>
  );
}
