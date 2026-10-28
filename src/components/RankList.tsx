import Link from "next/link";
import type { ReactNode } from "react";

export interface RankItem { key: string; rank: number; href: string; lead: ReactNode; name: string; value: string; valueTitle?: string; tail?: ReactNode }

/**
 * Ranked identity rows. The name column is the only flexible one (min-width 0 + ellipsis, full name in `title`),
 * so long Arabic/Latin names never push the value or the rank outside the row.
 */
export function RankList({ items, label, icon }: { items: RankItem[]; label: string; icon?: ReactNode }) {
  return (
    <ol className="ranklist" aria-label={label}>
      {items.map((r) => (
        <li key={r.key}>
          <span className="rk" data-top={r.rank <= 3}>{r.rank}</span>
          <Link href={r.href} className="rk-id" title={r.name}>
            <span className="rk-lead">{r.lead}</span>
            <span className="rk-name" dir="auto">{r.name}</span>
          </Link>
          {r.tail}
          <span className="rk-val" title={r.valueTitle}>{icon}{r.value}</span>
        </li>
      ))}
    </ol>
  );
}
