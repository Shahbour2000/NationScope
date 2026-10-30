import Link from "next/link";
import { ApiErrorState } from "@/components/ApiErrorState";
import { PageHero } from "@/components/PageHero";
import { Provenance } from "@/components/Provenance";
import { Avatar, CountryBadge } from "@/features/entities/entities";
import { getDisplay } from "@/features/entities/display.server";
import { getLocale, getMessages } from "@/i18n";
import { getGameLeaderboards, getRanking } from "@/lib/data/world";

export const dynamic = "force-dynamic";
const PERIODS = ["all", "monthly", "weekly", "daily"] as const;
const link = (t: string, id: string) => (t === "user" ? `/players/${id}` : t === "mu" ? `/units/${id}` : t === "country" ? `/countries/${id}` : t === "alliance" ? `/alliances/${id}` : null);

export default async function RankingPage({ params, searchParams }: { params: Promise<{ board: string }>; searchParams: Promise<{ period?: string }> }) {
  const { board } = await params;
  const sp = await searchParams;
  const m = getMessages(await getLocale());
  const r = m.rankingsPage, u = m.pagesUi;
  const period = (PERIODS as readonly string[]).includes(sp.period ?? "") ? (sp.period as (typeof PERIODS)[number]) : "all";
  let res;
  try { res = await getRanking(board, { period, limit: 100 }); } catch (e) { return <ApiErrorState error={e} retryLabel={m.common.retry} />; }
  const boards = await getGameLeaderboards().then((b) => b.rows).catch(() => []);
  const d = await getDisplay();
  const nf = new Intl.NumberFormat(d.nl);
  const label = typeof res.board.label === "string" ? res.board.label : board;
  const grain = typeof res.board.grain === "string" ? res.board.grain : null;
  const isNum = (v: string) => /^\d+$/.test(v);
  const num = (v: string) => (isNum(v) ? nf.format(BigInt(v)) : v);
  const leader = res.rows[0] && isNum(res.rows[0].value) ? BigInt(res.rows[0].value) : 0n;
  /** Share of the leader's value, only when both values are plain integers (never guessed for other formats). */
  const share = (v: string): number | null => (leader > 0n && isNum(v) ? Number((BigInt(v) * 100n) / leader) : null);
  const podium = res.rows.slice(0, 3), rest = res.rows.slice(3);
  const ident = (x: (typeof res.rows)[number]) => <><Avatar path={x.avatarUrl} d={d} icon={x.subjectType === "user" ? "user" : "flag"} /><span className="pod-name" dir="auto">{x.name}</span></>;

  return (
    <>
      <PageHero icon="trophy" kicker={u.kicker.rankings} title={label} sub={grain ?? u.sub.rankings}
        kpis={res.rows[0] ? [{ icon: "trophy", label: u.leader, value: <span dir="auto">{res.rows[0].name}</span>, tone: "gold" }, { icon: "flame", label: r.value, value: num(res.rows[0].value), tone: "purple" }, { icon: "users", label: u.entries, value: nf.format(res.rows.length) }] : undefined} />

      <nav className="seg seg-scroll" aria-label={r.boards}>
        {boards.map((b) => <Link key={b.id} href={`/rankings/${encodeURIComponent(b.id)}`} aria-current={b.id === board ? "page" : undefined}>{b.label}</Link>)}
      </nav>
      <div><nav className="seg" aria-label={r.period}>
        {PERIODS.map((p) => <Link key={p} href={`/rankings/${encodeURIComponent(board)}${p === "all" ? "" : `?period=${p}`}`} aria-current={p === period ? "page" : undefined}>{r.periods[p]}</Link>)}
      </nav></div>

      {res.rows.length === 0 ? <p className="empty-mini panel">{r.noRows}</p> : (
        <>
          <h2 className="sec-title">{u.podium}</h2>
          <div className="podium">
            {podium.map((x) => {
              const href = link(x.subjectType, x.subjectId);
              const inner = <>{<span className="pod-rank">#{x.rank}</span>}{ident(x)}{x.countryId ? <CountryBadge id={x.countryId} d={d} link={false} /> : null}<span className="pod-val">{num(x.value)}</span></>;
              const key = `${x.subjectType}-${x.subjectId}`;
              return href ? <Link key={key} href={href} className="pod" data-rank={x.rank}>{inner}</Link> : <div key={key} className="pod" data-rank={x.rank}>{inner}</div>;
            })}
          </div>
          {rest.length > 0 ? (
            <section className="panel" aria-label={u.moreRanks}>
              <header><h2>{u.moreRanks}</h2></header>
              <ol className="ranklist">
                {rest.map((x) => {
                  const href = link(x.subjectType, x.subjectId), s = share(x.value);
                  const id = <><span className="rk-lead"><Avatar path={x.avatarUrl} d={d} icon={x.subjectType === "user" ? "user" : "flag"} /></span><span className="rk-name" dir="auto">{x.name}</span></>;
                  return (
                    <li key={`${x.subjectType}-${x.subjectId}`} className="rk-row">
                      <span className="rk">{x.rank}</span>
                      {href ? <Link href={href} className="rk-id" title={x.name}>{id}</Link> : <span className="rk-id" title={`${x.name} · ${u.unlinked}`}>{id}</span>}
                      {x.countryId ? <CountryBadge id={x.countryId} d={d} link={false} /> : null}
                      <span className="rk-val">{num(x.value)}</span>
                      {s !== null ? <span className="rk-share" role="img" aria-label={`${s}% ${u.vsLeader}`}><span style={{ inlineSize: `${Math.max(1, s)}%` }} /></span> : null}
                    </li>
                  );
                })}
              </ol>
            </section>
          ) : null}
        </>
      )}
      <p className="hint">{r.valueNote}</p>
      <Provenance meta={res.meta} m={m} />
    </>
  );
}
