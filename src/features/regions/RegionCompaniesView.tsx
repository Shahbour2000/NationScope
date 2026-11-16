import Link from "next/link";
import { itemName, type Display } from "@/features/entities/display";
import { ItemChip, PlayerChip } from "@/features/entities/entities";
import type { Messages } from "@/i18n/messages";
import { COMPANY_SORTS, companyTotals, fillPercent, filterSortCompanies, type CompanySort, type RegionCompany } from "@/lib/domain/region-detail";
import s from "./region.module.css";

const href = (base: string, item: string | null, sort: CompanySort) => {
  const q = new URLSearchParams();
  if (item) q.set("item", item);
  if (sort !== "storage") q.set("sort", sort);
  const str = q.toString();
  return str ? `${base}?${str}` : base;
};

/** Companies built in one region: KPIs, product filter, sort, and a card per company. Filtering and sorting are plain links (no client JS). */
export function RegionCompaniesView({ rows, skipped, item, sort, basePath, d, m }: { rows: RegionCompany[]; skipped: number; item: string | null; sort: CompanySort; basePath: string; d: Display; m: Messages }) {
  const t = m.regionPage.c, nf = new Intl.NumberFormat(d.nl);
  const all = companyTotals(rows);
  const shown = filterSortCompanies(rows, item, sort);
  const sortLabel: Record<CompanySort, string> = { storage: t.sortStorage, workers: t.sortWorkers, name: t.sortName };
  if (rows.length === 0) return <><p className={s.empty}>{t.empty}</p>{skipped > 0 ? <p className={s.dim}>{t.skipped.replace("{n}", nf.format(skipped))}</p> : null}</>;
  return (
    <>
      <div className={s.kpis}>
        <div><b>{nf.format(all.companies)}</b><span>{t.total}</span></div>
        <div><b>{nf.format(all.workers)}</b><span>{t.workers}</span></div>
        <div><b>{nf.format(all.hiring)}</b><span>{t.hiring}</span></div>
        <div><b>{nf.format(all.byItem.length)}</b><span>{t.products}</span></div>
      </div>
      {all.byItem.length > 1 ? (
        <nav className={s.bar} aria-label={t.products}>
          <span className={s.barLabel}>{t.products}</span>
          <Link href={href(basePath, null, sort)} aria-current={item === null ? "true" : undefined}>{t.all}</Link>
          {all.byItem.map((x) => <Link key={x.itemCode} href={href(basePath, x.itemCode, sort)} aria-current={item === x.itemCode ? "true" : undefined}>{itemName(x.itemCode, d)} · {nf.format(x.companies)}</Link>)}
        </nav>
      ) : null}
      {all.companies > 1 ? (
        <nav className={s.bar} aria-label={t.sortBy}>
          <span className={s.barLabel}>{t.sortBy}</span>
          {COMPANY_SORTS.map((k) => <Link key={k} href={href(basePath, item, k)} aria-current={sort === k ? "true" : undefined}>{sortLabel[k]}</Link>)}
        </nav>
      ) : null}
      {shown.length === 0 ? <p className={s.empty}>{t.noMatch}</p> : (
        <ul className={s.cards}>
          {shown.map((c) => {
            const pct = fillPercent(c.points, c.capacity), full = pct !== null && pct >= 100;
            return (
              <li key={c.id} className={s.card}>
                <div className={s.cardHead}>
                  <h3 title={c.name} dir="auto"><Link href={`/companies/${encodeURIComponent(c.id)}`}>{c.name}</Link></h3>
                  <ItemChip code={c.itemCode} d={d} href={`/market/${encodeURIComponent(c.itemCode)}`} />
                </div>
                <div className={s.cardMeta}>
                  {c.owner ? <PlayerChip id={c.owner.id} name={c.owner.username} avatar={c.owner.avatarUrl} d={d} /> : <span>{t.noOwner}</span>}
                  {c.offer != null ? <span className={s.badge} data-tone="ok">{t.hiringBadge}</span> : null}
                  {full ? <span className={s.badge} data-tone="gold">{t.storageFull}</span> : null}
                </div>
                <div>
                  <div className={s.nums}><span>{t.stored}</span><b>{pct === null ? "—" : `${nf.format(Math.round(pct))}%`}</b></div>
                  {pct !== null ? <div className={s.track} data-kind="store" data-full={full} role="img" aria-label={`${Math.round(pct)}%`}><i style={{ inlineSize: `${pct}%` }} /></div> : null}
                  {c.points && c.capacity ? <div className={s.dim}>{nf.format(BigInt(c.points))} / {nf.format(BigInt(c.capacity))}</div> : null}
                </div>
                <div className={s.nums}><span>{t.workers}</span><b>{c.workers == null ? "—" : c.workers === 0 ? t.noWorkers : nf.format(c.workers)}</b></div>
              </li>
            );
          })}
        </ul>
      )}
      <p className={s.dim}>{t.capacityNote}</p>
      {skipped > 0 ? <p className={s.dim}>{t.skipped.replace("{n}", nf.format(skipped))}</p> : null}
    </>
  );
}
