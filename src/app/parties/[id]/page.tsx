import Link from "next/link";
import { Suspense } from "react";
import { ApiErrorState } from "@/components/ApiErrorState";
import { Provenance } from "@/components/Provenance";
import { BuildMix, BuildMixSkeleton } from "@/features/builds/BuildMix";
import { countryName } from "@/features/entities/display";
import { getDisplay } from "@/features/entities/display.server";
import { RemoteImage } from "@/features/entities/RemoteImage";
import { DataView } from "@/features/explorer/DataView";
import { Flag } from "@/features/entities/entities";
import { PinButton } from "@/features/pins/PinButton";
import { ethicLabel } from "@/features/politics/ethics";
import { initials } from "@/features/politics/elections";
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
  return (
    <>
      <section className={s.hero} data-ruling={!!p.ruling}>
        <div className={s.logo}><RemoteImage src={logo} size={88} cls="" fallback={<span aria-hidden="true">{p.name.slice(0, 1).toUpperCase()}</span>} /></div>
        <div className={s.main}>
          <h1 dir="auto">{p.name}</h1>
          <div className={s.line}>
            {p.ruling && <span className={s.rul}>{t.ruling}</span>}
            {p.countryId && <Link href={`/countries/${encodeURIComponent(p.countryId)}/parties`}><Flag id={p.countryId} d={d} />{countryName(p.countryId, d.dir)}</Link>}
            {p.leaderName && <span>{t.leader}: {p.leaderId && safe(p.leaderId) ? <Link href={`/players/${encodeURIComponent(p.leaderId)}`}>{p.leaderName}</Link> : p.leaderName}</span>}
            {p.createdAt && <span>{t.founded} {formatDate(p.createdAt, d.nl)}</span>}
          </div>
          {p.description ? <p className={s.desc} dir="auto">{p.description}</p> : null}
          {p.ethics && p.ethics.length > 0 && <div className={s.eth}>{p.ethics.map((e) => <span key={e}>{ethicLabel(e, m.partiesPage.ethic, humanizeCode)}</span>)}</div>}
        </div>
        <div className={s.kpis}>
          <div className={s.kpi}><b>{nf.format(memberCount)}</b><span>{t.members}</span></div>
          <PinButton labels={m.pins} target={{ type: "party", id, name: p.name, image: logo, href: `/parties/${encodeURIComponent(id)}` }} />
        </div>
      </section>
      {res.members.length > 0 && (
        <>
          <div className={s.mix}><Suspense fallback={<BuildMixSkeleton m={m.builds} nl={d.nl} />}><BuildMix ids={res.members.map((x) => x.id)} m={m.builds} nl={d.nl} link={{ entity: "party", id }} /></Suspense></div>
          <section className={s.sec}>
            <h2>{t.memberList} <small>{nf.format(res.members.length)}</small></h2>
            <ul className={s.members}>
              {res.members.map((x) => (
                <li key={x.id}>{safe(x.id) ? <Link href={`/players/${encodeURIComponent(x.id)}`}><span className={s.av}>{initials(x.name)}</span><span className={s.nm} dir="auto" title={x.name}>{x.name}</span>{x.level != null && <span className={s.lv}>{t.level} {x.level}</span>}</Link> : null}</li>
              ))}
            </ul>
          </section>
        </>
      )}
      <Provenance meta={res.meta} m={m} />
    </>
  );
}
