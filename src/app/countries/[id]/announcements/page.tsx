import Link from "next/link";
import { notFound } from "next/navigation";
import { ApiErrorState } from "@/components/ApiErrorState";
import { Provenance } from "@/components/Provenance";
import { Tabs } from "@/components/Tabs";
import { SubHead } from "@/features/countries/SubHead";
import { countryTabs } from "@/features/countries/tabs";
import { Dt } from "@/features/entities/entities";
import { getDisplay } from "@/features/entities/display.server";
import { getLocale, getMessages } from "@/i18n";
import { getAnnouncements } from "@/lib/data/announcements";
import s from "@/features/countries/sub.module.css";

export const dynamic = "force-dynamic";
const safe = (v: string | null | undefined): v is string => !!v && /^[A-Za-z0-9_-]{1,80}$/.test(v);

/** Government announcements of a country (GET /countries/{id}/announcements). Text is shown as plain text only. */
export default async function CountryAnnouncementsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!safe(id)) notFound();
  const m = getMessages(await getLocale());
  const a = m.countrySubs.announce;
  const title = (m.explorer.subs as Record<string, string>).announcements ?? "Announcements";
  const tabs = countryTabs(id, m, "announcements");
  let res;
  try { res = await getAnnouncements(id); } catch (e) { return <><h1>{title}</h1><Tabs items={tabs} label={title} /><ApiErrorState error={e} retryLabel={m.common.retry} /></>; }
  const d = await getDisplay();
  const nf = new Intl.NumberFormat(d.nl);
  const now = Date.now();
  const rows = [...res.rows].sort((x, y) => Date.parse(y.createdAt ?? "") - Date.parse(x.createdAt ?? ""));
  return (
    <>
      <SubHead id={id} title={title} tabs={tabs} d={d} />
      {rows.length === 0 ? <p className={s.empty}>{res.recognised ? a.empty : m.explorer.noRows}</p> : (
        <ul style={{ listStyle: "none", margin: "1.1rem 0 0", padding: 0, display: "grid", gap: "0.8rem" }}>
          {rows.map((r) => {
            const exp = r.expiresAt ? Date.parse(r.expiresAt) : NaN;
            const expired = Number.isFinite(exp) && exp < now;
            return (
              <li key={r.id} className="card" style={{ padding: "1rem 1.2rem", opacity: expired ? 0.7 : 1 }}>
                <p dir="auto" style={{ margin: "0 0 0.6rem", whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontSize: "1.02rem" }}>{r.body}</p>
                <div className="hint" style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem 1rem" }}>
                  {r.authorName && <span>{a.by} {safe(r.authorId) ? <Link href={`/players/${encodeURIComponent(r.authorId)}`}>{r.authorName}</Link> : r.authorName}</span>}
                  {r.createdAt && <span><Dt iso={r.createdAt} d={d} /></span>}
                  {r.expiresAt && <span>{expired ? a.expired : a.expires}: <Dt iso={r.expiresAt} d={d} /></span>}
                  {r.views != null && <span>{nf.format(r.views)} {a.views}</span>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <Provenance meta={res.meta} m={m} />
    </>
  );
}
