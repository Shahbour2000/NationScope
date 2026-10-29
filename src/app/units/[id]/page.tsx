import Link from "next/link";
import { Suspense } from "react";
import { ApiErrorState } from "@/components/ApiErrorState";
import { Icon } from "@/components/Icon";
import { Info } from "@/components/Info";
import { ProfileHeader } from "@/components/ProfileHeader";
import { Provenance } from "@/components/Provenance";
import { RankList } from "@/components/RankList";
import { StateMessage } from "@/components/StateMessage";
import { BuildsSummaryView } from "@/features/builds/BuildViews";
import { summarizeBuilds } from "@/features/builds/classify";
import { CountryBadge, Flag, RegionLink, StatusBadge } from "@/features/entities/entities";
import { getDisplay } from "@/features/entities/display.server";
import type { Display } from "@/features/entities/display";
import { RemoteImage } from "@/features/entities/RemoteImage";
import { PinButton } from "@/features/pins/PinButton";
import { summarizeMembers } from "@/features/units/profile";
import { UnitMembers, type MemberRow } from "@/features/units/UnitMembers";
import { getLocale, getMessages } from "@/i18n";
import type { Messages } from "@/i18n/messages";
import { loadBuilds, type BuildLoad } from "@/lib/data/players";
import { getUnitDetail } from "@/lib/data/units";
import type { UnitProfile } from "@/lib/domain/unit-detail";
import { formatDuration } from "@/lib/format";

export const dynamic = "force-dynamic";
const skeleton = (h: string) => <div className="skeleton" style={{ blockSize: h }} />;

/** Build mix; awaits the shared (cached, capped) census promise so each profile is requested once per render. */
async function UnitBuilds({ unit, load, m, d }: { unit: UnitProfile; load: Promise<BuildLoad>; m: Messages; d: Display }) {
  const l = await load;
  return <BuildsSummaryView counts={summarizeBuilds(unit.members.map((x) => x.id), l.results)} m={m.builds} nl={d.nl} />;
}

async function UnitMembersSection({ unit, load, m, d }: { unit: UnitProfile; load: Promise<BuildLoad>; m: Messages; d: Display }) {
  const l = await load;
  const now = Date.now();
  const rows: MemberRow[] = unit.members.map((x) => {
    const ms = x.lastActiveAt ? now - Date.parse(x.lastActiveAt) : NaN;
    return { ...x, build: l.results.get(x.id)?.kind ?? null, agoText: Number.isFinite(ms) ? (ms < 60_000 ? m.unitPage.justNow : m.unitPage.ago.replace("{t}", formatDuration(ms, d.m.time))) : null };
  });
  return rows.length === 0 ? <p className="empty-mini">{m.unitPage.noMembers}</p> : <UnitMembers rows={rows} d={d} m={m.unitPage} b={m.builds} />;
}

export default async function UnitProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = getMessages(await getLocale());
  const u = m.unitPage;
  let res;
  try { res = await getUnitDetail(id); } catch (e) { return <><h1>{m.nav.units}</h1><ApiErrorState error={e} retryLabel={m.common.retry} /></>; }
  if (!res.unit) return <StateMessage tone="empty" title={u.notFound} detail={id} />;
  const unit = res.unit;
  const d = await getDisplay();
  const nf = new Intl.NumberFormat(d.nl);
  const compact = new Intl.NumberFormat(d.nl, { notation: "compact", maximumFractionDigits: 1 });
  const s = summarizeMembers(unit.members);
  const owner = unit.members.find((x) => x.id === unit.ownerId);
  const load = loadBuilds(unit.members.map((x) => x.id), { maxFetch: 30 });
  const top = [...unit.members].filter((x) => x.weeklyDamage !== null).sort((a, b) => (BigInt(b.weeklyDamage!) > BigInt(a.weeklyDamage!) ? 1 : -1)).slice(0, 5);

  return (
    <>
      <ProfileHeader
        image={<RemoteImage src={unit.logoSrc} size={88} cls="phead-logo" fallback={<span className="phead-fallback" aria-hidden="true"><Icon name="unit" size={36} /></span>} />}
        kicker={<>{unit.countryId ? <CountryBadge id={unit.countryId} d={d} /> : null}{unit.regionId ? <RegionLink id={unit.regionId} d={d} /> : null}{owner ? <Link href={`/players/${encodeURIComponent(owner.id)}`} className="nm-link" title={owner.name}><Icon name="user" size={14} /> {owner.name}</Link> : null}</>}
        title={unit.name}
        description={unit.description}
        badges={<>{unit.status ? <StatusBadge value={unit.status} d={d} /> : null}{unit.joinPolicy ? <span className="badge" data-tone="neutral">{(u.join as Record<string, string>)[unit.joinPolicy] ?? unit.joinPolicy}</span> : null}</>}
        actions={<PinButton labels={m.pins} target={{ type: "unit", id: unit.id, name: unit.name, image: unit.logoSrc, href: `/units/${encodeURIComponent(unit.id)}` }} />}
        statsLabel={u.overview}
        stats={[
          { label: u.members, value: <>{s.count}{unit.capacity !== null ? <small> / {unit.capacity}</small> : null}</> },
          { label: u.weekly, value: unit.stats?.weeklyDamage ? compact.format(Number(unit.stats.weeklyDamage)) : "—", hint: unit.stats?.weeklyDamage ? nf.format(BigInt(unit.stats.weeklyDamage)) : undefined },
          { label: u.unitDamage, value: unit.stats?.totalDamage ? compact.format(Number(unit.stats.totalDamage)) : "—", hint: unit.stats?.totalDamage ? nf.format(BigInt(unit.stats.totalDamage)) : undefined },
          ...(s.onlineKnown > 0 ? [{ label: u.online, value: s.online }] : []),
        ]}
      />

      <div className="cols">
        <section className="panel">
          <header><h2><Icon name="trophy" size={18} /> {u.topWeekly}</h2></header>
          {top.length === 0 ? <p className="empty-mini">{u.notProvided}</p> : (
            <RankList label={u.topWeekly} icon={<Icon name="flame" size={14} />}
              items={top.map((x, i) => ({ key: x.id, rank: i + 1, href: `/players/${encodeURIComponent(x.id)}`, name: x.name, value: compact.format(Number(x.weeklyDamage)), valueTitle: nf.format(BigInt(x.weeklyDamage!)),
                lead: <RemoteImage src={x.avatar} size={28} round fallback={<span className="seat-fallback" aria-hidden="true">{x.name.slice(0, 2).toUpperCase()}</span>} />,
                tail: x.countryId ? <span className="rk-flag"><Flag id={x.countryId} d={d} /></span> : null }))} />
          )}
        </section>
        <Suspense fallback={skeleton("10rem")}><UnitBuilds unit={unit} load={load} m={m} d={d} /></Suspense>
      </div>

      <section className="panel" style={{ marginBlockStart: "1rem" }} aria-labelledby="members-h">
        <header><h2 id="members-h"><Icon name="users" size={18} /> {u.members} <span className="chip">{s.count}</span></h2></header>
        <Suspense fallback={skeleton("14rem")}><UnitMembersSection unit={unit} load={load} m={m} d={d} /></Suspense>
        <p className="hint">{u.totalsNote}</p>
      </section>

      <details className="info more">
        <summary>{u.details}</summary>
        <div>
          <dl className="kvlist">
            <div><dt>{u.hq}</dt><dd>{unit.hq.level ?? "—"}{unit.hq.max !== null ? <small> / {unit.hq.max}</small> : null}{unit.hq.attackBonus !== null ? <small> · {u.attackBonus} {unit.hq.attackBonus}</small> : null}</dd></div>
            <div><dt>{u.dorm}</dt><dd>{unit.dorm.level ?? "—"}{unit.dorm.max !== null ? <small> / {unit.dorm.max}</small> : null}{unit.dorm.capacity !== null ? <small> · {u.capacity} {unit.dorm.capacity}</small> : null}</dd></div>
            {unit.stats?.tournamentWins != null ? <div><dt>{u.wins}</dt><dd>{unit.stats.tournamentWins}</dd></div> : null}
          </dl>
          {unit.tournaments.length > 0 ? (
            <ul className="list">{unit.tournaments.map((t) => <li key={t.id}><span dir="auto">{t.name ?? u.tournament}</span><span className="kv">{t.won ? <span className="badge" data-tone="ok">{u.winner}</span> : t.runnerUp ? <span className="badge" data-tone="neutral">{u.runnerUp}</span> : t.result ? <span>{u.result}: {t.result}</span> : null}</span></li>)}</ul>
          ) : null}
        </div>
      </details>
      <Info title={u.availTitle}>
        <p>{u.availIntro}</p>
        <ul>{Object.values(u.avail).map((label) => <li key={label}>{label}: <b>{u.notProvided}</b></li>)}</ul>
      </Info>
      <Provenance meta={res.meta} m={m} />
    </>
  );
}
