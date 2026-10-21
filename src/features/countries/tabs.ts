import { SECTIONS } from "@/features/explorer/catalog";
import type { TabItem } from "@/components/Tabs";
import type { Messages } from "@/i18n/messages";

/** Tabs for every country page. `counts` (by tab slug) are optional and only supplied where they are already loaded. */
export function countryTabs(id: string, m: Messages, current: string, counts: Record<string, number | null | undefined> = {}): TabItem[] {
  const base = `/countries/${encodeURIComponent(id)}`;
  const subs = SECTIONS.countries!.subs ?? [];
  return [
    { href: base, label: m.countryProfile.overview, current: current === "overview" },
    ...subs.map((s) => ({ href: `${base}/${s.slug}`, label: (m.explorer.subs as Record<string, string>)[s.slug] ?? s.slug, current: s.slug === current, count: counts[s.slug] ?? null })),
  ];
}
