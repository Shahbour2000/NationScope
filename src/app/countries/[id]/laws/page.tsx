import Link from "next/link";
import { ApiErrorState } from "@/components/ApiErrorState";
import { Provenance } from "@/components/Provenance";
import { Tabs } from "@/components/Tabs";
import { countryTabs } from "@/features/countries/tabs";
import { SubHead } from "@/features/countries/SubHead";
import { countryName } from "@/features/entities/display";
import { getDisplay } from "@/features/entities/display.server";
import { Flag } from "@/features/entities/entities";
import { getLocale, getMessages } from "@/i18n";
import { getCountryLawProposals, getLawsCatalog } from "@/lib/data/world";
import { formatDate, humanizeCode } from "@/lib/format";
import s from "@/features/countries/sub.module.css";

export const dynamic = "force-dynamic";
const PAGE = 30;
const safe = (v: string) => /^[A-Za-z0-9_-]{1,80}$/.test(v);

export default async function CountryLawsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ filter?: string; offset?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const filter = sp.filter === "open" || sp.filter === "closed" ? sp.filter : "all";
  const offset = Math.max(0, Math.min(10000, Number.parseInt(sp.offset ?? "0", 10) || 0));
  const m = getMessages(await getLocale());
  const t = m.countrySubs.laws;
  const tabs = countryTabs(id, m, "laws");
  let res;
  try { res = await getCountryLawProposals(id, { filter, offset, limit: PAGE }); } catch (e) { return <><h1>{t.title}</h1><Tabs items={tabs} label={t.title} /><ApiErrorState error={e} retryLabel={m.common.retry} /></>; }
  const d = await getDisplay();
  const catalog = await getLawsCatalog().catch(() => null);
  const label = (code: string) => catalog?.laws.find((l) => l.code === code)?.label ?? humanizeCode(code);
  const nf = new Intl.NumberFormat(d.nl);
  const base = `/countries/${encodeURIComponent(id)}/laws`;
  const filters: [string, string][] = [["all", t.all], ["open", t.open], ["closed", t.closed]];
  const status = (st: string | null | undefined) => (st ? (t.status as Record<string, string>)[st] ?? humanizeCode(st) : "");
  return (
    <>
      <SubHead id={id} title={t.title} tabs={tabs} d={d} />
      <nav className={s.filters} aria-label={t.title}>
        {filters.map(([k, name]) => <Link key={k} href={k === "all" ? base : `${base}?filter=${k}`} aria-current={filter === k ? "true" : undefined}>{name}</Link>)}
      </nav>
      {res.proposals.length === 0 ? <p className={s.empty}>{t.empty}</p> : (
        <ul className={s.list}>
          {res.proposals.map((p) => {
            const voters = p.electorateSize ?? 0;
            const yes = p.yes ?? 0, no = p.no ?? 0;
            const pct = (n: number) => (voters > 0 ? Math.min(100, (n / voters) * 100) : 0);
            const entries = Object.entries(p.params ?? {});
            return (
              <li key={p.id} className={s.row}>
                <div>
                  <div className={s.title}>
                    {safe(p.id) ? <Link href={`/laws/${encodeURIComponent(p.id)}`}>{label(p.lawCode)}</Link> : <b>{label(p.lawCode)}</b>}
                    {entries.map(([k, v]) => (k === "country" && typeof v === "string"
                      ? <span key={k} className={s.chip}><Flag id={v} d={d} />{countryName(v, d.dir)}</span>
                      : <span key={k} className={s.chip}>{humanizeCode(String(v))}</span>))}
                    <span className={s.pill} data-s={p.status ?? undefined}>{status(p.status)}</span>
                  </div>
                  <span className={s.meta}>{p.proposerName ? `${t.by} ${p.proposerName} · ` : ""}{formatDate(p.opensAt, d.nl) ?? ""}{p.paperCost != null ? ` · ${nf.format(p.paperCost)} ${t.cost}` : ""}</span>
                </div>
                <div className={s.votes} aria-label={`${yes} ${t.yes}, ${no} ${t.no}`}>
                  <div className={s.votebar}><i style={{ inlineSize: `${pct(yes)}%` }} /><i style={{ inlineSize: `${pct(no)}%` }} /></div>
                  <span className={s.votenums}>{nf.format(yes)} {t.yes} · {nf.format(no)} {t.no}{voters ? ` · ${nf.format(voters)} ${t.voters}` : ""}</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {(offset > 0 || res.hasMore) && (
        <div className={s.pager}>
          {offset > 0 ? <Link href={`${base}?${filter !== "all" ? `filter=${filter}&` : ""}offset=${Math.max(0, offset - PAGE)}`}>{m.explorer.prev}</Link> : <span>{m.explorer.prev}</span>}
          {res.hasMore ? <Link href={`${base}?${filter !== "all" ? `filter=${filter}&` : ""}offset=${offset + PAGE}`}>{m.explorer.next}</Link> : <span>{m.explorer.next}</span>}
        </div>
      )}
      <Provenance meta={res.meta} m={m} />
    </>
  );
}
