import Link from "next/link";
import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/Icon";
import { RankList } from "@/components/RankList";
import { describeError } from "@/lib/api/errors";
import { Avatar, Flag } from "@/features/entities/entities";
import { countryName, type Display } from "@/features/entities/display";
import type { Messages } from "@/i18n/messages";
import { getCompanyStats } from "@/lib/data/economy";
import { getUnits } from "@/lib/data/units";
import { getAlliances, getBattles, getCountries, getHistory, getRanking, getWars } from "@/lib/data/world";
import { formatDuration, humanizeCode } from "@/lib/format";

interface Ctx { m: Messages; d: Display }
type Tone = "blue" | "red" | "green" | "gold" | "purple";

const compact = (nl: string, v: string): { text: string; full: string } => {
  const n = /^\d+$/.test(v) ? Number(v) : NaN;
  const full = Number.isFinite(n) ? new Intl.NumberFormat(nl).format(BigInt(v)) : v;
  return { text: Number.isFinite(n) ? new Intl.NumberFormat(nl, { notation: "compact", maximumFractionDigits: 1 }).format(n) : v, full };
};

export function Kpi({ icon, tone, value, label, href }: { icon: IconName; tone: Tone; value: ReactNode; label: string; href: string }) {
  return (
    <Link href={href} className="kpi">
      <span className="kpi-ico" data-tone={tone}><Icon name={icon} size={22} /></span>
      <span className="kpi-body"><span className="kpi-val">{value}</span><span className="kpi-label" title={label}>{label}</span></span>
    </Link>
  );
}

const Fail = ({ e, ctx }: { e: unknown; ctx: Ctx }) => <p className="banner" role="alert">{ctx.m.overview.unavailable}: {describeError(e).title}</p>;
export const KpiSkeleton = () => <div className="kpi" aria-hidden="true"><span className="kpi-ico skeleton" /><span className="kpi-body"><span className="skeleton" style={{ inlineSize: "3rem", blockSize: "1.4rem" }} /><span className="skeleton" style={{ inlineSize: "5rem" }} /></span></div>;

export async function HeroKpi({ kind, ctx }: { kind: "countries" | "wars" | "alliances" | "citizens"; ctx: Ctx }) {
  const t = ctx.m.overview.tiles, nf = new Intl.NumberFormat(ctx.d.nl);
  try {
    if (kind === "wars") { const r = await getWars(); return <Kpi icon="war" tone="red" href="/wars" label={t.activeWars} value={nf.format(r.rows.filter((w) => w.status === "active").length)} />; }
    if (kind === "alliances") { const r = await getAlliances(); return <Kpi icon="shield" tone="green" href="/alliances" label={t.alliances} value={nf.format(r.rows.filter((a) => a.status === "active").length)} />; }
    const r = await getCountries();
    if (kind === "countries") return <Kpi icon="globe" tone="blue" href="/countries" label={t.countries} value={nf.format(r.countries.length)} />;
    return <Kpi icon="users" tone="gold" href="/countries" label={ctx.m.overview.activeCitizens} value={nf.format(r.countries.reduce((n, c) => n + (c.activeCitizens ?? 0), 0))} />;
  } catch (e) { return <Kpi icon="flag" tone="blue" href="/" label={ctx.m.overview.unavailable} value={describeError(e).title.slice(0, 12)} />; }
}

export async function TopCountries({ ctx }: { ctx: Ctx }) {
  try {
    const { rows } = await getRanking("countryDamage", { limit: 5 });
    return <RankList label={ctx.m.overview.topCountries} icon={<Icon name="flame" size={14} />}
      items={rows.slice(0, 5).map((r) => { const v = compact(ctx.d.nl, r.value); return { key: r.subjectId, rank: r.rank, href: `/countries/${encodeURIComponent(r.subjectId)}`, lead: <Flag id={r.subjectId} d={ctx.d} />, name: countryName(r.subjectId, ctx.d.dir) || r.name, value: v.text, valueTitle: v.full }; })} />;
  } catch (e) { return <Fail e={e} ctx={ctx} />; }
}

export async function TopPlayers({ ctx }: { ctx: Ctx }) {
  try {
    const { rows } = await getRanking("playerDamage", { limit: 5 });
    return <RankList label={ctx.m.overview.topPlayers} icon={<Icon name="flame" size={14} />}
      items={rows.slice(0, 5).map((r) => { const v = compact(ctx.d.nl, r.value); return { key: r.subjectId, rank: r.rank, href: `/players/${encodeURIComponent(r.subjectId)}`, lead: <Avatar path={r.avatarUrl} d={ctx.d} />, name: r.name, value: v.text, valueTitle: v.full, tail: r.countryId ? <span className="rk-flag"><Flag id={r.countryId} d={ctx.d} /></span> : null }; })} />;
  } catch (e) { return <Fail e={e} ctx={ctx} />; }
}

const EVENT: Record<string, { icon: IconName; tone: Tone }> = {
  battle: { icon: "battle", tone: "red" }, ownership: { icon: "map", tone: "blue" }, treaty: { icon: "shield", tone: "green" },
  election: { icon: "landmark", tone: "purple" }, law: { icon: "scale", tone: "gold" }, tournament: { icon: "trophy", tone: "gold" },
};
const tidy = (s: string) => s.replace(/\b([a-z]+)\.([a-z_]+)\b/g, (_, a: string, b: string) => `${humanizeCode(a)} ${humanizeCode(b).toLowerCase()}`);

export async function LatestEvents({ ctx }: { ctx: Ctx }) {
  try {
    const { rows } = await getHistory();
    const now = Date.now();
    return (
      <ul className="eventlist">
        {rows.slice(0, 5).map((x) => {
          const ev = EVENT[x.type] ?? { icon: "clock" as IconName, tone: "blue" as Tone };
          const ms = now - Date.parse(x.at);
          const ago = Number.isFinite(ms) ? (ms < 60_000 ? ctx.m.unitPage.justNow : ctx.m.unitPage.ago.replace("{t}", formatDuration(ms, ctx.d.m.time))) : "";
          const cid = x.countryIds?.[0];
          return (
            <li key={x.key}>
              <span className="kpi-ico sm" data-tone={ev.tone}><Icon name={ev.icon} size={16} /></span>
              {cid ? <span className="ev-flag"><Flag id={cid} d={ctx.d} /></span> : null}
              <span className="ev-text"><span className="ev-title" title={tidy(x.summary ?? "")} dir="auto">{tidy(x.summary ?? "")}</span><small>{ago}</small></span>
            </li>
          );
        })}
      </ul>
    );
  } catch (e) { return <Fail e={e} ctx={ctx} />; }
}

export async function WorldStats({ ctx }: { ctx: Ctx }) {
  const t = ctx.m.overview.tiles, nf = new Intl.NumberFormat(ctx.d.nl);
  const [c, co, u, b] = await Promise.allSettled([getCountries(), getCompanyStats(), getUnits(), getBattles("active")]);
  const cell = (icon: IconName, tone: Tone, label: string, value: string | null, href: string) => (
    <Link href={href} className="stat2"><span className="kpi-ico" data-tone={tone}><Icon name={icon} size={20} /></span><span className="kpi-body"><span className="kpi-label">{label}</span><span className="kpi-val">{value ?? "—"}</span></span></Link>
  );
  return (
    <div className="stats2">
      {cell("users", "blue", t.citizens, c.status === "fulfilled" ? nf.format(c.value.countries.reduce((n, x) => n + (x.citizens ?? 0), 0)) : null, "/countries")}
      {cell("factory", "gold", t.companies, co.status === "fulfilled" && co.value.totals ? nf.format(co.value.totals.companies) : null, "/company-stats")}
      {cell("unit", "purple", t.units, u.status === "fulfilled" ? nf.format(u.value.units.length) : null, "/units")}
      {cell("battle", "red", t.activeBattles, b.status === "fulfilled" ? `${nf.format(b.value.rows.length)}${b.value.rows.length >= 100 ? "+" : ""}` : null, "/battles")}
    </div>
  );
}
