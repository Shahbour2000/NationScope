import Link from "next/link";
import { ApiErrorState } from "@/components/ApiErrorState";
import { Pager } from "@/components/Pager";
import { Provenance } from "@/components/Provenance";
import { Tabs } from "@/components/Tabs";
import { countryTabs } from "@/features/countries/tabs";
import { parseOffset } from "@/features/explorer/catalog";
import { Avatar, CountryBadge, Dt, RegionLink } from "@/features/entities/entities";
import { getDisplay } from "@/features/entities/display.server";
import { getLocale, getMessages } from "@/i18n";
import { getCitizens } from "@/lib/data/world";

export const dynamic = "force-dynamic";
const PAGE = 50;

export default async function CitizensPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ offset?: string }> }) {
  const { id } = await params;
  const offset = parseOffset((await searchParams).offset);
  const m = getMessages(await getLocale());
  const c = m.countryProfile;
  const base = `/countries/${encodeURIComponent(id)}`;
  const tabs = countryTabs(id, m, "citizens");
  let res;
  try { res = await getCitizens(id, { offset, limit: PAGE }); } catch (e) { return <><h1>{c.citizensTab}</h1><Tabs items={tabs} label={c.citizensTab} /><ApiErrorState error={e} retryLabel={m.common.retry} /></>; }
  const d = await getDisplay();
  const nf = new Intl.NumberFormat(d.nl);
  return (
    <>
      <div className="page-head"><h1><CountryBadge id={id} d={d} link={false} /> <span className="h1-sub">· {c.citizensTab}</span></h1></div>
      <Tabs items={tabs} label={c.citizensTab} />
      {res.total != null && <p className="note">{nf.format(res.total)} {m.ui.total}</p>}
      <div className="tablewrap">
        <table className="table">
          <thead><tr><th scope="col">{c.player}</th><th scope="col" className="num">{c.level}</th><th scope="col">{c.homeRegion}</th><th scope="col">{c.location}</th><th scope="col">{c.lastActive}</th><th scope="col">{m.warsPage.status}</th></tr></thead>
          <tbody>
            {res.rows.map((x) => (
              <tr key={x.id}>
                <td data-label={c.player}><Link className="ichip" href={`/players/${encodeURIComponent(x.id)}`}><Avatar path={x.avatarUrl} d={d} /><span>{x.username}</span></Link></td>
                <td className="num" data-label={c.level}>{x.level ?? "—"}</td>
                <td data-label={c.homeRegion}>{x.homeRegionId ? <RegionLink id={x.homeRegionId} d={d} /> : "—"}</td>
                <td data-label={c.location}>{x.regionId ? <RegionLink id={x.regionId} d={d} /> : "—"}</td>
                <td data-label={c.lastActive}><Dt iso={x.lastActiveAt} d={d} /></td>
                <td data-label={m.warsPage.status}>{x.active == null ? "—" : <span className="badge" data-tone={x.active ? "good" : "muted"}>{x.active ? m.t.status.active : m.t.status.ended}</span>}</td>
              </tr>
            ))}
            {res.rows.length === 0 && <tr><td colSpan={6}>{m.explorer.noRows}</td></tr>}
          </tbody>
        </table>
      </div>
      <Pager basePath={`${base}/citizens`} offset={offset} pageSize={PAGE} rowCount={res.hasMore ? PAGE : res.rows.length} prev={m.explorer.prev} next={m.explorer.next} />
      <Provenance meta={res.meta} m={m} />
    </>
  );
}
