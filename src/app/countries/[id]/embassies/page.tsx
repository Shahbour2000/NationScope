import Link from "next/link";
import { ApiErrorState } from "@/components/ApiErrorState";
import { Provenance } from "@/components/Provenance";
import { Tabs } from "@/components/Tabs";
import { countryTabs } from "@/features/countries/tabs";
import { SubHead } from "@/features/countries/SubHead";
import { countryName, type Display } from "@/features/entities/display";
import { getDisplay } from "@/features/entities/display.server";
import { Flag } from "@/features/entities/entities";
import { getLocale, getMessages } from "@/i18n";
import { getCountryEmbassies } from "@/lib/data/world";
import { formatDate } from "@/lib/format";
import s from "@/features/countries/sub.module.css";

export const dynamic = "force-dynamic";
const safe = (v: string) => /^[A-Za-z0-9_-]{1,80}$/.test(v);
type Row = { countryId: string; openedAt?: string | null; mutual?: boolean | null };

function List({ rows, d, mutualLabel, empty }: { rows: Row[]; d: Display; mutualLabel: string; empty: string }) {
  if (rows.length === 0) return <p className={s.empty}>{empty}</p>;
  return (
    <div className={s.list}>
      {[...rows].sort((a, b) => (b.openedAt ?? "").localeCompare(a.openedAt ?? "")).map((r) => (
        <div key={r.countryId} className={s.emb}>
          <span className={s.grow}>
            <Flag id={r.countryId} d={d} />
            {safe(r.countryId) ? <Link href={`/countries/${encodeURIComponent(r.countryId)}`} style={{ color: "#fff", fontWeight: 650, textDecoration: "none" }}>{countryName(r.countryId, d.dir)}</Link> : countryName(r.countryId, d.dir)}
          </span>
          {r.mutual && <span className={s.mutual}>{mutualLabel}</span>}
          <span className={s.date}>{formatDate(r.openedAt, d.nl) ?? ""}</span>
        </div>
      ))}
    </div>
  );
}

export default async function EmbassiesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = getMessages(await getLocale());
  const t = m.countrySubs.embassies;
  const tabs = countryTabs(id, m, "embassies");
  let res;
  try { res = await getCountryEmbassies(id); } catch (e) { return <><h1>{t.title}</h1><Tabs items={tabs} label={t.title} /><ApiErrorState error={e} retryLabel={m.common.retry} /></>; }
  const d = await getDisplay();
  const nf = new Intl.NumberFormat(d.nl);
  const mutual = res.abroad.filter((r) => r.mutual).length;
  return (
    <>
      <SubHead id={id} title={t.title} tabs={tabs} d={d} />
      <div className={s.kpis}>
        <div><b>{nf.format(res.abroad.length)}</b><span>{t.abroad}</span></div>
        <div><b>{nf.format(res.hosted.length)}</b><span>{t.hosted}</span></div>
        <div><b>{nf.format(mutual)}</b><span>{t.mutualCount}</span></div>
      </div>
      <div className={s.cols} style={{ marginBlockStart: 0 }}>
        <section className={s.sec}><h2>{t.abroad} <small>{nf.format(res.abroad.length)}</small></h2><List rows={res.abroad} d={d} mutualLabel={t.mutual} empty={t.empty} /></section>
        <section className={s.sec}><h2>{t.hosted} <small>{nf.format(res.hosted.length)}</small></h2><List rows={res.hosted} d={d} mutualLabel={t.mutual} empty={t.empty} /></section>
      </div>
      <Provenance meta={res.meta} m={m} />
    </>
  );
}
