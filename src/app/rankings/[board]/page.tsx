import Link from "next/link";
import { ApiErrorState } from "@/components/ApiErrorState";
import { Icon } from "@/components/Icon";
import { Provenance } from "@/components/Provenance";
import { Avatar, CountryBadge } from "@/features/entities/entities";
import { getDisplay } from "@/features/entities/display.server";
import { getLocale, getMessages } from "@/i18n";
import { getGameLeaderboards, getRanking } from "@/lib/data/world";

export const dynamic = "force-dynamic";
const PERIODS = ["all", "monthly", "weekly", "daily"] as const;

export default async function RankingPage({ params, searchParams }: { params: Promise<{ board: string }>; searchParams: Promise<{ period?: string }> }) {
  const { board } = await params;
  const sp = await searchParams;
  const m = getMessages(await getLocale());
  const r = m.rankingsPage;
  const period = (PERIODS as readonly string[]).includes(sp.period ?? "") ? (sp.period as (typeof PERIODS)[number]) : "all";
  let res;
  try { res = await getRanking(board, { period, limit: 100 }); } catch (e) { return <ApiErrorState error={e} retryLabel={m.common.retry} />; }
  const boards = await getGameLeaderboards().then((b) => b.rows).catch(() => []);
  const d = await getDisplay();
  const nf = new Intl.NumberFormat(d.nl);
  const label = typeof res.board.label === "string" ? res.board.label : board;
  const grain = typeof res.board.grain === "string" ? res.board.grain : null;
  const link = (t: string, id: string) => (t === "user" ? `/players/${id}` : t === "mu" ? `/units/${id}` : t === "country" ? `/countries/${id}` : t === "alliance" ? `/alliances/${id}` : null);
  const num = (v: string) => (/^\d+$/.test(v) ? nf.format(BigInt(v)) : v);
  return (
    <>
      <div className="page-head"><h1><Icon name="trophy" size={26} />{label}</h1></div>
      {grain && <p className="note">{grain}</p>}
      <nav className="tabs" aria-label={r.boards}>
        {boards.map((b) => <Link key={b.id} className="tab" href={`/rankings/${encodeURIComponent(b.id)}`} aria-current={b.id === board ? "page" : undefined}>{b.label}</Link>)}
      </nav>
      <nav className="tabs" aria-label={r.period}>
        {PERIODS.map((p) => <Link key={p} className="tab" href={`/rankings/${encodeURIComponent(board)}${p === "all" ? "" : `?period=${p}`}`} aria-current={p === period ? "page" : undefined}>{r.periods[p]}</Link>)}
      </nav>
      <div className="tablewrap">
        <table className="table">
          <thead><tr><th scope="col" className="num">{r.rank}</th><th scope="col">{r.name}</th><th scope="col">{r.country}</th><th scope="col" className="num">{r.value}</th></tr></thead>
          <tbody>
            {res.rows.map((x) => {
              const href = link(x.subjectType, x.subjectId);
              const inner = <><Avatar path={x.avatarUrl} d={d} icon={x.subjectType === "user" ? "user" : "flag"} /><span>{x.name}</span></>;
              return (
                <tr key={`${x.subjectType}-${x.subjectId}`}>
                  <td className="num" data-label={r.rank}>{x.rank}</td>
                  <td data-label={r.name}>{href ? <Link className="ichip" href={href}>{inner}</Link> : <span className="ichip">{inner}</span>}</td>
                  <td data-label={r.country}>{x.countryId ? <CountryBadge id={x.countryId} d={d} /> : "—"}</td>
                  <td className="num" data-label={r.value}>{num(x.value)}</td>
                </tr>
              );
            })}
            {res.rows.length === 0 && <tr><td colSpan={4}>{r.noRows}</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="hint">{r.valueNote}</p>
      <Provenance meta={res.meta} m={m} />
    </>
  );
}
