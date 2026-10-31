import Link from "next/link";
import { ApiErrorState } from "@/components/ApiErrorState";
import { Icon } from "@/components/Icon";
import { Info } from "@/components/Info";
import { ProfileHeader } from "@/components/ProfileHeader";
import { Provenance } from "@/components/Provenance";
import { StateMessage } from "@/components/StateMessage";
import { BuildBadge, ScoreBars } from "@/features/builds/BuildViews";
import { classifyBuild } from "@/features/builds/classify";
import { groupSkills, type SkillGroup } from "@/features/builds/skills";
import { CountryBadge, Dt, RegionLink } from "@/features/entities/entities";
import { getDisplay } from "@/features/entities/display.server";
import { RemoteImage } from "@/features/entities/RemoteImage";
import { PinButton } from "@/features/pins/PinButton";
import { getLocale, getMessages } from "@/i18n";
import { getPlayerCompanies } from "@/lib/data/economy";
import { getPlayerProfile } from "@/lib/data/players";
import { getGovernmentHistory } from "@/lib/data/world";
import { PlayerTimeline, type TimelineItem } from "@/features/players/PlayerTimeline";
import { buildTimeline } from "@/features/players/timeline";
import { formatDateTime, humanizeCode } from "@/lib/format";
import { countryName, term } from "@/features/entities/display";

export const dynamic = "force-dynamic";

export default async function PlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = getMessages(await getLocale());
  const b = m.builds, u = m.unitPage, pp = m.playerPage;
  let res;
  try { res = await getPlayerProfile(id); } catch (e) { return <><h1>{m.nav.players}</h1><ApiErrorState error={e} retryLabel={m.common.retry} /></>; }
  if (!res.player) return <StateMessage tone="empty" title={u.notFound} detail={id} />;
  const p = res.player;
  const d = await getDisplay();
  const nf = new Intl.NumberFormat(d.nl);
  const big = (v: string | null) => (v === null ? "—" : nf.format(BigInt(v)));
  const build = p.hasSkills ? classifyBuild(p.skills) : null;
  const groups = groupSkills(p.skills);
  const names = b.skills as Record<string, string>;
  const groupTitle: Record<SkillGroup["key"], string> = { war: pp.combatSkills, eco: pp.ecoSkills, shared: pp.neutralSkills, other: pp.otherSkills };
  // Optional section: a failure here must never break the profile, so it simply stays hidden.
  const companies = await getPlayerCompanies(p.id, { limit: 6 }).catch(() => null);
  const history = p.countryId ? await getGovernmentHistory(p.countryId).catch(() => null) : null;
  const events = buildTimeline({ userId: p.id, joinedAt: p.joinedAt, countryId: p.countryId, history: history?.rows ?? [] });
  const when = (iso: string) => formatDateTime(iso, d.nl, d.m.time.utc) ?? d.m.ui.missing;
  const items: TimelineItem[] = events.map((e) => e.kind === "account"
    ? { id: e.id, kind: e.kind, title: pp.accountCreated, when: when(e.startedAt), lines: [] }
    : { id: e.id, kind: e.kind, title: term("role", e.code, d), when: when(e.startedAt), lines: [
        ...(e.countryId ? [{ label: pp.countryLabel, value: countryName(e.countryId, d.dir) }] : []),
        { label: pp.startedLabel, value: when(e.startedAt) },
        { label: pp.endedLabel, value: e.endedAt ? when(e.endedAt) : pp.ongoing },
        ...(e.source ? [{ label: pp.sourceLabel, value: (pp.source as Record<string, string>)[e.source] ?? humanizeCode(e.source) }] : []),
        ...(e.endReason ? [{ label: pp.reasonLabel, value: humanizeCode(e.endReason) }] : []),
      ] });

  const skillList = (g: SkillGroup) => (
    <ul className="skilllist">
      {g.skills.map((s) => (
        <li key={s.code}><span>{names[s.code] ?? humanizeCode(s.code)}</span><span className="sbar" role="img" aria-label={`${s.level} / ${s.maxLevel}`}><span data-kind={g.key === "eco" ? "eco" : g.key === "war" ? "war" : "hybrid"} style={{ inlineSize: `${s.pct}%` }} /></span><b>{s.level}<small> / {s.maxLevel}</small></b></li>
      ))}
    </ul>
  );
  const primary = groups.filter((g) => g.key === "war" || g.key === "eco");
  const secondary = groups.filter((g) => g.key === "shared" || g.key === "other");
  const damageCells = [
    { label: pp.daily, v: p.damage.day }, { label: u.weekly, v: p.damage.week }, { label: pp.monthly, v: p.damage.month }, { label: u.lifetime, v: p.damage.total },
  ].filter((x) => x.v !== null);

  return (
    <>
      <ProfileHeader
        image={<RemoteImage src={p.avatar} size={88} cls="phead-logo" fallback={<span className="phead-fallback" aria-hidden="true"><Icon name="user" size={36} /></span>} />}
        kicker={<>{p.countryId ? <CountryBadge id={p.countryId} d={d} /> : null}{p.unit ? <Link href={`/units/${encodeURIComponent(p.unit.id)}`} title={p.unit.name} className="nm-link"><Icon name="unit" size={14} /> {p.unit.name}</Link> : null}{p.party ? <Link href={`/parties/${encodeURIComponent(p.party.id)}`} title={p.party.name} className="nm-link"><Icon name="landmark" size={14} /> {p.party.name}</Link> : null}</>}
        title={p.name}
        badges={<>{build?.kind ? <BuildBadge kind={build.kind} m={b} /> : null}{p.online !== null ? <span className="badge" data-tone={p.online ? "ok" : "neutral"}>{p.online ? u.onlineNow : u.offline}</span> : null}{p.rankCode ? <span className="badge" data-tone="neutral">{humanizeCode(p.rankCode)}</span> : null}</>}
        actions={<PinButton labels={m.pins} target={{ type: "player", id: p.id, name: p.name, image: p.avatar, href: `/players/${encodeURIComponent(p.id)}` }} />}
        statsLabel={p.name}
        stats={[
          ...(p.level !== null ? [{ label: u.level, value: p.level }] : []),
          ...damageCells.map((x) => ({ label: x.label, value: big(x.v) })),
        ]}
      />

      <div className="cols">
        <section className="panel builds" aria-label={b.title}>
          <header><h2><Icon name="flame" size={18} /> {b.title}</h2>{build?.kind ? <BuildBadge kind={build.kind} m={b} /> : null}</header>
          {!build ? <p className="empty-mini">{b.noSkills}</p> : (
            <>
              <ScoreBars result={build} m={b} nl={d.nl} />
              <p className="hint">{b.skillsEligible.replace("{n}", String(build.warEligible + build.ecoEligible))} · {b.provisional}</p>
            </>
          )}
          <Info title={b.methodTitle}><p>{b.method}</p></Info>
        </section>

        <section className="panel" aria-label={pp.activity}>
          <header><h2><Icon name="user" size={18} /> {pp.activity}</h2></header>
          <dl className="kvlist">
            {p.rankCode ? <div><dt>{pp.rank}</dt><dd>{humanizeCode(p.rankCode)}</dd></div> : null}
            {p.joinedAt ? <div><dt>{pp.joined}</dt><dd><Dt iso={p.joinedAt} d={d} /></dd></div> : null}
            {p.lastActiveAt ? <div><dt>{pp.lastActive}</dt><dd><Dt iso={p.lastActiveAt} d={d} /></dd></div> : null}
            {p.unit?.role ? <div><dt>{pp.unitRole}</dt><dd>{humanizeCode(p.unit.role)}</dd></div> : null}
            {p.party?.role ? <div><dt>{pp.partyRole}</dt><dd>{humanizeCode(p.party.role)}</dd></div> : null}
          </dl>
          {!p.rankCode && !p.joinedAt && !p.lastActiveAt && !p.unit?.role && !p.party?.role ? <p className="empty-mini">{pp.noActivity}</p> : null}
        </section>
      </div>

      <section className="panel" aria-label={pp.timeline} style={{ marginBlockStart: "1rem" }}>
        <header><h2><Icon name="clock" size={18} /> {pp.timeline}</h2></header>
        {items.length === 0 ? <p className="empty-mini">{pp.timelineEmpty}</p> : <PlayerTimeline items={items} label={pp.timeline} />}
        <p className="hint">{pp.timelineNote}</p>
      </section>

      {primary.length > 0 ? (
        <section className="panel" aria-label={pp.skillsTitle}>
          <header><h2><Icon name="shield" size={18} /> {pp.skillsTitle}</h2></header>
          <div className="cols" style={{ marginBlock: 0 }}>
            {primary.map((g) => (
              <div key={g.key}>
                <h3 className="sub-h">{groupTitle[g.key]} <small className="muted">{nf.format(g.levels)} / {nf.format(g.capacity)}</small></h3>
                {skillList(g)}
              </div>
            ))}
          </div>
          {secondary.length > 0 ? (
            <details>
              <summary>{pp.moreSkills}</summary>
              {secondary.map((g) => <div key={g.key}><h3 className="sub-h">{groupTitle[g.key]}</h3>{skillList(g)}</div>)}
              <p className="hint">{pp.neutralNote}</p>
            </details>
          ) : null}
        </section>
      ) : null}

      {companies && companies.rows.length > 0 ? (
        <section className="panel" aria-label={pp.companies}>
          <header><h2><Icon name="factory" size={18} /> {pp.companies}{companies.total !== null ? <span className="count-pill">{nf.format(companies.total)}</span> : null}</h2></header>
          <ul className="complist">
            {companies.rows.map((c) => (
              <li key={c.id}>
                <b dir="auto" title={c.name}>{c.name}</b>
                <span>{humanizeCode(c.itemCode)}{c.level != null ? ` · ${u.level} ${nf.format(c.level)}` : ""}{c.workers != null ? ` · ${nf.format(c.workers)} ${pp.workers}` : ""}</span>
                {c.regionId ? <span className="muted"><RegionLink id={c.regionId} d={d} /></span> : null}
              </li>
            ))}
          </ul>
          {companies.total !== null && companies.total > companies.rows.length ? <p className="hint">{pp.topByLevel.replace("{n}", String(companies.rows.length))}</p> : null}
        </section>
      ) : null}
      <Provenance meta={res.meta} m={m} />
    </>
  );
}
