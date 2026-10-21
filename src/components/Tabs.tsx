import Link from "next/link";

export interface TabItem { href: string; label: string; current: boolean; count?: number | null }

export function Tabs({ items, label }: { items: TabItem[]; label: string }) {
  return (
    <nav className="tabs" aria-label={label}>
      {items.map((t) => (
        <Link key={t.href} href={t.href} className="tab" aria-current={t.current ? "page" : undefined}>
          {t.label}{t.count != null ? <span className="tab-count">{t.count}</span> : null}
        </Link>
      ))}
    </nav>
  );
}
