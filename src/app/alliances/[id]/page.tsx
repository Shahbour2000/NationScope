import Link from "next/link";
import { notFound } from "next/navigation";
import { ApiErrorState } from "@/components/ApiErrorState";
import { Icon } from "@/components/Icon";
import { Provenance } from "@/components/Provenance";
import { Tabs } from "@/components/Tabs";
import { Suspense } from "react";
import { OrgBuildsPanel } from "@/features/builds/BuildViews";
import { PinButton } from "@/features/pins/PinButton";
import { allianceAggregate } from "@/features/economy/analytics";
import { CountryBadge, Dt, Metric, Source, StatusBadge } from "@/features/entities/entities";
import { getDisplay } from "@/features/entities/display.server";
import { getLocale, getMessages } from "@/i18n";
import { getAlliances, getCountries, getWars } from "@/lib/data/world";

export const dynamic = "force-dynamic";

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
  return (
    <>
      <div className="page-head"><h1><Icon name="shield" size={26} /><span dir="auto">{alliance.name}</span></h1><StatusBadge value={alliance.status} d={d} /><PinButton labels={m.pins} target={{ type: "alliance", id: alliance.id, name: alliance.name, image: null, href: `/alliances/${encodeURIComponent(alliance.id)}` }} /></div>
      <Tabs items={tabs} label={alliance.name} />
      <div className="with-aside">
      <dl className="metrics">
        <Metric icon="landmark" label={a.leader} value={<CountryBadge id={alliance.leaderCountryId} d={d} />} />
        <Metric icon="trend" label={a.development} value={alliance.development == null ? d.m.ui.missing : nf.format(alliance.development)} hint={alliance.sharePercent == null ? undefined : `${alliance.sharePercent}% ${a.share}`} />
        <Metric icon="war" label={a.damageBonus} value={alliance.damageBonusPercent == null ? d.m.ui.missing : `+${alliance.damageBonusPercent}%`} hint={<Source kind="api" d={d} />} />
        <Metric icon="users" label={a.aggregate} value={nf.format(agg.citizens)} hint={<>{nf.format(agg.activeCitizens)} · {nf.format(agg.regions)} {a.regions} <Source kind="calc" d={d} /></>} />
      </dl>
      <Suspense fallback={<div className="skeleton" style={{ blockSize: "7rem" }} />}><OrgBuildsPanel countryIds={agg.members.map((c) => c.id)} m={m.builds} nl={d.nl} title={`${m.builds.title} · ${m.overview.activeCitizens}`} /></Suspense>
      </div>
      <p className="hint">{a.calculatedNote} {a.created}: <Dt iso={alliance.createdAt} d={d} /></p>

      <section className="card">
        <h2><Icon name="flag" size={18} />{a.memberCountries} <span className="chip">{agg.members.length}</span></h2>
        <div className="tablewrap">
          <table className="table">
            <thead><tr><th scope="col">{m.countriesPage.country}</th><th scope="col" className="num">{m.countriesPage.regions}</th><th scope="col" className="num">{m.countriesPage.development}</th><th scope="col" className="num">{m.countriesPage.citizens}</th></tr></thead>
            <tbody>
              {agg.members.sort((x, y) => (y.development ?? 0) - (x.development ?? 0)).map((c) => (
                <tr key={c.id}>
                  <td data-label={m.countriesPage.country}><CountryBadge id={c.id} d={d} />{c.id === alliance.leaderCountryId ? <span className="chip" style={{ marginInlineStart: "0.4rem" }}>{a.leader}</span> : null}</td>
                  <td className="num" data-label={m.countriesPage.regions}>{c.regions ?? "—"}</td>
                  <td className="num" data-label={m.countriesPage.development}>{c.development ?? "—"}</td>
                  <td className="num" data-label={m.countriesPage.citizens}>{c.citizens == null ? "—" : `${nf.format(c.activeCitizens ?? 0)} / ${nf.format(c.citizens)}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {agg.unresolved.length > 0 && <p className="hint">{a.unresolved}: {agg.unresolved.length}</p>}
      </section>

      <section className="card" style={{ marginBlockStart: "1rem" }}>
        <h2><Icon name="war" size={18} />{a.activeWars} <span className="chip">{agg.activeWars.length}</span> <Source kind="calc" d={d} /></h2>
        {agg.activeWars.length === 0 ? <p className="empty-mini">{a.noWars}</p> : (
          <ul className="list">
            {agg.activeWars.map((w) => <li key={w.id}><span className="compare"><CountryBadge id={w.countryA} d={d} /><span className="vs">{m.warsPage.versus}</span><CountryBadge id={w.countryB} d={d} /></span><Dt iso={w.declaredAt} d={d} /></li>)}
          </ul>
        )}
        <p className="hint"><Link href="/wars">{m.warsPage.title}</Link></p>
      </section>
      <p className="hint">{a.back}: <Link href="/alliances">{a.title}</Link></p>
      <Provenance meta={all.meta} m={m} />
    </>
  );
}
