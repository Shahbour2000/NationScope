import Link from "next/link";
import { ApiErrorState } from "@/components/ApiErrorState";
import { Provenance } from "@/components/Provenance";
import { Tabs } from "@/components/Tabs";
import { countryTabs } from "@/features/countries/tabs";
import { SubHead } from "@/features/countries/SubHead";
import { getDisplay } from "@/features/entities/display.server";
import { Money } from "@/features/entities/entities";
import { getLocale, getMessages } from "@/i18n";
import { getRevolution } from "@/lib/data/world";
import s from "@/features/countries/sub.module.css";

export const dynamic = "force-dynamic";

export default async function RevolutionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = getMessages(await getLocale());
  const t = m.countrySubs.revolution;
  const tabs = countryTabs(id, m, "revolution");
  let r;
  try { r = await getRevolution(id); } catch (e) { return <><h1>{t.title}</h1><Tabs items={tabs} label={t.title} /><ApiErrorState error={e} retryLabel={m.common.retry} /></>; }
  const d = await getDisplay();
  const nf = new Intl.NumberFormat(d.nl);
  const hours = (n: number | null) => (n === null ? "—" : t.cooldownH.replace("{n}", nf.format(n)));
  const pct = r.unrest !== null && r.max ? Math.min(100, (r.unrest / r.max) * 100) : 0;
  const flags = [r.governmentFrozen ? t.frozen : null, r.bordersOpen ? t.bordersOpen : null, !r.hasPresident ? t.presidentless : null].filter((x): x is string => !!x);
  return (
    <>
      <SubHead id={id} title={t.title} tabs={tabs} d={d} />
      {r.unrest !== null && r.max !== null && (
        <section className={s.unrest} aria-label={t.unrest}>
          <header><b>{nf.format(r.unrest)}<small> / {nf.format(r.max)}</small></b><span className={s.state} data-hot={r.full || r.battleId !== null}>{r.battleId ? t.fighting : r.full ? t.full : r.unrest === 0 ? t.ready : t.unrest}</span></header>
          <div className={s.track}><i style={{ inlineSize: `${pct}%` }} /></div>
        </section>
      )}
      {r.battleId && <p style={{ marginBlockStart: "0.8rem" }}><Link href={`/battles/${encodeURIComponent(r.battleId)}`} style={{ color: "#19c8ff" }}>{t.openBattle}</Link></p>}
      {flags.length > 0 && <div className={s.flags}>{flags.map((f) => <span key={f}>{f}</span>)}</div>}
      <dl className={s.facts}>
        {r.activeCitizens !== null && <div><dt>{t.active}</dt><dd>{nf.format(r.activeCitizens)}</dd></div>}
        {r.minLevel !== null && <div><dt>{t.minLevel}</dt><dd>{nf.format(r.minLevel)}</dd></div>}
        {r.launchCost && <div><dt>{t.launch}</dt><dd><Money value={r.launchCost} d={d} /></dd></div>}
        {r.contribution !== null && <div><dt>{t.contribute}</dt><dd>{nf.format(r.contribution)}</dd></div>}
        {r.battleCooldownHours !== null && <div><dt>{t.battleCooldown}</dt><dd>{hours(r.battleCooldownHours)}</dd></div>}
        {r.dailyDecayPercent !== null && <div><dt>{t.decay}</dt><dd>{nf.format(r.dailyDecayPercent)}%</dd></div>}
      </dl>
      {r.recentEvents === 0 && !r.lastRevolutionAt && <p className={s.empty} style={{ textAlign: "start", paddingBlock: "1.4rem 0" }}>{t.noRevolution}</p>}
      <Provenance meta={r.meta} m={m} />
    </>
  );
}
