import Link from "next/link";
import { notFound } from "next/navigation";
import { ApiErrorState } from "@/components/ApiErrorState";
import { PageHero } from "@/components/PageHero";
import { Provenance } from "@/components/Provenance";
import { getDisplay } from "@/features/entities/display.server";
import { ArchiveAsReturned, ArchiveView } from "@/features/rankings/ArchiveView";
import { getLocale, getMessages } from "@/i18n";
import { boardLabel } from "@/features/rankings/boardLabels";
import { getGameRules } from "@/lib/data/game-rules";
import { getRankingArchive } from "@/lib/data/ranking-archive";
import { isEmptyList } from "@/lib/domain/market-item";

export const dynamic = "force-dynamic";
const safe = (v: string) => /^[A-Za-z0-9_-]{1,80}$/.test(v);

export default async function RankingArchivePage({ params }: { params: Promise<{ board: string }> }) {
  const { board } = await params;
  if (!safe(board)) notFound();
  const m = getMessages(await getLocale());
  const t = m.rankingArchive;
  // GET /game says which boards keep an archive (`archived`); ask only those.
  const game = await getGameRules().catch(() => null);
  const known = game?.rules?.boards.find((b) => b.id === board);
  const back = <Link className="btn-ghost" href={`/rankings/${encodeURIComponent(board)}`}>{t.back}</Link>;
  if (known && known.archived === false) {
    const d0 = await getDisplay();
    return <><PageHero icon="trophy" kicker={t.kicker} title={t.title.replace("{board}", boardLabel(board, known.label, d0.locale))} actions={back} /><p className="empty-mini panel">{t.notArchived}</p></>;
  }
  let res;
  try { res = await getRankingArchive(board); } catch (e) { return <ApiErrorState error={e} retryLabel={m.common.retry} />; }
  const d = await getDisplay();
  const label = boardLabel(board, known?.label ?? res.boardLabel, d.locale);
  return (
    <>
      <PageHero icon="trophy" kicker={t.kicker} title={t.title.replace("{board}", label)} sub={t.sub} actions={back} />
      {res.archive ? <ArchiveView board={board} entries={res.archive.entries} skipped={res.archive.skipped} d={d} m={m} /> : isEmptyList(res.raw) ? <p className="empty-mini panel">{t.empty}</p> : <ArchiveAsReturned data={res.raw} d={d} m={m} />}
      <Provenance meta={res.meta} m={m} />
    </>
  );
}
