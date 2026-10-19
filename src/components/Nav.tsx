"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Messages } from "@/i18n/messages";

interface Item { href?: string; label: string }

export function Nav({ m, diagnostics }: { m: Messages["nav"]; diagnostics: boolean }) {
  const path = usePathname();
  const groups: { title: string; items: Item[] }[] = [
    {
      title: m.explore,
      items: [
        { href: "/", label: m.overview },
        { href: "/units", label: m.units },
        { label: m.countries }, { label: m.alliances }, { label: m.parties },
        { label: m.players }, { label: m.wars }, { label: m.economy },
      ],
    },
    {
      title: m.tools,
      items: [{ href: "/tools/build-planner", label: m.planner }, ...(diagnostics ? [{ href: "/diagnostics", label: m.diagnostics }] : [])],
    },
  ];
  return (
    <nav className="nav-bar" aria-label={m.label}>
      {groups.map((g) => (
        <ul key={g.title} className="nav-group" aria-label={g.title}>
          {g.items.map((it) => {
            const active = it.href ? (it.href === "/" ? path === "/" : path.startsWith(it.href)) : false;
            return (
              <li key={it.label}>
                {it.href ? (
                  <Link href={it.href} aria-current={active ? "page" : undefined} className="nav-link" data-active={active}>
                    {it.label}
                  </Link>
                ) : (
                  <span className="nav-link" aria-disabled="true" data-disabled="true">
                    {it.label} <small>({m.soon})</small>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      ))}
    </nav>
  );
}
