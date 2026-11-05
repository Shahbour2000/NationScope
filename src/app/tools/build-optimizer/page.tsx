import type { Metadata } from "next";
import { PageHero } from "@/components/PageHero";
import { getLocale, numberLocale } from "@/i18n";
import { BuilderApp } from "@/features/build-optimizer/ui/BuilderApp";
import { getBuilderMessages } from "@/features/build-optimizer/ui/messages";
import "./builder.css";

export const metadata: Metadata = { title: "Build Optimizer" };
export const dynamic = "force-dynamic";

export default async function BuildOptimizerPage({ searchParams }: { searchParams: Promise<{ player?: string }> }) {
  const locale = await getLocale();
  const t = getBuilderMessages(locale);
  const { player } = await searchParams;
  const initial = typeof player === "string" && /^[A-Za-z0-9_-]{1,80}$/.test(player) ? player : undefined;
  return (
    <>
      <PageHero icon="tool" kicker={t.kicker} title={t.title} sub={t.sub} />
      <BuilderApp t={t} numLocale={numberLocale(locale)} initialPlayer={initial} />
    </>
  );
}
