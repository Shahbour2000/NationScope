import type { Metadata } from "next";
import { PageHero } from "@/components/PageHero";
import { loadEngineContext } from "@/features/economy-engine/data/context";
import { EngineView } from "@/features/economy-engine/ui/EngineView";
import { textFor } from "@/features/economy-engine/ui/text";
import s from "@/features/economy-engine/ui/engine.module.css";
import { itemName } from "@/features/entities/display";
import { getDisplay } from "@/features/entities/display.server";
import { RECIPES } from "@/features/economy-engine/domain/recipes";
import { getLocale } from "@/i18n";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Economy Engine" };

export default async function EngineEconomyPage({ searchParams }: { searchParams: Promise<{ player?: string | string[] }> }) {
  const locale = await getLocale();
  const t = textFor(locale);
  const sp = await searchParams;
  const player = (Array.isArray(sp.player) ? sp.player[0] : sp.player)?.slice(0, 40) ?? "";
  const ctx = await loadEngineContext(player.trim() ? { player } : {});
  const d = await getDisplay();
  const codes = new Set<string>(RECIPES.map((r) => r.item));
  if (ctx.companies?.state === "ok") for (const c of ctx.companies.value) { const code = (c as { itemCode?: unknown }).itemCode; if (typeof code === "string") codes.add(code); }
  const names = Object.fromEntries([...codes].map((c) => [c, itemName(c, d)]));
  return (
    <>
      <PageHero icon="chart" kicker={t.kicker} title={t.title} sub={t.sub} />
      <form className={s.form} method="get" action="/economy/engine">
        <label>{t.player}
          <input className={s.input} name="player" defaultValue={player} maxLength={40} autoComplete="off" placeholder={t.playerHint} />
        </label>
        <button className={s.btn} type="submit">{t.load}</button>
      </form>
      <EngineView ctx={ctx} nowMs={Date.now()} locale={locale} names={names} />
    </>
  );
}
