import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { AppShell, type NavGroup } from "@/components/AppShell";
import { EnvBadge } from "@/components/EnvBadge";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { Logo } from "@/components/Logo";
import { dirOf, getLocale, getMessages } from "@/i18n";
import { diagnosticsEnabled } from "@/lib/diagnostics/probe";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "NationScope", template: "%s · NationScope" },
  description: "Independent analytics for Age of Nations",
};
export const viewport: Viewport = { themeColor: "#0a0f1a", width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const m = getMessages(locale);
  const n = m.nav;
  const groups: NavGroup[] = [
    { title: n.world, items: [
      { href: "/", label: n.overview, icon: "home" },
      { href: "/countries", label: n.countries, icon: "flag" },
      { href: "/alliances", label: n.alliances, icon: "shield" },
      { href: "/regions", label: n.regions, icon: "map" },
    ] },
    { title: n.military, items: [
      { href: "/units", label: n.units, icon: "unit" },
      { href: "/battles", label: n.battles, icon: "battle" },
      { href: "/wars", label: n.wars, icon: "war" },
      { href: "/contracts", label: n.contracts, icon: "contract" },
    ] },
    { title: n.economy, items: [
      { href: "/market", label: n.market, icon: "chart" },
      { href: "/equipment", label: n.equipment, icon: "box" },
      { href: "/equipment-floor", label: n.equipmentFloor, icon: "box" },
      { href: "/jobs", label: n.jobs, icon: "briefcase" },
    ] },
    { title: n.records, items: [
      { href: "/history", label: n.history, icon: "clock" },
      { href: "/articles", label: n.articles, icon: "news" },
      { href: "/tournaments", label: n.tournaments, icon: "trophy" },
    ] },
    { title: n.tools, items: [
      { href: "/tools/build-planner", label: n.planner, icon: "tool" },
      ...(diagnosticsEnabled() ? [{ href: "/diagnostics", label: n.diagnostics, icon: "bug" as const }] : []),
    ] },
  ];
  return (
    <html lang={locale} dir={dirOf(locale)}>
      <body>
        <AppShell
          groups={groups}
          labels={m.shell}
          navLabel={n.label}
          brand={<Link href="/" className="brand" aria-label={m.brand}><Logo /></Link>}
          tools={
            <>
              <LocaleSwitcher current={locale} label={m.common.language} otherLabel={m.common.otherLanguage} />
              <EnvBadge labels={m.common.environment} />
            </>
          }
        >
          {children}
        </AppShell>
      </body>
    </html>
  );
}
