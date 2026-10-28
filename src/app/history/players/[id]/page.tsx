import Link from "next/link";
import { ApiErrorState } from "@/components/ApiErrorState";
import { Icon } from "@/components/Icon";
import { Info } from "@/components/Info";
import { ProfileHeader } from "@/components/ProfileHeader";
import { Provenance } from "@/components/Provenance";
import { StateMessage } from "@/components/StateMessage";
import { BuildBadge, ScoreBars } from "@/features/builds/BuildViews";
import { BUILD_RULES, classifyBuild } from "@/features/builds/classify";
import { CountryBadge } from "@/features/entities/entities";
import { getDisplay } from "@/features/entities/display.server";
import { RemoteImage } from "@/features/entities/RemoteImage";
import { PinButton } from "@/features/pins/PinButton";
import { getLocale, getMessages } from "@/i18n";
import { getPlayerProfile } from "@/lib/data/players";
import { humanizeCode } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function PlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = getMessages(await getLocale());
  const b = m.builds, u = m.unitPage;
  let res;
  try { res = await getPlayerProfile(id); } catch (e) { return <><h1>{m.nav.players}</h1><ApiErrorState error={e} retryLabel={m.common.retry} /></>; }
  if (!res.player) return <StateMessage tone="empty" title={u.notFound} detail={id} />;
  const p = res.player;
  const d = await getDisplay();
  const nf = new Intl.NumberFormat(d.nl);
  const big = (v: string | null) => (v === null ? "—" : nf.format(BigInt(v)));
  const build = p.hasSkills ? classifyBuild(p.skills) : null;
  const scored = new Set<string>([...BUILD_RULES.war, ...BUILD_RULES.eco]);
  const names = b.skills as Record<string, string>;
  const key = p.skills.filter((s) => scored.has(s.code) && s.maxLevel > 0 && s.level >= 0 && s.level <= s.maxLevel).sort((x, y) => y.level / y.maxLevel - x.level / x.maxLevel || x.code.localeCompare(y.code)).slice(0, 6);

  return (
    <>
      <ProfileHeader
        image={<RemoteImage src={p.avatar} size={88} cls="phead-logo" fallback={<span className="phead-fallback" aria-hidden="true"><Icon name="user" size={36} /></span>} />}
        kicker={<>{p.countryId ? <CountryBadge id={p.countryId} d={d} /> : null}{p.unit ? <Link href={`/units/${encodeURIComponent(p.unit.id)}`} title={p.unit.name} className="nm-link"><Icon name="unit" size={14} /> {p.unit.name}</Link> : null}{p.party ? <Link href={`/parties/${encodeURIComponent(p.party.id)}`} title={p.party.name} className="nm-link"><Icon name="landmark" size={14} /> {p.party.name}</Link> : null}</>}
        title={p.name}
        badges={<>{build ? <BuildBadge kind={build.kind} m={b} /> : null}{p.online !== null ? <span className="badge" data-tone={p.online ? "ok" : "neutral"}>{p.online ? u.onlineNow : u.offline}</span> : null}{p.rankCode ? <span className="badge" data-tone="neutral">{humanizeCode(p.rankCode)}</span> : null}</>}
        actions={<PinButton labels={m.pins} target={{ type: "player", id: p.id, name: p.name, image: p.avatar, href: `/players/${encodeURIComponent(p.id)}` }} />}
        statsLabel={p.name}
        stats={[
          ...(p.level !== null ? [{ label: u.level, value: p.level }] : []),
          ...(p.damage.day !== null ? [{ label: m.playerPage.daily, value: big(p.damage.day) }] : []),
          ...(p.damage.week !== null ? [{ label: u.weekly, value: big(p.damage.week) }] : []),
          ...(p.damage.total !== null ? [{ label: u.lifetime, value: big(p.damage.total) }] : []),
        ]}
      />
      <section className="panel builds" aria-label={b.title}>
        <header><h2><Icon name="flame" size={18} /> {b.title}</h2>{build ? <BuildBadge kind={build.kind} m={b} /> : null}</header>
        {!build ? <p className="empty-mini">{b.noSkills}</p> : (
          <div className="cols">
            <div>
              <ScoreBars result={build} m={b} />
              <p className="hint">{b.skillsEligible.replace("{n}", String(build.warEligible + build.ecoEligible))} · {b.provisional}</p>
            </div>
            <div>
              <h3 className="sub-h">{b.keySkills}</h3>
              <ul className="skilllist">
                {key.map((s) => (
                  <li key={s.code}><span>{names[s.code] ?? humanizeCode(s.code)}</span><span className="sbar" role="img" aria-label={`${s.level} / ${s.maxLevel}`}><span data-kind={(BUILD_RULES.eco as readonly string[]).includes(s.code) ? "eco" : "war"} style={{ inlineSize: `${(s.level / s.maxLevel) * 100}%` }} /></span><b>{s.level}<small> / {s.maxLevel}</small></b></li>
                ))}
              </ul>
            </div>
          </div>
        )}
        <Info title={b.methodTitle}><p>{b.method}</p></Info>
      </section>
      <Provenance meta={res.meta} m={m} />
    </>
  );
}
