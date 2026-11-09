"use client";

import { SortTh, useSort } from "@/components/Sortable";
import { itemName, type Display } from "@/features/entities/display";
import { ItemChip } from "@/features/entities/entities";
import type { StatsShare } from "./analytics";

/** Company statistics by product with sortable columns (raw numbers, not formatted text). */
export function StatsTable({ rows, d, labels }: { rows: StatsShare[]; d: Display; labels: { product: string; companies: string; workers: string; owners: string; share: string } }) {
  const data = rows.map((r) => ({ ...r, name: itemName(r.itemCode, d).toLowerCase() }));
  const { sort, sorted, toggle } = useSort(data as unknown as Record<string, unknown>[], { key: "companies", dir: "desc" });
  const list = sorted as unknown as typeof data;
  const nf = new Intl.NumberFormat(d.nl);
  return (
    <div className="tablewrap" style={{ marginBlockStart: "1rem" }}>
      <table className="table">
        <thead>
          <tr>
            <SortTh k="name" sort={sort} onSort={toggle}>{labels.product}</SortTh>
            <SortTh k="companies" sort={sort} onSort={toggle} defaultDir="desc" align="end">{labels.companies}</SortTh>
            <SortTh k="workers" sort={sort} onSort={toggle} defaultDir="desc" align="end">{labels.workers}</SortTh>
            <SortTh k="owners" sort={sort} onSort={toggle} defaultDir="desc" align="end">{labels.owners}</SortTh>
            <SortTh k="sharePct" sort={sort} onSort={toggle} defaultDir="desc" align="end">{labels.share}</SortTh>
          </tr>
        </thead>
        <tbody>
          {list.map((r) => (
            <tr key={r.itemCode}>
              <td data-label={labels.product}><ItemChip code={r.itemCode} d={d} /></td>
              <td className="num" data-label={labels.companies}>{nf.format(r.companies)}</td>
              <td className="num" data-label={labels.workers}>{nf.format(r.workers)}</td>
              <td className="num" data-label={labels.owners}>{nf.format(r.owners)}</td>
              <td className="num" data-label={labels.share}>{r.sharePct == null ? "—" : `${r.sharePct}%`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
