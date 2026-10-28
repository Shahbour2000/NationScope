"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import type { Messages } from "@/i18n/messages";
import { Icon, type IconName } from "./Icon";

export interface NavItem { href: string; label: string; icon: IconName }
export interface NavGroup { title: string; items: NavItem[] }

interface Props {
  groups: NavGroup[];
  labels: Messages["shell"];
  navLabel: string;
  brand: ReactNode;
  tools: ReactNode;
  search: ReactNode;
  foot?: ReactNode;
  children: ReactNode;
}

export function isActive(path: string, href: string): boolean {
  return href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`);
}

/** Desktop: collapsible sidebar. Mobile (<= 48rem): off-canvas drawer opened from the top bar. */
export function AppShell({ groups, labels, navLabel, brand, tools, search, foot, children }: Props) {
  const path = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try { setCollapsed(localStorage.getItem("ns.sidebar") === "collapsed"); } catch { /* storage unavailable */ }
  }, []);
  useEffect(() => { setOpen(false); }, [path]);
  useEffect(() => {
    document.body.dataset.drawer = open ? "open" : "closed";
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const toggleCollapse = () => {
    setCollapsed((c) => {
      try { localStorage.setItem("ns.sidebar", c ? "expanded" : "collapsed"); } catch { /* ignore */ }
      return !c;
    });
  };

  return (
    <div className="shell" data-collapsed={collapsed} data-open={open}>
      <a className="skip" href="#content">{labels.skip}</a>
      <aside className="sidebar" id="sidebar" aria-label={navLabel}>
        <div className="sidebar-head">
          {brand}
          <button type="button" className="icon-btn collapse-btn" onClick={toggleCollapse} aria-label={collapsed ? labels.expand : labels.collapse} aria-expanded={!collapsed}>
            <Icon name="chevron" />
          </button>
          <button type="button" className="icon-btn close-btn" onClick={() => setOpen(false)} aria-label={labels.closeMenu}>
            <Icon name="close" />
          </button>
        </div>
        <nav className="side-nav">
          {groups.map((g) => (
            <div key={g.title} className="side-group">
              <p className="side-title">{g.title}</p>
              <ul>
                {g.items.map((it) => (
                  <li key={it.href}>
                    <Link href={it.href} className="side-link" data-active={isActive(path, it.href)} aria-current={isActive(path, it.href) ? "page" : undefined} title={it.label}>
                      <Icon name={it.icon} />
                      <span className="side-label">{it.label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        {foot ? <div className="side-foot">{foot}</div> : null}
      </aside>
      <div className="scrim" onClick={() => setOpen(false)} aria-hidden="true" />
      <div className="shell-main">
        <header className="topbar">
          <button type="button" className="icon-btn menu-btn" onClick={() => setOpen(true)} aria-label={labels.openMenu} aria-controls="sidebar" aria-expanded={open}>
            <Icon name="menu" />
          </button>
          {search}
          <div className="topbar-tools">{tools}</div>
        </header>
        <main id="content">{children}</main>
      </div>
    </div>
  );
}
