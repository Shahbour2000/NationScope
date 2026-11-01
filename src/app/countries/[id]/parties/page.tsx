import Link from "next/link";
import { ApiErrorState } from "@/components/ApiErrorState";
import { Provenance } from "@/components/Provenance";
import { Tabs } from "@/components/Tabs";
import { countryTabs } from "@/features/countries/tabs";
import { countryName } from "@/features/entities/display";
import { getDisplay } from "@/features/entities/display.server";
import { RemoteImage } from "@/features/entities/RemoteImage";
import { Flag } from "@/features/entities/entities";
import { ethicLabel } from "@/features/politics/ethics";
import { getLocale, getMessages } from "@/i18n";
import { getCountryParties } from "@/lib/data/world";
import { formatDate, humanizeCode } from "@/lib/format";
import { mediaSrc } from "@/lib/media";
import s from "./parties.module.css";

export const dynamic = "force-dynamic";
const safe = (v: string) => /^[A-Za-z0-9_-]{1,80}$/.test(v);

export default async function PartiesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = getMessages(await getLocale());
  const t = m.partiesPage;
  const tabs = countryTabs(id, m, "parties");
  let res;
  try { res = await getCountryParties(id); } catch (e) { return <><h1>{t.title}</h1><Tabs items={tabs} label={t.title} /><ApiErrorState error={e} retryLabel={m.common.retry} /></>; }
  const d = await getDisplay();
  const nf = new Intl.NumberFormat(d.nl);
  const parties = [...res.parties].sort((a, b) => Number(!!b.ruling) - Number(!!a.ruling) || (b.members ?? 0) - (a.members ?? 0));
  const total = parties.reduce((sum, p) => sum + (p.members ?? 0), 0);
  const cost = res.createCost && /^\d+$/.test(res.createCost) ? nf.format(Number(res.createCost)) : null;
  return (
    <>
      <div className={s.head}><Flag id={id} d={d} /><h1>{countryName(id, d.dir)} · {t.title}</h1></div>
      <Tabs items={tabs} label={t.title} />
      {parties.length === 0 ? <p className={s.empty}>{t.empty}</p> : (
        <div className={s.list}>
          {parties.map((p) => {
            const pct = total > 0 && p.members ? Math.round((p.members / total) * 100) : 0;
            const logo = mediaSrc(p.logoUrl, d.mediaOrigin);
            return (
              <article key={p.id} className={s.party} data-ruling={!!p.ruling}>
                <div className={s.logo}><RemoteImage src={logo} size={72} fallback={<span>{p.name.slice(0, 1).toUpperCase()}</span>} cls="" /></div>
                <div className={s.main}>
                  <div className={s.name}>
                    {safe(p.id) ? <Link href={`/parties/${encodeURIComponent(p.id)}`} dir="auto">{p.name}</Link> : <span dir="auto">{p.name}</span>}
                    {p.ruling && <span className={s.ruling}>{t.ruling}</span>}
                  </div>
                  <div className={s.sub}>
                    {p.leaderName && <>{t.leader}: {p.leaderId && safe(p.leaderId) ? <Link href={`/players/${encodeURIComponent(p.leaderId)}`}>{p.leaderName}</Link> : p.leaderName}</>}
                    {p.createdAt && <> · {t.founded} {formatDate(p.createdAt, d.nl)}</>}
                  </div>
                  {p.description ? <p className={s.desc} dir="auto">{p.description}</p> : null}
                  {p.ethics && p.ethics.length > 0 && <div className={s.ethics}>{p.ethics.map((e) => <span key={e}>{ethicLabel(e, t.ethic, humanizeCode)}</span>)}</div>}
                </div>
                <div className={s.stat}>
                  <b>{nf.format(p.members ?? 0)}</b><span>{t.members}</span>
                  {total > 0 && <div className={s.bar} title={`${pct}% ${t.share}`}><i style={{ inlineSize: `${pct}%` }} /></div>}
                </div>
              </article>
            );
          })}
        </div>
      )}
      {cost && <p className={s.note}>{t.foundCost.replace("{c}", cost)}</p>}
      <Provenance meta={res.meta} m={m} />
    </>
  );
}
