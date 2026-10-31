import Link from "next/link";
import { ApiErrorState } from "@/components/ApiErrorState";
import { Icon } from "@/components/Icon";
import { Provenance } from "@/components/Provenance";
import { Tabs } from "@/components/Tabs";
import { countryTabs } from "@/features/countries/tabs";
import { CountryBadge, Metric } from "@/features/entities/entities";
import { term } from "@/features/entities/display";
import { getDisplay } from "@/features/entities/display.server";
import { Parliament, type MemberDto } from "@/features/government/CongressView";
import { RemoteImage } from "@/features/entities/RemoteImage";
import { leadershipHolders } from "@/features/government/roles";
import { PinButton } from "@/features/pins/PinButton";
import { getLocale, getMessages } from "@/i18n";
import { getGovernment } from "@/lib/data/world";
import { formatDate, humanizeCode } from "@/lib/format";
import { mediaSrc } from "@/lib/media";

export const dynamic = "force-dynamic";

export default async function GovernmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = getMessages(await getLocale());
  const g = m.governmentPage;
  const tabs = countryTabs(id, m, "government");
  let res;
  try { res = await getGovernment(id); } catch (e) { return <><h1>{g.title}</h1><Tabs items={tabs} label={g.title} /><ApiErrorState error={e} retryLabel={m.common.retry} /></>; }
  const d = await getDisplay();

  const dto = (x: (typeof res.rows)[number]): MemberDto | null => x.userId && x.username
    ? { id: x.userId, name: x.username, level: x.level ?? null, sinceText: formatDate(x.startedAt, d.nl), avatar: mediaSrc(x.avatarUrl, d.mediaOrigin), party: x.party ? { id: x.party.id, name: x.party.name } : null }
    : null;
  const leaders = leadershipHolders(res.rows).map((x) => ({ role: x.role, dto: dto(x) })).filter((x): x is { role: string; dto: MemberDto } => x.dto !== null);
  const congress = res.rows.filter((x) => x.role === "congress").map(dto).filter((x): x is MemberDto => x !== null);
  const seatsTotal = typeof res.government?.congressSeats === "number" ? res.government.congressSeats : null;
  const vacant = seatsTotal !== null && seatsTotal > congress.length ? seatsTotal - congress.length : 0;
  const choices = res.government?.active?.choices ?? [];

  return (
    <>
      <div className="page-head"><h1><CountryBadge id={id} d={d} link={false} /> <span className="h1-sub">· {g.title}</span></h1></div>
      <Tabs items={tabs} label={g.title} />

      <section className="card">
        <h2><Icon name="landmark" size={18} />{g.leadership}</h2>
        {leaders.length === 0 ? <p className="empty-mini">{g.noLeadership}</p> : (
          <div className="leaders">
            {leaders.map(({ role, dto: p }) => (
              <article key={`${role}-${p.id}`} className="leader" data-top={role === "president"}>
                <RemoteImage src={p.avatar} size={role === "president" ? 88 : 64} round fallback={<span className="seat-fallback big">{p.name.slice(0, 2).toUpperCase()}</span>} />
                <div>
                  <span className="badge" data-tone="neutral">{term("role", role, d)}</span>
                  <h3><Link href={`/players/${encodeURIComponent(p.id)}`} dir="auto">{p.name}</Link></h3>
                  <span className="kv">{p.party && <span>{p.party.name}</span>}{p.level != null && <span>{g.level} {p.level}</span>}{p.sinceText && <span>{g.since}: {p.sinceText}</span>}</span>
                  <PinButton labels={m.pins} target={{ type: "player", id: p.id, name: p.name, image: p.avatar, href: `/players/${encodeURIComponent(p.id)}` }} />
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="card" style={{ marginBlockStart: "1rem" }}>
        <h2><Icon name="users" size={18} />{g.congress}</h2>
        <dl className="metrics">
          <Metric icon="users" label={g.members} value={congress.length} />
          {seatsTotal !== null && <Metric icon="landmark" label={g.totalSeats} value={seatsTotal} hint={vacant > 0 ? `${vacant} ${g.vacant}` : undefined} />}
        </dl>
        {congress.length === 0 ? <p className="empty-mini">{g.noCongress}</p> : (
          <Parliament members={congress} vacant={vacant} rulingId={res.government?.rulingParty?.id ?? null} labels={g} pinLabels={m.pins} />
        )}
        <p className="hint">{g.layoutNote}</p>
      </section>

      {choices.length > 0 && (
        <section className="card" style={{ marginBlockStart: "1rem" }}>
          <h2><Icon name="scale" size={18} />{g.policies} {res.government?.rulingParty && <span className="chip">{res.government.rulingParty.name}</span>}</h2>
          <ul className="list">
            {choices.map((c) => (
              <li key={c.axis}>
                <span><b>{(d.m.t.ethics as Record<string, string>)[c.axis] ?? humanizeCode(c.axis)}</b>: {humanizeCode(c.code)}{c.fanatic ? ` (${g.fanatic})` : ""}</span>
                <span className="kv">{Object.entries(c.effects ?? {}).map(([k, v]) => <span key={k}>{(d.m.t.effect as Record<string, string>)[k] ?? humanizeCode(k)} {v > 0 ? "+" : ""}{v}%</span>)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <Provenance meta={res.meta} m={m} />
    </>
  );
}
