import Link from "next/link";
import { ScrollNav } from "./ScrollNav";

export interface TabItem { href: string; label: string; current: boolean; count?: number | null }

export function Tabs({ items, label }: { items: TabItem[]; label: string }) {
  return (
    <ScrollNav className="tabs" label={label}>
      {items.map((t) => (
        <Link key={t.href} href={t.href} className="tab" aria-current={t.current ? "page" : undefined}>
          {t.label}{t.count != null ? <span className="tab-count">{t.count}</span> : null}
        </Link>
      ))}
    </ScrollNav>
  );
}
