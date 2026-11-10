import Link from "next/link";
import { ApiErrorState } from "@/components/ApiErrorState";
import { Provenance } from "@/components/Provenance";
import { Tabs } from "@/components/Tabs";
import { countryTabs } from "@/features/countries/tabs";
import { SubHead } from "@/features/countries/SubHead";
import { getDisplay } from "@/features/entities/display.server";
import { groupByDay } from "@/features/history/timeline";
import { getLocale, getMessages } from "@/i18n";
import { HISTORY_TYPES, getCountryHistory, type HistoryFilter } from "@/lib/data/world";
import { eventTargets } from "@/features/history/timeline";
import { Flag } from "@/features/entities/entities";
import { countryName } from "@/features/entities/display";
import { humanizeCode } from "@/lib/format";
import s from "@/features/countries/sub.module.css";

export const dynamic = "force-dynamic";
const tidy = (t: string) => t.replace(/\b([a-z]+)\.([a-z_]+)\b/g, (_, a: string, b: string) => `${humanizeCode(a)} ${humanizeCode(b).toLowerCase()}`);

export default async function CountryHistoryPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ cursor?: string; type?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const cursor = sp.cursor;
  const type = (HISTORY_TYPES as readonly string[]).includes(sp.type ?? "") ? (sp.type as HistoryFilter) : undefined;
  const m = getMessages(await getLocale());
  const t = m.countrySubs.events;
  const tabs = countryTabs(id, m, "events");
  let res;
  try { res = await getCountryHistory(id, cursor && /^[\w.:=-]{1,200}$/.test(cursor) ? cursor : undefined, type); } catch (e) { return <><h1>{t.title}</h1><Tabs items={tabs} label={t.title} /><ApiErrorState error={e} retryLabel={m.common.retry} /></>; }
  const d = await getDisplay();
  const groups = groupByDay(res.rows);
  const dayFmt = new Intl.DateTimeFormat(d.nl, { dateStyle: "full", timeZone: "UTC" });
  const timeFmt = new Intl.DateTimeFormat(d.nl, { timeStyle: "short", timeZone: "UTC" });
  const types = m.t.eventType as Record<string, string>;
  return (
    <>
      <SubHead id={id} title={t.title} tabs={tabs} d={d} />
      <nav className={s.filters} aria-label={t.title}>
        <Link href={`/countries/${encodeURIComponent(id)}/events`} aria-current={!type ? "true" : undefined}>{m.countrySubs.laws.all}</Link>
        {HISTORY_TYPES.map((k) => <Link key={k} href={`/countries/${encodeURIComponent(id)}/events?type=${k}`} aria-current={type === k ? "true" : undefined}>{types[k] ?? humanizeCode(k)}</Link>)}
      </nav>
      {groups.length === 0 ? <p className={s.empty}>{t.empty}</p> : (
        <div className={s.feed}>
          {groups.map((g) => (
            <section key={g.day ?? "undated"} className={s.day}>
              <h2>{g.day ? dayFmt.format(new Date(g.day)) : "—"}</h2>
              <div className={s.list}>
                {g.items.map((e) => (
                  <div key={e.key} className={s.evt} data-type={e.type}>
                    <span className={s.type}>{types[e.type] ?? humanizeCode(e.type)}</span>
                    <span className={s.txt}>
                      {tidy(e.summary ?? "")}
                      {(() => {
                        const g = eventTargets(e);
                        const others = g.countryIds.filter((c) => c !== id);
                        return (g.battleId || g.lawId || others.length > 0 || g.regionId) ? (
                          <span className={s.refs}>
                            {others.map((c) => <Link key={c} href={`/countries/${encodeURIComponent(c)}`} title={countryName(c, d.dir)}><Flag id={c} d={d} />{countryName(c, d.dir)}</Link>)}
                            {g.regionId && <Link href={`/regions/${encodeURIComponent(g.regionId)}`}>{humanizeCode(g.regionId)}</Link>}
                            {g.battleId && <Link href={`/battles/${encodeURIComponent(g.battleId)}`}>{types.battle ?? "Battle"} →</Link>}
                            {g.lawId && <Link href={`/laws/${encodeURIComponent(g.lawId)}`}>{types.law ?? "Law"} →</Link>}
                          </span>
                        ) : null;
                      })()}
                    </span>
                    <time className={s.when} dateTime={e.at}>{timeFmt.format(new Date(e.at))}</time>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
      {res.nextCursor && <div className={s.pager}><span /><Link href={`/countries/${encodeURIComponent(id)}/events?${type ? `type=${type}&` : ""}cursor=${encodeURIComponent(res.nextCursor)}`}>{t.older}</Link></div>}
      <Provenance meta={res.meta} m={m} />
    </>
  );
}
