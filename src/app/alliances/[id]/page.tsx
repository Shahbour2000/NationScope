import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ApiErrorState } from "@/components/ApiErrorState";
import { Icon } from "@/components/Icon";
import { Provenance } from "@/components/Provenance";
import { Tabs } from "@/components/Tabs";
import { OrgBuildsPanel } from "@/features/builds/BuildViews";
import { allianceAggregate } from "@/features/economy/analytics";
import { countryName, schemeColor } from "@/features/entities/display";
import { getDisplay } from "@/features/entities/display.server";
import { Flag, StatusBadge } from "@/features/entities/entities";
import { PinButton } from "@/features/pins/PinButton";
import { getLocale, getMessages } from "@/i18n";
import { getAlliances, getCountries, getWars } from "@/lib/data/world";
import s from "../alliances.module.css";

export const dynamic = "force-dynamic";
const safe = (v: string) => /^[A-Za-z0-9_-]{1,80}$/.test(v);

/** Built from the alliance list + country list + wars list (3 cached requests); the per-alliance endpoint's shape has not been captured yet. */
export default async function AllianceDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = getMessages(await getLocale());
  const a = m.alliancesPage;
  let all, countries, wars;
  try { [all, countries, wars] = await Promise.all([getAlliances(), getCountries(), getWars()]); } catch (e) { return <ApiErrorState error={e} retryLabel={m.common.retry} />; }
  const alliance = all.rows.find((x) => x.id === id);
  if (!alliance) notFound();
  const d = await getDisplay();
  const nf = new Intl.NumberFormat(d.nl);
  const agg = allianceAggregate(alliance, countries.countries, wars.rows);
  const base = `/alliances/${encodeURIComponent(id)}`;
  const tabs = [{ href: base, label: m.explorer.overviewTab, current: true }, { href: `${base}/laws`, label: a.laws, current: false }];
  const members = [...agg.members].sort((x, y) => (y.development ?? 0) - (x.development ?? 0));
  const totalDev = members.reduce((n, c) => n + (c.development ?? 0), 0);
  return (
    <>
      <div className="page-head"><h1><Icon name="shield" size={26} /><span dir="auto">{alliance.name}</span></h1><StatusBadge value={alliance.status} d={d} /><PinButton labels={m.pins} target={{ type: "alliance", id: alliance.id, name: alliance.name, image: null, href: base }} /></div>
      <Tabs items={tabs} label={alliance.name} />
      <section className={s.hero} style={{ ["--c" as string]: schemeColor(alliance.scheme) }}>
        {alliance.leaderCountryId && <div className={s.lead} style={{ marginBlockStart: 0 }}>{a.leader}<Flag id={alliance.leaderCountryId} d={d} />{countryName(alliance.leaderCountryId, d.dir)}</div>}
        <dl className={s.kpis}>
          <div><dt>{a.development}</dt><dd>{alliance.development == null ? "—" : nf.format(alliance.development)}{alliance.sharePercent != null && <small>{nf.format(alliance.sharePercent)}% {a.share}</small>}</dd></div>
          {alliance.damageBonusPercent != null && <div><dt>{a.damageBonus}</dt><dd style={{ color: "#f5c542" }}>+{nf.format(alliance.damageBonusPercent)}%</dd></div>}
          <div><dt>{a.memberCountries}</dt><dd>{nf.format(members.length)}</dd></div>
          <div><dt>{m.countriesPage.citizens}</dt><dd>{nf.format(agg.citizens)}<small>{nf.format(agg.activeCitizens)} · {nf.format(agg.regions)} {a.regions}</small></dd></div>
        </dl>
      </section>
      <div className={s.layout}>
        <div>
          <section className={s.sec}>
            <h2>{a.memberCountries} <small>{nf.format(members.length)}</small></h2>
            <ul className={s.list}>
              {members.map((c) => (
                <li key={c.id} className={s.member}>
                  <span className={s.who}>
                    <Flag id={c.id} d={d} />
                    {safe(c.id) ? <Link href={`/countries/${encodeURIComponent(c.id)}`} dir="auto">{countryName(c.id, d.dir)}</Link> : countryName(c.id, d.dir)}
                    {c.id === alliance.leaderCountryId && <span className={s.tag}>{a.leader}</span>}
                  </span>
                  <span className={s.dev}>
                    <span>{c.development == null ? "—" : nf.format(c.development)}</span>
                    <span className={s.track}><i style={{ inlineSize: `${totalDev > 0 ? ((c.development ?? 0) / totalDev) * 100 : 0}%` }} /></span>
                  </span>
                  <span className={s.ppl}>{c.citizens == null ? "—" : `${nf.format(c.activeCitizens ?? 0)} / ${nf.format(c.citizens)}`}</span>
                </li>
              ))}
            </ul>
            {agg.unresolved.length > 0 && <p style={{ color: "#7b87a3", fontSize: "0.82rem" }}>{a.unresolved}: {agg.unresolved.length}</p>}
          </section>
          <section className={s.sec} style={{ marginBlockStart: "1.6rem" }}>
            <h2>{a.activeWars} <small>{nf.format(agg.activeWars.length)}</small></h2>
            {agg.activeWars.length === 0 ? <p className={s.empty}>{a.noWars}</p> : (
              <div className={s.list}>
                {agg.activeWars.map((w) => (
                  <Link key={w.id} className={s.war} href={`/wars/${encodeURIComponent(w.id)}`}>
                    <span><Flag id={w.countryA} d={d} />{countryName(w.countryA, d.dir)}</span><span className={s.vs}>VS</span><span><Flag id={w.countryB} d={d} />{countryName(w.countryB, d.dir)}</span>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
        <Suspense fallback={<div className="skeleton" style={{ blockSize: "7rem" }} />}><OrgBuildsPanel countryIds={agg.members.map((c) => c.id)} m={m.builds} nl={d.nl} title={`${m.builds.title} · ${m.overview.activeCitizens}`} /></Suspense>
      </div>
      <Provenance meta={all.meta} m={m} />
    </>
  );
}
