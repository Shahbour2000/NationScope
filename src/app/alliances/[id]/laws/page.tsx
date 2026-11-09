import Link from "next/link";
import { notFound } from "next/navigation";
import { ApiErrorState } from "@/components/ApiErrorState";
import { Icon } from "@/components/Icon";
import { Provenance } from "@/components/Provenance";
import { Tabs } from "@/components/Tabs";
import { getDisplay } from "@/features/entities/display.server";
import { StatusBadge } from "@/features/entities/entities";
import { LawProposalList } from "@/features/politics/LawProposalList";
import { getLocale, getMessages } from "@/i18n";
import { getAllianceLawProposals, getAlliances, getLawsCatalog } from "@/lib/data/world";
import { humanizeCode } from "@/lib/format";
import s from "@/features/countries/sub.module.css";

export const dynamic = "force-dynamic";
const PAGE = 30;

export default async function AllianceLawsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ filter?: string; offset?: string }> }) {
  const { id } = await params;
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(id)) notFound();
  const sp = await searchParams;
  const filter = sp.filter === "open" || sp.filter === "closed" ? sp.filter : "all";
  const offset = Math.max(0, Math.min(10000, Number.parseInt(sp.offset ?? "0", 10) || 0));
  const m = getMessages(await getLocale());
  const a = m.alliancesPage, t = m.countrySubs.laws;
  const base = `/alliances/${encodeURIComponent(id)}`;
  let all, res;
  try { [all, res] = await Promise.all([getAlliances(), getAllianceLawProposals(id, { filter, offset, limit: PAGE })]); } catch (e) { return <ApiErrorState error={e} retryLabel={m.common.retry} />; }
  const alliance = all.rows.find((x) => x.id === id);
  if (!alliance) notFound();
  const d = await getDisplay();
  const catalog = await getLawsCatalog().catch(() => null);
  const label = (code: string) => catalog?.laws.find((l) => l.code === code)?.label ?? humanizeCode(code);
  const status = (st: string | null | undefined) => (st ? (t.status as Record<string, string>)[st] ?? humanizeCode(st) : "");
  const tabs = [{ href: base, label: m.explorer.overviewTab, current: false }, { href: `${base}/laws`, label: a.laws, current: true }];
  const filters: [string, string][] = [["all", t.all], ["open", t.open], ["closed", t.closed]];
  const q = (o: number) => `${base}/laws?${filter !== "all" ? `filter=${filter}&` : ""}offset=${o}`;
  return (
    <>
      <div className="page-head"><h1><Icon name="shield" size={26} /><span dir="auto">{alliance.name}</span></h1><StatusBadge value={alliance.status} d={d} /></div>
      <Tabs items={tabs} label={alliance.name} />
      <nav className={s.filters} aria-label={a.laws}>
        {filters.map(([k, name]) => <Link key={k} href={k === "all" ? `${base}/laws` : `${base}/laws?filter=${k}`} aria-current={filter === k ? "true" : undefined}>{name}</Link>)}
      </nav>
      {res.proposals.length === 0 ? <p className={s.empty}>{res.recognised ? t.empty : m.explorer.noRows}</p> : <LawProposalList proposals={res.proposals} label={label} status={status} t={t} d={d} />}
      {(offset > 0 || res.hasMore) && (
        <div className={s.pager}>
          {offset > 0 ? <Link href={q(Math.max(0, offset - PAGE))}>{m.explorer.prev}</Link> : <span>{m.explorer.prev}</span>}
          {res.hasMore ? <Link href={q(offset + PAGE)}>{m.explorer.next}</Link> : <span>{m.explorer.next}</span>}
        </div>
      )}
      <Provenance meta={res.meta} m={m} />
    </>
  );
}
