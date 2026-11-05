import Link from "next/link";
import { ApiErrorState } from "@/components/ApiErrorState";
import { Provenance } from "@/components/Provenance";
import { Tabs } from "@/components/Tabs";
import { countryTabs } from "@/features/countries/tabs";
import { SubHead } from "@/features/countries/SubHead";
import { getDisplay } from "@/features/entities/display.server";
import { groupByDay } from "@/features/history/timeline";
import { getLocale, getMessages } from "@/i18n";
import { getCountryHistory } from "@/lib/data/world";
import { humanizeCode } from "@/lib/format";
import s from "@/features/countries/sub.module.css";

export const dynamic = "force-dynamic";
const tidy = (t: string) => t.replace(/\b([a-z]+)\.([a-z_]+)\b/g, (_, a: string, b: string) => `${humanizeCode(a)} ${humanizeCode(b).toLowerCase()}`);

export default async function CountryHistoryPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ cursor?: string }> }) {
  const { id } = await params;
  const cursor = (await searchParams).cursor;
  const m = getMessages(await getLocale());
  const t = m.countrySubs.events;
  const tabs = countryTabs(id, m, "history");
  let res;
  try { res = await getCountryHistory(id, cursor && /^[\w.:=-]{1,200}$/.test(cursor) ? cursor : undefined); } catch (e) { return <><h1>{t.title}</h1><Tabs items={tabs} label={t.title} /><ApiErrorState error={e} retryLabel={m.common.retry} /></>; }
  const d = await getDisplay();
  const groups = groupByDay(res.rows);
  const dayFmt = new Intl.DateTimeFormat(d.nl, { dateStyle: "full", timeZone: "UTC" });
  const timeFmt = new Intl.DateTimeFormat(d.nl, { timeStyle: "short", timeZone: "UTC" });
  const types = m.t.eventType as Record<string, string>;
  return (
    <>
      <SubHead id={id} title={t.title} tabs={tabs} d={d} />
      {groups.length === 0 ? <p className={s.empty}>{t.empty}</p> : (
        <div className={s.feed}>
          {groups.map((g) => (
            <section key={g.day ?? "undated"} className={s.day}>
              <h2>{g.day ? dayFmt.format(new Date(g.day)) : "—"}</h2>
              <div className={s.list}>
                {g.items.map((e) => (
                  <div key={e.key} className={s.evt} data-type={e.type}>
                    <span className={s.type}>{types[e.type] ?? humanizeCode(e.type)}</span>
                    <span className={s.txt}>{tidy(e.summary ?? "")}</span>
                    <time className={s.when} dateTime={e.at}>{timeFmt.format(new Date(e.at))}</time>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
      {res.nextCursor && <div className={s.pager}><span /><Link href={`/countries/${encodeURIComponent(id)}/history?cursor=${encodeURIComponent(res.nextCursor)}`}>{t.older}</Link></div>}
      <Provenance meta={res.meta} m={m} />
    </>
  );
}
