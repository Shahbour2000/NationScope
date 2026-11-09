import Link from "next/link";
import { ApiErrorState } from "@/components/ApiErrorState";
import { Provenance } from "@/components/Provenance";
import { Tabs } from "@/components/Tabs";
import { countryTabs } from "@/features/countries/tabs";
import { SubHead } from "@/features/countries/SubHead";
import { getDisplay } from "@/features/entities/display.server";
import { LawProposalList } from "@/features/politics/LawProposalList";
import { getLocale, getMessages } from "@/i18n";
import { getCountryLawProposals, getLawsCatalog } from "@/lib/data/world";
import { humanizeCode } from "@/lib/format";
import s from "@/features/countries/sub.module.css";

export const dynamic = "force-dynamic";
const PAGE = 30;

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
        <LawProposalList proposals={res.proposals} label={label} status={status} t={t} d={d} />
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
