import Link from "next/link";
import { ApiErrorState } from "@/components/ApiErrorState";
import { Icon } from "@/components/Icon";
import { Provenance } from "@/components/Provenance";
import { CountryBadge, Dt, StatusBadge } from "@/features/entities/entities";
import { getDisplay } from "@/features/entities/display.server";
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
  const h = m.historyPage;
  const type = TYPES.includes(sp.type ?? "") ? sp.type : undefined;
  let res;
  try { res = await getHistory(); } catch (e) { return <ApiErrorState error={e} retryLabel={m.common.retry} />; }
  const d = await getDisplay();
  const rows = res.rows.filter((x) => !type || x.type === type);
  return (
    <>
      <div className="page-head"><h1><Icon name="clock" size={26} />{h.title}</h1></div>
      <p className="note">{h.intro}</p>
      <nav className="tabs" aria-label={h.type}>
        <Link className="tab" href="/history" aria-current={!type ? "page" : undefined}>{h.allTypes}</Link>
        {TYPES.map((t) => <Link key={t} className="tab" href={`/history?type=${t}`} aria-current={type === t ? "page" : undefined}>{(m.t.eventType as Record<string, string>)[t]}</Link>)}
      </nav>
      <ul className="list">
        {rows.map((x) => {
          const href = internal(x.link);
          return (
            <li key={x.key} className="card" style={{ display: "flex" }}>
              <span className="kv"><StatusBadge value={x.type} group="eventType" d={d} /><Dt iso={x.at} d={d} /></span>
              <span style={{ flex: "1 1 18rem" }}>{href ? <Link href={href}>{tidy(x.summary ?? "")}</Link> : tidy(x.summary ?? "")}</span>
              <span className="stat-chips">{(x.countryIds ?? []).map((c) => <CountryBadge key={c} id={c} d={d} />)}</span>
            </li>
          );
        })}
        {rows.length === 0 && <li className="empty-mini">{h.noMatch}</li>}
      </ul>
      <p className="hint">{h.sumNote}</p>
      <Provenance meta={res.meta} m={m} />
    </>
  );
}
