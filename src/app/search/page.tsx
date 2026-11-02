import Link from "next/link";
import { ApiErrorState } from "@/components/ApiErrorState";
import { Provenance } from "@/components/Provenance";
import { StateMessage } from "@/components/StateMessage";
import { countryName } from "@/features/entities/display";
import { getDisplay } from "@/features/entities/display.server";
import { RemoteImage } from "@/features/entities/RemoteImage";
import { Flag } from "@/features/entities/entities";
import { hrefFor, parseSearch } from "@/features/search/results";
import { getLocale, getMessages } from "@/i18n";
import { searchEntities } from "@/lib/data/search";
import { mediaSrc } from "@/lib/media";
import s from "./search.module.css";

export const dynamic = "force-dynamic";
const safe = (v: string) => /^[A-Za-z0-9_-]{1,80}$/.test(v);

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const m = getMessages(await getLocale());
  const t = m.searchPage;
  const q = ((await searchParams).q ?? "").trim();
  if (q.length < 2) {
    return (<><h1>{t.title}</h1><StateMessage tone="empty" title={t.title} detail={m.explorer.searchHint} /></>);
  }
  let result;
  try {
    result = await searchEntities(q);
  } catch (error) {
    return (<><h1>{t.title}</h1><ApiErrorState error={error} retryLabel={m.common.retry} /></>);
  }
  const d = await getDisplay();
  const { total, groups } = parseSearch(result.data);
  return (
    <>
      <h1>{t.title}</h1>
      <p className={s.lede}>{t.for} “{q}”</p>
      {total === 0 && <StateMessage tone="empty" title={t.title} detail={t.none.replace("{q}", q)} />}
      {groups.map((g) => (
        <section key={g.key} className={s.sec}>
          <h2>{t.groups[g.key]} <small>{g.hits.length}</small></h2>
          <div className={s.grid}>
            {g.hits.filter((h) => safe(h.id)).map((h) => (
              <Link key={h.id} className={s.hit} href={hrefFor(g.key, h.id)}>
                <span className={`${s.av} ${g.key === "players" ? "" : s.sq}`}>
                  <RemoteImage src={mediaSrc(h.avatarUrl, d.mediaOrigin)} size={42} cls="" fallback={<span aria-hidden="true">{h.label.slice(0, 2).toUpperCase()}</span>} />
                </span>
                <span className={s.who}>
                  <span className={s.name} dir="auto">{h.label}</span>
                  {h.countryId && <span className={s.sub}><Flag id={h.countryId} d={d} />{countryName(h.countryId, d.dir)}</span>}
                </span>
                {h.level !== null && <span className={s.lvl}>{t.level} <b>{h.level}</b></span>}
              </Link>
            ))}
          </div>
        </section>
      ))}
      <Provenance meta={result.meta} m={m} />
    </>
  );
}
