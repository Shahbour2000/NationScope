import Link from "next/link";
import { ApiErrorState } from "@/components/ApiErrorState";
import { Icon } from "@/components/Icon";
import { Info } from "@/components/Info";
import { ProfileHeader } from "@/components/ProfileHeader";
import { Provenance } from "@/components/Provenance";
import { StateMessage } from "@/components/StateMessage";
import { BarList } from "@/features/charts/charts";
import { CountryBadge, RegionLink, Source, StatusBadge } from "@/features/entities/entities";
import { getDisplay } from "@/features/entities/display.server";
import { RemoteImage } from "@/features/entities/RemoteImage";
import { PinButton } from "@/features/pins/PinButton";
import { maxWeekly, summarizeMembers } from "@/features/units/profile";
import { UnitMembers, type MemberRow } from "@/features/units/UnitMembers";
import { getLocale, getMessages } from "@/i18n";
import { getUnitDetail } from "@/lib/data/units";
import { formatDuration } from "@/lib/format";

export const dynamic = "force-dynamic";
const unit_id_hint = (id: string): string => id;

export default async function UnitProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = getMessages(await getLocale());
  const u = m.unitPage;
  let res;
  try { res = await getUnitDetail(id); } catch (e) { return <><h1>{m.nav.units}</h1><ApiErrorState error={e} retryLabel={m.common.retry} /></>; }
  if (!res.unit) return <StateMessage tone="empty" title={u.notFound} detail={unit_id_hint(id)} />;
  const unit = res.unit;
  const d = await getDisplay();
  const nf = new Intl.NumberFormat(d.nl);
  const big = (v: string | null) => (v === null ? "—" : nf.format(BigInt(v)));

  const now = Date.now();
  const rows: MemberRow[] = unit.members.map((x) => {
    const ms = x.lastActiveAt ? now - Date.parse(x.lastActiveAt) : NaN;
    return { ...x, agoText: Number.isFinite(ms) ? (ms < 60_000 ? u.justNow : u.ago.replace("{t}", formatDuration(ms, d.m.time))) : null };
  });
  const s = summarizeMembers(unit.members);
  const max = maxWeekly(unit.members);
  const owner = unit.members.find((x) => x.id === unit.ownerId);
  const top = [...unit.members].filter((x) => x.weeklyDamage !== null).sort((a, b) => (BigInt(b.weeklyDamage!) > BigInt(a.weeklyDamage!) ? 1 : -1)).slice(0, 6);

  const stats = [
    { label: u.members, value: <>{s.count}{unit.capacity !== null ? <small> / {unit.capacity}</small> : null}</> },
    { label: u.online, value: s.onlineKnown > 0 ? s.online : "—", hint: s.onlineKnown > 0 ? <Source kind="api" d={d} /> : u.notProvided },
    { label: u.unitDamage, value: big(unit.stats?.totalDamage ?? null), hint: <Source kind="api" d={d} /> },
    { label: u.weekly, value: big(unit.stats?.weeklyDamage ?? null), hint: <Source kind="api" d={d} /> },
    ...(unit.stats?.tournamentWins != null ? [{ label: u.wins, value: unit.stats.tournamentWins }] : []),
  ];

  return (
    <>
      <ProfileHeader
        image={<RemoteImage src={unit.logoSrc} size={88} cls="phead-logo" fallback={<span className="phead-fallback" aria-hidden="true"><Icon name="unit" size={36} /></span>} />}
        kicker={<>{unit.countryId ? <CountryBadge id={unit.countryId} d={d} /> : null}{unit.regionId ? <RegionLink id={unit.regionId} d={d} /> : null}</>}
        title={unit.name}
        description={unit.description}
        badges={<>{unit.status ? <StatusBadge value={unit.status} d={d} /> : null}{unit.joinPolicy ? <span className="badge" data-tone="neutral">{(u.join as Record<string, string>)[unit.joinPolicy] ?? unit.joinPolicy}</span> : null}</>}
        actions={<PinButton labels={m.pins} target={{ type: "unit", id: unit.id, name: unit.name, image: unit.logoSrc, href: `/units/${encodeURIComponent(unit.id)}` }} />}
        stats={stats}
        statsLabel={u.overview}
      />
      {owner ? <p className="note">{(u.role as Record<string, string>).owner}: <Link href={`/players/${encodeURIComponent(owner.id)}`} dir="auto">{owner.name}</Link></p> : null}

      <div className="cols">
        <section className="card">
          <h2><Icon name="shield" size={18} />{u.hq} <Source kind="api" d={d} /></h2>
          <dl className="kvlist">
            <div><dt>{u.level}</dt><dd>{unit.hq.level ?? "—"}{unit.hq.max !== null ? <small> / {unit.hq.max} {u.maxLevel}</small> : null}</dd></div>
            <div><dt>{u.attackBonus}</dt><dd>{unit.hq.attackBonus ?? "—"}{unit.hq.nextAttackBonus !== null ? <small> → {unit.hq.nextAttackBonus} ({u.nextLevel})</small> : null}</dd></div>
          </dl>
          <h3 className="sub-h"><Icon name="users" size={16} />{u.dorm} <Source kind="api" d={d} /></h3>
          <dl className="kvlist">
            <div><dt>{u.level}</dt><dd>{unit.dorm.level ?? "—"}{unit.dorm.max !== null ? <small> / {unit.dorm.max} {u.maxLevel}</small> : null}</dd></div>
            <div><dt>{u.capacity}</dt><dd>{unit.dorm.capacity ?? "—"}{unit.dorm.nextCapacity !== null ? <small> → {unit.dorm.nextCapacity} ({u.nextLevel})</small> : null}</dd></div>
          </dl>
        </section>

        <section className="card">
          <h2><Icon name="flag" size={18} />{u.byCountry} <Source kind="calc" d={d} /></h2>
          {s.byCountry.length === 0 ? <p className="empty-mini">{u.noMembers}</p> : (
            <BarList ariaLabel={u.byCountry} rows={s.byCountry.map((c) => ({ key: c.countryId, label: <CountryBadge id={c.countryId} d={d} />, value: c.count, display: nf.format(c.count) }))} />
          )}
          <p className="hint">{u.calc}</p>
        </section>

        <section className="card">
          <h2><Icon name="trend" size={18} />{u.topWeekly} <Source kind="api" d={d} /></h2>
          {top.length === 0 ? <p className="empty-mini">{u.notProvided}</p> : (
            <BarList ariaLabel={u.topWeekly} rows={top.map((x) => ({ key: x.id, label: <span className="nm" title={x.name} dir="auto">{x.name}</span>, value: Number((BigInt(x.weeklyDamage!) * 1000n) / (max > 0n ? max : 1n)) / 10, display: nf.format(BigInt(x.weeklyDamage!)) }))} />
          )}
        </section>
      </div>

      <section className="card" style={{ marginBlockStart: "1rem" }} aria-labelledby="members-h">
        <h2 id="members-h"><Icon name="users" size={18} />{u.members} <span className="chip">{s.count}</span></h2>
        {rows.length === 0 ? <p className="empty-mini">{u.noMembers}</p> : <UnitMembers rows={rows} d={d} m={u} />}
        <p className="hint">{u.totalsNote}</p>
      </section>

      {unit.tournaments.length > 0 && (
        <section className="card" style={{ marginBlockStart: "1rem" }}>
          <h2><Icon name="trophy" size={18} />{u.tournaments}</h2>
          <ul className="list">
            {unit.tournaments.map((t) => (
              <li key={t.id}>
                <span dir="auto">{t.name ?? u.tournament}</span>
                <span className="kv">
                  {t.status ? <StatusBadge value={t.status} d={d} /> : null}
                  {t.won ? <span className="badge" data-tone="ok">{u.winner}</span> : t.runnerUp ? <span className="badge" data-tone="neutral">{u.runnerUp}</span> : t.result ? <span>{u.result}: {t.result}</span> : null}
                  {t.seed !== null ? <span>{u.seed} {t.seed}</span> : null}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Info title={u.availTitle}>
        <p>{u.availIntro}</p>
        <ul>{Object.values(u.avail).map((label) => <li key={label}>{label}: <b>{u.notProvided}</b></li>)}</ul>
      </Info>
      <Provenance meta={res.meta} m={m} />
    </>
  );
}
