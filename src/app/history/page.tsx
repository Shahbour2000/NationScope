import Link from "next/link";
import { ApiErrorState } from "@/components/ApiErrorState";
import { PageHero } from "@/components/PageHero";
import { Provenance } from "@/components/Provenance";
import { CountryBadge, Dt, StatusBadge } from "@/features/entities/entities";
import { getDisplay } from "@/features/entities/display.server";
import { countByType, groupByDay } from "@/features/history/timeline";
import { getLocale, getMessages } from "@/i18n";
import { getHistory } from "@/lib/data/world";
import { humanizeCode } from "@/lib/format";

export const dynamic = "force-dynamic";
const TYPES = ["ownership", "treaty", "battle", "election", "law", "tournament"];

/** The API summary embeds event codes such as "embassy.opened"; they are shown as plain words. */
const tidy = (s: string) => s.replace(/\b([a-z]+)\.([a-z_]+)\b/g, (_, a: string, b: string) => `${humanizeCode(a)} ${humanizeCode(b).toLowerCase()}`);
/** The API links events to the game's own routes ("/country/eg"); map the ones NationScope has. */
const internal = (link: string | null | undefined): string | null => {
  const c = /^\/country\/([A-Za-z0-9_-]+)$/.exec(link ?? "");
  return c ? `/countries/${c[1]}` : null;
};

export default async function HistoryPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const sp = await searchParams;
  const m = getMessages(await getLocale());
  const h = m.historyPage, u = m.pagesUi;
  const type = TYPES.includes(sp.type ?? "") ? sp.type : undefined;
  let res;
  try { res = await getHistory(); } catch (e) { return <ApiErrorState error={e} retryLabel={m.common.retry} />; }
  const d = await getDisplay();
  const nf = new Intl.NumberFormat(d.nl);
  const names = m.t.eventType as Record<string, string>;
  const counts = countByType(res.rows);
  const rows = res.rows.filter((x) => !type || x.type === type);
  const groups = groupByDay(rows);
  const dayFmt = new Intl.DateTimeFormat(d.nl, { dateStyle: "full", timeZone: "UTC" });
  const top = [...counts].sort((a, b) => b[1] - a[1]).slice(0, 3);

  return (
    <>
      <PageHero icon="clock" kicker={u.kicker.history} title={h.title} sub={h.intro}
        kpis={res.rows.length ? [{ icon: "clock", label: u.events, value: nf.format(res.rows.length) }, ...top.map(([t, n], i) => ({ icon: (t === "battle" ? "battle" : t === "treaty" ? "scale" : t === "ownership" ? "map" : "landmark") as "battle" | "scale" | "map" | "landmark", label: names[t] ?? humanizeCode(t), value: nf.format(n), tone: (["red", "green", "gold"] as const)[i] }))] : undefined} />

      <nav className="seg seg-scroll" aria-label={h.type}>
        <Link href="/history" aria-current={!type ? "page" : undefined}>{h.allTypes}<span className="tab-count">{nf.format(res.rows.length)}</span></Link>
        {TYPES.filter((t) => counts.has(t) || t === type).map((t) => <Link key={t} href={`/history?type=${t}`} aria-current={type === t ? "page" : undefined}>{names[t]}<span className="tab-count">{nf.format(counts.get(t) ?? 0)}</span></Link>)}
      </nav>

      {groups.length === 0 ? <p className="empty-mini panel">{h.noMatch}</p> : groups.map((g) => (
        <section key={g.day ?? "undated"} aria-label={g.day ?? u.noDate}>
          <h2 className="tl-day">{g.day ? dayFmt.format(new Date(`${g.day}T00:00:00Z`)) : u.noDate}</h2>
          <ul className="timeline">
            {g.items.map((x) => {
              const href = internal(x.link);
              const text = tidy(x.summary ?? "");
              return (
                <li key={x.key} className="tl-item" data-type={x.type}>
                  <div className="tl-meta"><StatusBadge value={x.type} group="eventType" d={d} /><Dt iso={x.at} d={d} /></div>
                  <div className="tl-text" dir="auto">{href ? <Link href={href}>{text}</Link> : text}</div>
                  {(x.countryIds ?? []).length > 0 ? <span className="stat-chips">{(x.countryIds ?? []).map((c) => <CountryBadge key={c} id={c} d={d} />)}</span> : null}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      <p className="hint">{h.sumNote}</p>
      <Provenance meta={res.meta} m={m} />
    </>
  );
}
