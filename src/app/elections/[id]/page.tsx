import Link from "next/link";
import { notFound } from "next/navigation";
import { ApiErrorState } from "@/components/ApiErrorState";
import { PageHero } from "@/components/PageHero";
import { Provenance } from "@/components/Provenance";
import { StateMessage } from "@/components/StateMessage";
import { countryName } from "@/features/entities/display";
import { getDisplay } from "@/features/entities/display.server";
import { ElectionDetailView } from "@/features/politics/ElectionDetailView";
import { getLocale, getMessages } from "@/i18n";
import { getElectionDetail } from "@/lib/data/politics-detail";
import { humanizeCode } from "@/lib/format";

export const dynamic = "force-dynamic";
const safe = (v: string) => /^[A-Za-z0-9_-]{1,80}$/.test(v);

export default async function ElectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!safe(id)) notFound();
  const m = getMessages(await getLocale());
  const t = m.electionPage;
  let res;
  try { res = await getElectionDetail(id); } catch (e) { return <><ApiErrorState error={e} retryLabel={m.common.retry} /></>; }
  if (!res.election) return <><StateMessage tone="empty" title={t.notFound} detail={t.notRecognised} /></>;
  const d = await getDisplay();
  const e = res.election;
  const back = e.countryId ? <Link className="btn-ghost" href={`/countries/${encodeURIComponent(e.countryId)}/elections`}>{t.back}</Link> : undefined;
  const title = (e.kind && (t.kind as Record<string, string>)[e.kind]) || e.label || (e.kind ? humanizeCode(e.kind) : id);
  return (
    <>
      <PageHero icon="trophy" kicker={e.countryId ? countryName(e.countryId, d.dir) : t.candidates} title={title} actions={back} />
      <ElectionDetailView election={e} d={d} m={m} />
      <Provenance meta={res.meta} m={m} />
    </>
  );
}
