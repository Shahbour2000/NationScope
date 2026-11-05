import { ApiErrorState } from "@/components/ApiErrorState";
import { Provenance } from "@/components/Provenance";
import { Tabs } from "@/components/Tabs";
import { countryTabs } from "@/features/countries/tabs";
import { SubHead } from "@/features/countries/SubHead";
import { getDisplay } from "@/features/entities/display.server";
import { BattleList } from "@/features/wars/BattlesBoard";
import { isBattleOngoing } from "@/features/wars/state";
import { getLocale, getMessages } from "@/i18n";
import { getCountryBattles } from "@/lib/data/world";
import s from "@/features/countries/sub.module.css";

export const dynamic = "force-dynamic";

export default async function CountryBattlesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = getMessages(await getLocale());
  const t = m.countrySubs.events;
  const tabs = countryTabs(id, m, "battles");
  let res;
  try { res = await getCountryBattles(id); } catch (e) { return <><h1>{m.nav.battles}</h1><Tabs items={tabs} label={m.nav.battles} /><ApiErrorState error={e} retryLabel={m.common.retry} /></>; }
  const d = await getDisplay();
  const nowMs = Date.now();
  const live = res.rows.filter(isBattleOngoing).sort((a, b) => (b.startedAt ?? "").localeCompare(a.startedAt ?? ""));
  const done = res.rows.filter((b) => !isBattleOngoing(b)).sort((a, b) => (b.endedAt ?? b.startedAt ?? "").localeCompare(a.endedAt ?? a.startedAt ?? ""));
  return (
    <>
      <SubHead id={id} title={m.nav.battles} tabs={tabs} d={d} />
      {res.rows.length === 0 && <p className={s.empty}>{m.battlesPage.emptyLive}</p>}
      {live.length > 0 && <section className={s.sec} style={{ marginBlockStart: "1.3rem" }}><h2>{t.live} <small>{live.length}</small></h2><BattleList rows={live} d={d} m={m.battlesPage} nowMs={nowMs} /></section>}
      {done.length > 0 && <section className={s.sec} style={{ marginBlockStart: "1.6rem" }}><h2>{t.finished} <small>{done.length}</small></h2><BattleList rows={done} d={d} m={m.battlesPage} nowMs={nowMs} /></section>}
      <Provenance meta={res.meta} m={m} />
    </>
  );
}
