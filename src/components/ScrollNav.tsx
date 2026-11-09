"use client";

import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";

const KEY = "ns:tabscroll:";

/**
 * A horizontally scrollable <nav> that keeps its active item (aria-current) in view.
 * Every page renders its own tab bar, so the bar is re-created on each navigation and would otherwise start at the first tab.
 * On mount the previous scroll position of this bar is restored (so navigating between tabs does not jump back to the start),
 * then the active item is brought into view only if it is not already fully visible. Never animated, never scrolls the page.
 */
export function ScrollNav({ className, label, children }: { className: string; label: string; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const nav = ref.current;
    if (!nav) return;
    try { const saved = sessionStorage.getItem(KEY + label); if (saved !== null) nav.scrollLeft = Number(saved) || 0; } catch { /* storage unavailable */ }
    const active = nav.querySelector<HTMLElement>('[aria-current="page"], [aria-current="true"]');
    if (!active) return;
    const n = nav.getBoundingClientRect(), a = active.getBoundingClientRect();
    if (a.left >= n.left && a.right <= n.right) return;
    // Scroll only this container: centre the active item inside it (works for RTL too: scrollLeft is relative).
    nav.scrollLeft += a.left - n.left - (n.width - a.width) / 2;
  }, [label]);
  useEffect(() => {
    const nav = ref.current;
    if (!nav) return;
    let t: ReturnType<typeof setTimeout> | undefined;
    const save = () => { clearTimeout(t); t = setTimeout(() => { try { sessionStorage.setItem(KEY + label, String(nav.scrollLeft)); } catch { /* ignore */ } }, 120); };
    nav.addEventListener("scroll", save, { passive: true });
    return () => { clearTimeout(t); nav.removeEventListener("scroll", save); };
  }, [label]);
  return <nav ref={ref} className={className} aria-label={label}>{children}</nav>;
}
