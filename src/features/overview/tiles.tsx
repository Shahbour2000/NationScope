import Link from "next/link";
import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/Icon";
import { BarList } from "@/features/charts/charts";
import { CountryBadge, Avatar, Dt, StatusBadge } from "@/features/entities/entities";
import type { Display } from "@/features/entities/display";
import { summarize } from "@/features/units/logic";
import { describeError } from "@/lib/api/errors";
import { getCompanyStats, getJobs, getMarket } from "@/lib/data/economy";
import { getUnits } from "@/lib/data/units";
import { getAlliances, getBattles, getCountries, getHistory, getRanking, getWars } from "@/lib/data/world";
import { humanizeCode } from "@/lib/format";
import type { Messages } from "@/i18n/messages";

interface Ctx { m: Messages; d: Display }
const stamp = (iso: string) => <small>{iso.replace("T", " ").replace(/\.\d+Z$/, "Z")}</small>;

function Tile({ icon, title, href, value, hint, at }: { icon: IconName; title: string; href: string; value: ReactNode; hint?: ReactNode; at?: string }) {
  return (
    <Link href={href} className="tile">
      <h3><Icon name={icon} size={15} /> {title}</h3>
      <div className="big">{value}</div>
      {hint ? <small>{hint}</small> : null}
      {at ? stamp(at) : null}
    </Link>
  );
}
const Unavailable = ({ icon, title, href, e, ctx }: { icon: IconName; title: string; href: string; e: unknown; ctx: Ctx }) => (
  <Tile icon={icon} title={title} href={href} value="—" hint={`${ctx.m.overview.unavailable}: ${describeError(e).title}`} />
);

export function TileSkeleton() {
  return (
    <div className="tile" aria-hidden="true">
      <div className="skeleton" style={{ inlineSize: "55%" }} />
      <div className="skeleton" style={{ blockSize: "1.8rem", inlineSize: "40%" }} />
      <div className="skeleton" style={{ inlineSize: "70%" }} />
    </div>
  );
}

/** One async server component per tile so each loads (and fails) independently. */
export async function OverviewTile({ kind, ctx }: { kind: "countries" | "alliances" | "units" | "wars" | "battles" | "companies" | "market" | "jobs"; ctx: Ctx }) {
  const t = ctx.m.overview.tiles;
  const nf = new Intl.NumberFormat(ctx.d.nl);
  const meta: Record<typeof kind, { icon: IconName; title: string; href: string }> = {
    countries: { icon: "flag", title: t.countries, href: "/countries" }, alliances: { icon: "shield", title: t.alliances, href: "/alliances" },
    units: { icon: "unit", title: t.units, href: "/units" }, wars: { icon: "war", title: t.activeWars, href: "/wars" },
    battles: { icon: "battle", title: t.activeBattles, href: "/battles" }, companies: { icon: "factory", title: t.companies, href: "/company-stats" },
    market: { icon: "chart", title: t.marketItems, href: "/economy" }, jobs: { icon: "briefcase", title: t.jobs, href: "/jobs" },
  };
  const base = meta[kind];
  try {
    switch (kind) {
      case "countries": {
        const r = await getCountries();
        const citizens = r.countries.reduce((n, c) => n + (c.citizens ?? 0), 0);
        return <Tile {...base} value={nf.format(r.countries.length)} hint={`${nf.format(citizens)} ${t.citizens.toLowerCase()}`} at={r.meta.fetchedAt} />;
      }
      case "alliances": {
        const r = await getAlliances();
        return <Tile {...base} value={nf.format(r.rows.filter((a) => a.status === "active").length)} hint={`${nf.format(r.rows.length)} ${ctx.m.ui.total}`} at={r.meta.fetchedAt} />;
      }
      case "units": {
        const r = await getUnits();
        const s = summarize(r.units);
        return <Tile {...base} value={nf.format(s.count)} hint={`${nf.format(s.members)} ${ctx.m.overview.members}`} at={r.meta.fetchedAt} />;
      }
      case "wars": {
        const r = await getWars();
        return <Tile {...base} value={nf.format(r.rows.filter((w) => w.status === "active").length)} hint={`${nf.format(r.rows.length)} ${ctx.m.ui.total}`} at={r.meta.fetchedAt} />;
      }
      case "battles": {
        const r = await getBattles("active");
        return <Tile {...base} value={`${nf.format(r.rows.length)}${r.rows.length >= 100 ? "+" : ""}`} at={r.meta.fetchedAt} />;
      }
      case "companies": {
        const r = await getCompanyStats();
        return <Tile {...base} value={r.totals ? nf.format(r.totals.companies) : "—"} hint={r.totals?.workers != null ? `${nf.format(r.totals.workers)} workers` : undefined} at={r.meta.fetchedAt} />;
      }
      case "market": {
        const r = await getMarket();
        return <Tile {...base} value={nf.format(r.rows.length)} at={r.meta.fetchedAt} />;
      }
      case "jobs": {
        const r = await getJobs();
        return <Tile {...base} value={nf.format(r.rows.length)} at={r.meta.fetchedAt} />;
      }
    }
  } catch (e) {
    return <Unavailable {...base} e={e} ctx={ctx} />;
  }
}

const Fail = ({ e, ctx }: { e: unknown; ctx: Ctx }) => <p className="banner" role="alert">{ctx.m.overview.unavailable}: {describeError(e).title}</p>;

/** Countries ordered by the API's own development figure (a sort, not a new metric). */
export async function DevelopmentLeaders({ ctx }: { ctx: Ctx }) {
  try {
    const { countries } = await getCountries();
    const top = [...countries].filter((c) => c.development != null).sort((a, b) => b.development! - a.development!).slice(0, 8);
    const nf = new Intl.NumberFormat(ctx.d.nl);
    return <BarList ariaLabel={ctx.m.overview.developmentLeaders} rows={top.map((c) => ({ key: c.id, label: <CountryBadge id={c.id} d={ctx.d} />, value: c.development!, display: nf.format(c.development!) }))} />;
  } catch (e) { return <Fail e={e} ctx={ctx} />; }
}

export async function TopPlayers({ ctx }: { ctx: Ctx }) {
  try {
    const { rows } = await getRanking("playerDamage", { limit: 5 });
    const nf = new Intl.NumberFormat(ctx.d.nl);
    return (
      <ol className="list">
        {rows.map((r) => (
          <li key={r.subjectId}>
            <Link className="ichip" href={`/players/${encodeURIComponent(r.subjectId)}`}><b>{r.rank}</b> <Avatar path={r.avatarUrl} d={ctx.d} /><span>{r.name}</span></Link>
            <span className="kv">{r.countryId ? <CountryBadge id={r.countryId} d={ctx.d} /> : null}<b>{/^\d+$/.test(r.value) ? nf.format(BigInt(r.value)) : r.value}</b></span>
          </li>
        ))}
      </ol>
    );
  } catch (e) { return <Fail e={e} ctx={ctx} />; }
}

export async function TopUnits({ ctx }: { ctx: Ctx }) {
  try {
    const { units } = await getUnits();
    const nf = new Intl.NumberFormat(ctx.d.nl);
    const top = [...units].filter((u) => u.damage !== null).sort((a, b) => (BigInt(b.damage!) > BigInt(a.damage!) ? 1 : BigInt(b.damage!) < BigInt(a.damage!) ? -1 : 0)).slice(0, 5);
    return (
      <ol className="list">
        {top.map((u, i) => (
          <li key={u.id}>
            <Link className="ichip" href={`/units/${encodeURIComponent(u.id)}`}><b>{i + 1}</b> <span>{u.name}</span></Link>
            <span className="kv">{u.countryId ? <CountryBadge id={u.countryId} d={ctx.d} /> : null}<b>{nf.format(BigInt(u.damage!))}</b></span>
          </li>
        ))}
      </ol>
    );
  } catch (e) { return <Fail e={e} ctx={ctx} />; }
}

const tidy = (s: string) => s.replace(/\b([a-z]+)\.([a-z_]+)\b/g, (_, a: string, b: string) => `${humanizeCode(a)} ${humanizeCode(b).toLowerCase()}`);

export async function RecentEvents({ ctx }: { ctx: Ctx }) {
  try {
    const { rows } = await getHistory();
    return (
      <ul className="list">
        {rows.slice(0, 6).map((x) => (
          <li key={x.key}><span className="kv"><StatusBadge value={x.type} group="eventType" d={ctx.d} /><Dt iso={x.at} d={ctx.d} /></span><span style={{ flex: "1 1 14rem" }}>{tidy(x.summary ?? "")}</span></li>
        ))}
      </ul>
    );
  } catch (e) { return <Fail e={e} ctx={ctx} />; }
}
