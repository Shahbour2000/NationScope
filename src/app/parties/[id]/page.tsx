import Link from "next/link";
import { Suspense } from "react";
import { ApiErrorState } from "@/components/ApiErrorState";
import { Provenance } from "@/components/Provenance";
import { BuildMix, BuildMixSkeleton } from "@/features/builds/BuildMix";
import { countryName } from "@/features/entities/display";
import { getDisplay } from "@/features/entities/display.server";
import { RemoteImage } from "@/features/entities/RemoteImage";
import { DataView } from "@/features/explorer/DataView";
import { Dt, Flag, Money } from "@/features/entities/entities";
import { PinButton } from "@/features/pins/PinButton";
import { ethicLabel } from "@/features/politics/ethics";
import { PartyMembersTable, type PartyMemberRow } from "@/features/politics/PartyMembersTable";
import { getLocale, getMessages } from "@/i18n";
import { getPartyDetail } from "@/lib/data/world";
import { formatDate, humanizeCode } from "@/lib/format";
import { mediaSrc } from "@/lib/media";
import s from "./party.module.css";

export const dynamic = "force-dynamic";
const safe = (v: string) => /^[A-Za-z0-9_-]{1,80}$/.test(v);

export default async function PartyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = getMessages(await getLocale());
  const t = m.worldParties;
  let res;
  try { res = await getPartyDetail(id); } catch (e) { return <><h1>{t.title}</h1><ApiErrorState error={e} retryLabel={m.common.retry} /></>; }
  const d = await getDisplay();
  const nf = new Intl.NumberFormat(d.nl);
  const p = res.party;
  // Unrecognised response shape: keep the generic viewer instead of guessing.
  if (!p) return <><div className="page-head"><h1>{t.title} · {id}</h1></div><DataView data={res.raw} section={null} detailLinks={false} labels={m.explorer} d={d} /><Provenance meta={res.meta} m={m} /></>;
  const logo = mediaSrc(p.logoUrl, d.mediaOrigin);
  const memberCount = p.members ?? res.members.length;
  const x = res.extras;
  const roleRank = (r: string | null) => ({ leader: 0, treasurer: 1, officer: 2, member: 3 } as Record<string, number>)[r ?? "member"] ?? 4;
  const roleLabel = (r: string | null) => (t.roles as Record<string, string>)[r ?? "member"] ?? humanizeCode(r ?? "member");
  const rows: PartyMemberRow[] = res.members.map((mm) => ({ id: mm.id, name: mm.name, avatar: mediaSrc(mm.avatarUrl, d.mediaOrigin), role: mm.role ?? "member", roleLabel: roleLabel(mm.role), roleRank: roleRank(mm.role), level: mm.level, joinedAt: mm.joinedAt, joinedText: formatDate(mm.joinedAt, d.nl) }));
  const axisOrder = ["posture", "economy", "borders", "rule"];
  const choices = [...(x.ethics?.choices ?? [])].sort((a, b) => axisOrder.indexOf(a.axis) - axisOrder.indexOf(b.axis));
  const effLabel = (k: string, v: number) => `${(t.effect as Record<string, string>)[k] ?? humanizeCode(k.replace(/Percent$/, ""))} ${v > 0 ? "+" : ""}${nf.format(v)}%`;
  const ethicName = (code: string) => ethicLabel(code, m.partiesPage.ethic, humanizeCode);
  return (
    <>
      <section className={s.hero} data-ruling={!!p.ruling}>
        <div className={s.logo}><RemoteImage src={logo} size={88} cls="" fallback={<span aria-hidden="true">{p.name.slice(0, 1).toUpperCase()}</span>} /></div>
        <div className={s.main}>
          <h1 dir="auto">{p.name}</h1>
          <div className={s.line}>
            {p.ruling && <span className={s.rul}>{t.ruling}</span>}
            {x.status && x.status !== "active" && <span>{t.statusLabel}: {humanizeCode(x.status)}</span>}
            {p.countryId && safe(p.countryId) && <Link href={`/countries/${encodeURIComponent(p.countryId)}`}><Flag id={p.countryId} d={d} />{countryName(p.countryId, d.dir)}</Link>}
            {p.leaderName && <span>{t.leader}: {p.leaderId && safe(p.leaderId) ? <Link href={`/players/${encodeURIComponent(p.leaderId)}`}>{p.leaderName}</Link> : p.leaderName}</span>}
            {p.createdAt && <span>{t.founded} {formatDate(p.createdAt, d.nl)}</span>}
          </div>
          {p.description ? <p className={s.desc} dir="auto">{p.description}</p> : null}
        </div>
        <div className={s.kpis}>
          <div className={s.kpi}><b>{nf.format(memberCount)}</b><span>{t.members}</span></div>
          {x.councilSeats != null && <div className={s.kpi}><b>{nf.format(x.councilSeats)}</b><span>{t.council}</span></div>}
          <PinButton labels={m.pins} target={{ type: "party", id, name: p.name, image: logo, href: `/parties/${encodeURIComponent(id)}` }} />
        </div>
      </section>
      {res.members.length > 0 && <div className={s.mix}><Suspense fallback={<BuildMixSkeleton m={m.builds} nl={d.nl} />}><BuildMix ids={res.members.map((y) => y.id)} m={m.builds} nl={d.nl} link={{ entity: "party", id }} lowerBound={p.members != null && p.members > res.members.length} /></Suspense></div>}
      <div className={s.grid2}>
        <section className={s.card} aria-labelledby="eth">
          <h2 id="eth">{t.ethicsTitle}</h2>
          {choices.length === 0 && !(p.ethics && p.ethics.length) ? <p className={s.note}>{t.ethicsNone}</p> : (
            <>
              <ul className={s.axes}>
                {choices.map((c) => (
                  <li key={c.axis} className={s.axis}>
                    <span>{(t.axis as Record<string, string>)[c.axis] ?? humanizeCode(c.axis)}</span>
                    <b>{ethicName(c.code)}{c.level != null && <span className={s.pips} role="img" aria-label={`${t.level} ${c.level}`}>{[1, 2, 3].map((n) => <i key={n} data-on={n <= (c.level ?? 0)} />)}</span>}{c.fanatic && <span className={s.fan}>{t.fanatic}</span>}</b>
                    {Object.keys(c.effects).length > 0 && <span className={s.eff}>{Object.entries(c.effects).map(([k, v]) => <span key={k}>{effLabel(k, v)}</span>)}</span>}
                  </li>
                ))}
              </ul>
              {choices.length === 0 && p.ethics && <div className={s.eth}>{p.ethics.map((e) => <span key={e}>{ethicName(e)}</span>)}</div>}
              {x.ethics && (x.ethics.changedAt || x.ethics.nextChangeAt || x.ethics.cooldownDays != null) && (
                <dl className={s.facts} style={{ marginBlockStart: "0.9rem" }}>
                  {x.ethics.changedAt && <div><dt>{t.ethicsChanged}</dt><dd>{formatDate(x.ethics.changedAt, d.nl)}</dd></div>}
                  {x.ethics.nextChangeAt && <div><dt>{t.ethicsNext}</dt><dd>{formatDate(x.ethics.nextChangeAt, d.nl)}</dd></div>}
                  {x.ethics.cooldownDays != null && <div><dt>{t.ethicsCooldown}</dt><dd>{nf.format(x.ethics.cooldownDays)} {t.days}</dd></div>}
                </dl>
              )}
            </>
          )}
        </section>
        <section className={s.card} aria-labelledby="pol">
          <h2 id="pol">{t.politicsTitle}</h2>
          <dl className={s.facts}>
            {x.treasury != null && <div><dt>{t.treasury}</dt><dd><Money value={x.treasury} d={d} /></dd></div>}
            {x.councilSeats != null && <div><dt>{t.council}</dt><dd>{nf.format(x.councilSeats)}</dd></div>}
            {x.councilMotionHours != null && <div><dt>{t.motionHours}</dt><dd>{nf.format(x.councilMotionHours)} {t.hours}</dd></div>}
          </dl>
          <h2 style={{ marginBlockStart: "1.1rem" }}>{t.nextElection}</h2>
          {x.nextElection && (x.nextElection.candidacyOpensAt || x.nextElection.votingOpensAt || x.nextElection.closesAt) ? (
            <ul className={s.timeline}>
              {x.nextElection.candidacyOpensAt && <li><span>{t.candidacyOpens}</span><span><Dt iso={x.nextElection.candidacyOpensAt} d={d} /></span></li>}
              {x.nextElection.votingOpensAt && <li><span>{t.votingOpens}</span><span><Dt iso={x.nextElection.votingOpensAt} d={d} /></span></li>}
              {x.nextElection.closesAt && <li><span>{t.electionCloses}</span><span><Dt iso={x.nextElection.closesAt} d={d} /></span></li>}
            </ul>
          ) : <p className={s.note} style={{ marginBlockStart: 0 }}>{t.noElection}</p>}
        </section>
      </div>
      <section className={s.sec}>
        <h2>{t.memberList} <small>{nf.format(rows.length)}{p.members != null && p.members !== rows.length ? ` / ${nf.format(p.members)}` : ""}</small></h2>
        {rows.length === 0 ? <p className={s.note}>{t.noMembers}</p> : <PartyMembersTable rows={rows} nl={d.nl} labels={{ player: m.builds.colPlayer, role: t.role, level: m.builds.colLevel, joined: t.joined }} />}
      </section>
      <p className={s.note}>{t.sourceNote}</p>
      <Provenance meta={res.meta} m={m} />
    </>
  );
}
