import type { Metadata } from "next";
import Link from "next/link";
import { EnvBadge } from "@/components/EnvBadge";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { Nav } from "@/components/Nav";
import { dirOf, getLocale, getMessages } from "@/i18n";
import { diagnosticsEnabled } from "@/lib/diagnostics/probe";
import "./globals.css";

export const metadata: Metadata = {
  title: "NationScope",
  description: "Independent analytics for Age of Nations",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const m = getMessages(locale);
  return (
    <html lang={locale} dir={dirOf(locale)}>
      <body>
        <header className="site-header">
          <Link className="brand" href="/">{m.brand}</Link>
          <div className="header-tools">
            <LocaleSwitcher current={locale} label={m.common.language} otherLabel={m.common.otherLanguage} />
            <EnvBadge labels={m.common.environment} />
          </div>
        </header>
        <Nav m={m.nav} diagnostics={diagnosticsEnabled()} />
        <main>{children}</main>
      </body>
    </html>
  );
}
