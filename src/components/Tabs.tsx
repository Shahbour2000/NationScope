import Link from "next/link";

export function Tabs({ items, label }: { items: { href: string; label: string; current: boolean }[]; label: string }) {
  return (
    <nav className="tabs" aria-label={label}>
      {items.map((t) => (
        <Link key={t.href} href={t.href} className="tab" aria-current={t.current ? "page" : undefined}>{t.label}</Link>
      ))}
    </nav>
  );
}
