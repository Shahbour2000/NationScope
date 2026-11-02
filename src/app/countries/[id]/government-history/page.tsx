import Link from "next/link";
import { ApiErrorState } from "@/components/ApiErrorState";
import { Provenance } from "@/components/Provenance";
import { Tabs } from "@/components/Tabs";
import { countryTabs } from "@/features/countries/tabs";
import { SubHead } from "@/features/countries/SubHead";
import { term } from "@/features/entities/display";
import { getDisplay } from "@/features/entities/display.server";
import { initials } from "@/features/politics/elections";
import { getLocale, getMessages } from "@/i18n";
import { getGovernmentHistory } from "@/lib/data/world";
import { formatDate, humanizeCode } from "@/lib/format";
import s from "@/features/countries/sub.module.css";

export const dynamic = "force-dynamic";
const safe = (v: string) => /^[A-Za-z0-9_-]{1,80}$/.test(v);

export default async function GovernmentHistoryPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ role?: string }> }) {
  const { id } = await params;
  const role = (await searchParams).role ?? "all";
  const m = getMessages(await getLocale());
  const t = m.countrySubs.history;
  const tabs = countryTabs(id, m, "government-history");
  let res;
  try { res = await getGovernmentHistory(id); } catch (e) { return <><h1>{t.title}</h1><Tabs items={tabs} label={t.title} /><ApiErrorState error={e} retryLabel={m.common.retry} /></>; }
  const d = await getDisplay();
  const nf = new Intl.NumberFormat(d.nl);
  const order = ["president", "vicePresident", "ministerDefense", "ministerForeignAffairs", "ministerEconomy", "congress"];
  const counts = new Map<string, number>();
  for (const r of res.rows) counts.set(r.role, (counts.get(r.role) ?? 0) + 1);
  const roles = [...counts.keys()].sort((a, b) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99));
  const base = `/countries/${encodeURIComponent(id)}/government-history`;
  const rows = res.rows.filter((r) => role === "all" || r.role === role).sort((a, b) => Number(!!b.endedAt === false) - Number(!!a.endedAt === false) || (b.startedAt ?? "").localeCompare(a.startedAt ?? ""));
  const src = (v: string | null | undefined) => (v === "election" ? t.elected : v === "appointment" ? t.appointed : v ? humanizeCode(v) : "");
  return (
    <>
      <SubHead id={id} title={t.title} tabs={tabs} d={d} />
      <nav className={s.filters} aria-label={t.title}>
        <Link href={base} aria-current={role === "all" ? "true" : undefined}>{t.all}<small>{nf.format(res.rows.length)}</small></Link>
        {roles.map((r) => <Link key={r} href={`${base}?role=${encodeURIComponent(r)}`} aria-current={role === r ? "true" : undefined}>{term("role", r, d)}<small>{nf.format(counts.get(r) ?? 0)}</small></Link>)}
      </nav>
      {rows.length === 0 ? <p className={s.empty}>{t.empty}</p> : (
        <div className={s.list}>
          {rows.map((r) => {
            const live = !r.endedAt;
            return (
              <div key={r.id} className={s.hrow}>
                <span className={s.av}>{initials(r.username)}</span>
                <div className={s.grow}>
                  <div className={s.title}>
                    {r.userId && safe(r.userId) ? <Link href={`/players/${encodeURIComponent(r.userId)}`} style={{ color: "#fff", fontWeight: 650, textDecoration: "none" }}>{r.username ?? r.userId}</Link> : <b>{r.username ?? "—"}</b>}
                    <span className={s.chip}>{term("role", r.role, d)}</span>
                  </div>
                  <span className={s.meta}>{formatDate(r.startedAt, d.nl) ?? ""}{r.endedAt ? ` → ${formatDate(r.endedAt, d.nl)}` : ""}</span>
                </div>
                <div className={s.right}>
                  <span className={s.pill} data-s={live ? "current" : undefined}>{live ? t.current : src(r.source)}</span>
                  {!live && r.endReason && <span className={s.meta} style={{ margin: 0 }}>{humanizeCode(r.endReason)}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <Provenance meta={res.meta} m={m} />
    </>
  );
}
