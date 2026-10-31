import Link from "next/link";
import { notFound } from "next/navigation";
import { ApiErrorState } from "@/components/ApiErrorState";
import { DiscordButton } from "@/components/DiscordButton";
import { Icon } from "@/components/Icon";
import { Provenance } from "@/components/Provenance";
import { Tabs } from "@/components/Tabs";
import { ApiError } from "@/lib/api/errors";
import { LineChart } from "@/features/charts/charts";
import { Suspense } from "react";
import { OrgBuildsPanel } from "@/features/builds/BuildViews";
import { leadershipHolders } from "@/features/government/roles";
import { PinButton } from "@/features/pins/PinButton";
import { flagSrc } from "@/lib/flags";
import { countryTabs } from "@/features/countries/tabs";
import { warDurationMs } from "@/features/economy/analytics";
import { CountryBadge, Dt, ItemChip, Metric, Money, PlayerChip, RegionLink, Source, StatusBadge } from "@/features/entities/entities";
import { term } from "@/features/entities/display";
import { getDisplay } from "@/features/entities/display.server";
import { getLocale, getMessages } from "@/i18n";
import { getCountryCounts, getCountrySummary } from "@/lib/data/world";
import { parseRows } from "@/lib/domain/parse";
import { battleSchema } from "@/lib/domain/world";
import { formatDuration, humanizeCode, percent } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function CountryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = getMessages(await getLocale());
  let res;
  try { res = await getCountrySummary(id); } catch (e) {
    if (e instanceof ApiError && e.kind === "http" && e.status === 404) notFound();
    return <ApiErrorState error={e} retryLabel={m.common.retry} />;
  }
  if (!res.summary) return <ApiErrorState error={new ApiError("validation", "Unexpected response")} retryLabel={m.common.retry} />;
  const { summary, meta } = res;
  const p = summary.profile;

  const regionNames: Record<string, string> = {};
  for (const r of p.coreRegions ?? []) regionNames[r.id] = r.name;
  for (const r of p.controlledRegions ?? []) regionNames[r.id] = r.name;
  const d = await getDisplay({ regionNames });
  const c = m.countryProfile;
  const nf = new Intl.NumberFormat(d.nl);
  const now = Date.now();

  const coreRegions = p.coreRegions ?? [];
  const coreHeld = coreRegions.filter((r) => !r.lost).length;
  const holders = leadershipHolders(p.government?.holders ?? []);
  const congress = (p.government?.holders ?? []).filter((h) => h.role === "congress").length;
  const battles = parseRows(summary.battles, battleSchema).rows;
  const hist = (p.developmentHistory ?? []).map((h) => ({ label: h.dayKey, value: h.development }));
  const base = `/countries/${encodeURIComponent(id)}`;
  const counts = await getCountryCounts(id);
  const tabs = countryTabs(id, m, "overview", { citizens: p.citizens?.total ?? null, wars: (p.wars ?? []).length, battles: battles.length, companies: counts.companies, units: counts.units });
  const pc = (k: string) => (d.m.t.effect as Record<string, string>)[k] ?? humanizeCode(k);

  return (
    <>
      <div className="page-head">
        <h1><CountryBadge id={p.id} d={d} link={false} /></h1>
        <PinButton labels={m.pins} target={{ type: "country", id: p.id, name: p.name, image: flagSrc(p.id), href: `/countries/${encodeURIComponent(p.id)}` }} />
        {p.alliance && <Link className="badge" data-tone="neutral" href={`/alliances/${encodeURIComponent(p.alliance.allianceId)}`}><Icon name="shield" size={13} /> {p.alliance.name}</Link>}
        {p.discordUrl && /^https:\/\/discord\.(gg|com)\//.test(p.discordUrl) && <DiscordButton href={p.discordUrl} label={c.discord} />}
      </div>
      <Tabs items={tabs} label={p.name} />

      <div className="with-aside">
      <dl className="metrics">
        <Metric icon="trend" label={c.development} value={p.development == null ? d.m.ui.missing : nf.format(p.development)} hint={p.worldSharePercent == null ? undefined : <>{p.worldSharePercent}% {c.worldShare} <Source kind="api" d={d} /></>} />
        <Metric icon="users" label={c.citizens} value={p.citizens?.total == null ? d.m.ui.missing : nf.format(p.citizens.total)} hint={p.citizens?.active == null ? undefined : `${nf.format(p.citizens.active)} ${c.activeOf} ${nf.format(p.citizens.total ?? 0)}`} />
        <Metric icon="map" label={c.regions} value={p.controlledRegions ? nf.format(p.controlledRegions.length) : d.m.ui.missing} hint={coreRegions.length ? `${coreHeld}/${coreRegions.length} ${c.coreHeld} (${percent(coreHeld, coreRegions.length)}%)` : undefined} />
        <Metric icon="landmark" label={c.treasury} value={<Money value={p.treasury?.money} d={d} />} />
        {p.enemy && <Metric icon="war" label={c.enemyCountry} value={<span className="rival"><CountryBadge id={p.enemy.countryId} d={d} /></span>} />}
        <Metric icon="coins" label={c.revenueToday} value={<Money value={p.taxes?.revenueToday} d={d} />} hint={<>{c.revenueYesterday}: <Money value={p.taxes?.revenueYesterday} d={d} /></>} />
      </dl>
      <Suspense fallback={<div className="skeleton" style={{ blockSize: "7rem" }} />}><OrgBuildsPanel countryIds={[p.id]} m={m.builds} nl={d.nl} title={`${m.builds.title} · ${m.overview.activeCitizens}`} /></Suspense>
      </div>

      {hist.length >= 2 && (
        <section className="card">
          <h2><Icon name="chart" size={18} />{c.developmentHistory}</h2>
          <LineChart points={hist} ariaLabel={c.developmentHistory} format={(n) => nf.format(n)} />
          <p className="hint">{c.historyNote}</p>
        </section>
      )}

      <div className="cols">
        <section className="card">
          <h2><Icon name="landmark" size={18} />{c.government}</h2>
          {holders.length === 0 ? <p className="empty-mini">{c.noItems}</p> : (
            <ul className="list">
              {holders.map((h) => (
                <li key={`${h.role}-${h.userId ?? h.username}`}>
                  <PlayerChip id={h.userId} name={h.username ?? d.m.ui.missing} avatar={h.avatarUrl} d={d} />
                  <span className="badge" data-tone="neutral">{term("role", h.role, d)}</span>
                </li>
              ))}
            </ul>
          )}
          {congress > 0 && <p className="hint"><Link href={`${base}/members`}>{term("role", "congress", d)}: {congress}</Link></p>}
        </section>

        <section className="card">
          <h2><Icon name="flag" size={18} />{c.rulingParty}</h2>
          {p.rulingParty ? (
            <>
              <p style={{ margin: 0 }}><Link href={`/parties/${encodeURIComponent(p.rulingParty.id)}`}>{p.rulingParty.name}</Link></p>
              <div className="stat-chips" style={{ marginBlock: "0.5rem" }}>
                {(p.rulingParty.choices ?? []).map((ch) => <span key={ch} className="chip">{humanizeCode(ch.replace(":", " "))}</span>)}
              </div>
              <ul className="list">
                {Object.entries(p.rulingParty.effects ?? {}).filter(([, v]) => v !== 0).map(([k, v]) => (
                  <li key={k}><span>{pc(k)}</span><b>{v > 0 ? "+" : ""}{v}%</b></li>
                ))}
              </ul>
            </>
          ) : <p className="empty-mini">{c.noItems}</p>}
        </section>

        <section className="card">
          <h2><Icon name="coins" size={18} />{c.taxes}</h2>
          <ul className="list">
            <li><span>{c.taxIncome}</span><b>{p.taxes?.income ?? "—"}%</b></li>
            <li><span>{c.taxMarket}</span><b>{p.taxes?.market ?? "—"}%</b></li>
            <li><span>{c.taxSelfWork}</span><b>{p.taxes?.selfWork ?? "—"}%</b></li>
            <li><span>{c.taxProduction}</span><b>{p.taxes?.production ?? "—"}%</b></li>
            <li><span>{c.taxMax}</span><b>{p.taxes?.max ?? "—"}%</b></li>
          </ul>
        </section>

        <section className="card">
          <h2><Icon name="box" size={18} />{c.resources}</h2>
          {Object.keys(p.treasury?.resources ?? {}).length === 0 ? <p className="empty-mini">{c.noItems}</p> : (
            <ul className="list">
              {Object.entries(p.treasury?.resources ?? {}).sort((a, b) => b[1] - a[1]).map(([code, qty]) => (
                <li key={code}><ItemChip code={code} d={d} /><b>{nf.format(qty)}</b></li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="cols">
        <section className="card">
          <h2><Icon name="war" size={18} />{c.wars} <span className="chip">{(p.wars ?? []).length}</span></h2>
          {(p.wars ?? []).length === 0 ? <p className="empty-mini">{c.noWars}</p> : (
            <ul className="list">
              {(p.wars ?? []).map((w) => (
                <li key={w.id}>
                  <CountryBadge id={w.otherCountryId} d={d} />
                  <span className="kv"><span>{c.declaredBy}: <CountryBadge id={w.declaredBy} d={d} link={false} /></span><span><Dt iso={w.declaredAt} d={d} /></span>
                    {warDurationMs({ declaredAt: w.declaredAt, endedAt: null }, now) !== null && <span>{formatDuration(warDurationMs({ declaredAt: w.declaredAt, endedAt: null }, now)!, d.m.time)} <Source kind="calc" d={d} /></span>}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <h2><Icon name="battle" size={18} />{c.battles} <span className="chip">{battles.length}</span></h2>
          {battles.length === 0 ? <p className="empty-mini">{c.noBattles}</p> : (
            <ul className="list">
              {battles.map((b) => (
                <li key={b.id}>
                  <span className="compare"><CountryBadge id={b.attackerCountryId} d={d} /><span className="vs">{m.warsPage.versus}</span><CountryBadge id={b.defenderCountryId} d={d} /></span>
                  <span className="kv"><RegionLink id={b.regionId} d={d} /><StatusBadge value={b.status} d={d} /><StatusBadge value={b.type} group="battleType" d={d} />
                    {b.round?.attackerPoints != null && <span>{b.round.attackerPoints} – {b.round.defenderPoints ?? 0}</span>}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <h2><Icon name="shield" size={18} />{c.allianceAndPacts}</h2>
          {p.alliance ? <p style={{ marginTop: 0 }}><Link href={`/alliances/${encodeURIComponent(p.alliance.allianceId)}`}>{p.alliance.name}</Link> <StatusBadge value={p.alliance.status} d={d} /> <span className="hint">{c.joined}: <Dt iso={p.alliance.joinedAt} d={d} /></span></p> : null}
          <h3 style={{ fontSize: "0.9rem", color: "var(--muted)" }}>{c.pacts}</h3>
          {(p.pacts ?? []).length === 0 ? <p className="empty-mini">{c.noItems}</p> : (
            <ul className="list">{(p.pacts ?? []).map((x) => <li key={x.id}><CountryBadge id={x.otherCountryId} d={d} /><span className="kv"><StatusBadge value={x.status} d={d} /><Dt iso={x.startsAt} d={d} /></span></li>)}</ul>
          )}
        </section>

        <section className="card">
          <h2><Icon name="globe" size={18} />{c.embassies}</h2>
          <h3 style={{ fontSize: "0.9rem", color: "var(--muted)" }}>{c.abroad}</h3>
          <div className="stat-chips">{(summary.embassies?.abroad ?? []).map((e) => <span key={e.countryId} className="ichip"><CountryBadge id={e.countryId} d={d} />{e.mutual ? <span className="badge" data-tone="good">{c.mutual}</span> : null}</span>)}{(summary.embassies?.abroad ?? []).length === 0 && <span className="empty-mini">{c.noItems}</span>}</div>
          <h3 style={{ fontSize: "0.9rem", color: "var(--muted)" }}>{c.hosted}</h3>
          <div className="stat-chips">{(summary.embassies?.hosted ?? []).map((e) => <span key={e.countryId} className="ichip"><CountryBadge id={e.countryId} d={d} />{e.mutual ? <span className="badge" data-tone="good">{c.mutual}</span> : null}</span>)}{(summary.embassies?.hosted ?? []).length === 0 && <span className="empty-mini">{c.noItems}</span>}</div>
        </section>
      </div>

      <div className="cols">
        <section className="card">
          <h2><Icon name="flag" size={18} />{c.coreRegionsTitle}</h2>
          <ul className="list">
            {coreRegions.map((r) => (
              <li key={r.id}>
                <span><RegionLink id={r.id} d={d} />{r.isCapital ? <span className="chip" style={{ marginInlineStart: "0.4rem" }}>{c.capitalRegion}</span> : null}</span>
                <span className="kv">{r.lost ? <span className="badge" data-tone="bad">{c.controlledBy} <CountryBadge id={r.controlledBy} d={d} link={false} /></span> : <span className="badge" data-tone="good">{m.countriesPage.held}</span>}{r.development != null && <span>{nf.format(r.development)}</span>}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="card">
          <h2><Icon name="map" size={18} />{c.controlledRegions} <span className="chip">{(p.controlledRegions ?? []).length}</span></h2>
          <details>
            <summary>{c.viewAll}</summary>
            <ul className="list" style={{ marginBlockStart: "0.5rem" }}>
              {(p.controlledRegions ?? []).map((r) => (
                <li key={r.id}><RegionLink id={r.id} d={d} /><span className="kv">{r.occupied ? <span className="badge" data-tone="muted">{c.occupied}: <CountryBadge id={r.coreCountryId} d={d} link={false} /></span> : null}{r.development != null && <span>{nf.format(r.development)}</span>}</span></li>
              ))}
            </ul>
          </details>
        </section>

        <section className="card">
          <h2><Icon name="scale" size={18} />{c.elections}</h2>
          {(summary.elections?.finished ?? []).length === 0 ? <p className="empty-mini">{c.noItems}</p> : (
            <ul className="list">
              {(summary.elections?.finished ?? []).slice(0, 4).map((e) => (
                <li key={e.id}>
                  <span><b>{e.label ?? humanizeCode(e.kind ?? "")}</b> <span className="hint"><Dt iso={e.finishedAt} d={d} /></span></span>
                  <span className="kv">{e.seats != null && <span>{e.seats} {c.seats}</span>}<span className="stat-chips">{(e.winners ?? []).slice(0, 3).map((w) => <PlayerChip key={w.userId} id={w.userId} name={w.username} d={d} />)}</span></span>
                </li>
              ))}
            </ul>
          )}
          <p className="hint"><Link href={`${base}/elections`}>{c.moreTabs}</Link></p>
        </section>
      </div>

      <Provenance meta={meta} m={m} note={`${m.ui.fromApi}: ${m.ui.live}. ${m.ui.calculated}: ${c.wars} / ${c.developmentHistory}.`} />
      {summary.generatedAt && <p className="provenance">{m.common.receivedAt}: <Dt iso={summary.generatedAt} d={d} /></p>}
    </>
  );
}
