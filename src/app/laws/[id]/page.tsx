import Link from "next/link";
import { notFound } from "next/navigation";
import { ApiErrorState } from "@/components/ApiErrorState";
import { PageHero } from "@/components/PageHero";
import { Provenance } from "@/components/Provenance";
import { StateMessage } from "@/components/StateMessage";
import { getDisplay } from "@/features/entities/display.server";
import { LawDetailView } from "@/features/politics/LawDetailView";
import { getLocale, getMessages } from "@/i18n";
import { getLawDetail } from "@/lib/data/politics-detail";
import { humanizeCode } from "@/lib/format";

export const dynamic = "force-dynamic";
const safe = (v: string) => /^[A-Za-z0-9_-]{1,80}$/.test(v);

export default async function LawPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!safe(id)) notFound();
  const m = getMessages(await getLocale());
  const t = m.lawPage;
  const back = <Link className="btn-ghost" href="/laws">{t.back}</Link>;
  let res;
  try { res = await getLawDetail(id); } catch (e) { return <>{back}<ApiErrorState error={e} retryLabel={m.common.retry} /></>; }
  if (!res.law) return <>{back}<StateMessage tone="empty" title={t.notFound} detail={t.notRecognised} /></>;
  const d = await getDisplay();
  const law = res.law;
  return (
    <>
      <PageHero icon="contract" kicker={m.nav.laws} title={law.law?.label ?? (law.lawCode ? humanizeCode(law.lawCode) : id)} actions={back} />
      <LawDetailView law={law} d={d} m={m} />
      <Provenance meta={res.meta} m={m} />
    </>
  );
}
