"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";

/**
 * A horizontally scrollable <nav> that keeps its active item (aria-current) in view.
 * Every page renders its own tab bar, so the bar is re-created on each navigation and would otherwise start at the first tab.
 * The active item is centred once, without animation, and only if it is not already fully visible.
 */
export function ScrollNav({ className, label, children }: { className: string; label: string; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const nav = ref.current;
    const active = nav?.querySelector<HTMLElement>('[aria-current="page"], [aria-current="true"]');
    if (!nav || !active) return;
    const n = nav.getBoundingClientRect(), a = active.getBoundingClientRect();
    if (a.left >= n.left && a.right <= n.right) return;
    // Scroll only this container (never the page): centre the active item inside it.
    nav.scrollLeft += a.left - n.left - (n.width - a.width) / 2;
  });
  return <nav ref={ref} className={className} aria-label={label}>{children}</nav>;
}
