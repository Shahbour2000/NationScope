import Link from "next/link";
import type { ReactNode } from "react";
import { GenericTable } from "@/features/explorer/GenericTable";
import { pickColumns } from "@/features/explorer/columns";
import { listOf, objectRows } from "@/features/explorer/shape";
import { describeError } from "@/lib/api/errors";
import type { Endpoint } from "@/lib/api/endpoints";
import { getUnits } from "@/lib/data/units";
import { fetchEndpoint } from "@/lib/data/explore";
import type { Messages } from "@/i18n/messages";
import { summarize } from "@/features/units/logic";
import { endpoints } from "@/lib/api/endpoints";

interface Ctx { m: Messages; locale: string }

function TileShell({ title, href, children }: { title: string; href: string; children: ReactNode }) {
  return (
    <Link href={href} className="tile">
      <h3>{title}</h3>
      {children}
    </Link>
  );
}

export function TileSkeleton() {
  return (
    <div className="tile" aria-hidden="true">
      <div className="skeleton" style={{ inlineSize: "55%" }} />
      <div className="skeleton" style={{ blockSize: "1.8rem", inlineSize: "40%" }} />
      <div className="skeleton" style={{ inlineSize: "70%" }} />
    </div>
  );
}

function Failed({ title, href, error, ctx }: { title: string; href: string; error: unknown; ctx: Ctx }) {
  return (
    <TileShell title={title} href={href}>
      <div className="big">—</div>
      <small>{ctx.m.overview.unavailable}: {describeError(error).title}</small>
    </TileShell>
  );
}

const stamp = (iso: string) => <small>{iso.replace("T", " ").replace(/\.\d+Z$/, "Z")}</small>;

/** Counts the items of a response list. Shape-tolerant: "not recognised" is shown rather than a made-up number. */
export async function CountTile({ title, href, endpoint, capAt, ctx }: { title: string; href: string; endpoint: Endpoint; capAt?: number; ctx: Ctx }) {
  try {
    const { data, meta } = await fetchEndpoint(endpoint);
    const list = listOf(data);
    const fmt = new Intl.NumberFormat(ctx.locale);
    return (
      <TileShell title={title} href={href}>
        <div className="big">{list ? `${fmt.format(list.rows.length)}${capAt && list.rows.length >= capAt ? "+" : ""}` : "—"}</div>
        <small>{list ? ctx.m.overview.inResponse : ctx.m.overview.unrecognized}</small>
        {stamp(meta.fetchedAt)}
      </TileShell>
    );
  } catch (error) {
    return <Failed title={title} href={href} error={error} ctx={ctx} />;
  }
}

/** Real, verified shape (see lib/domain/units.ts). */
export async function UnitsTile({ ctx }: { ctx: Ctx }) {
  const title = ctx.m.overview.tiles.units;
  try {
    const { units, meta } = await getUnits();
    const t = summarize(units);
    const fmt = new Intl.NumberFormat(ctx.locale);
    return (
      <TileShell title={title} href="/units">
        <div className="big">{fmt.format(t.count)}</div>
        <small>{fmt.format(t.members)} {ctx.m.overview.members} · {fmt.format(t.damage)} {ctx.m.overview.damage}</small>
        {stamp(meta.fetchedAt)}
      </TileShell>
    );
  } catch (error) {
    return <Failed title={title} href="/units" error={error} ctx={ctx} />;
  }
}

export async function TopUnits({ ctx }: { ctx: Ctx }) {
  try {
    const { units } = await getUnits();
    const fmt = new Intl.NumberFormat(ctx.locale);
    const top = [...units].filter((u) => u.damage !== null).sort((a, b) => (BigInt(b.damage!) > BigInt(a.damage!) ? 1 : BigInt(b.damage!) < BigInt(a.damage!) ? -1 : 0)).slice(0, 5);
    return (
      <div className="tablewrap">
        <table className="table">
          <thead><tr><th scope="col">#</th><th scope="col">{ctx.m.units.columns.unit}</th><th scope="col">{ctx.m.units.columns.country}</th><th scope="col" className="num">{ctx.m.units.columns.damage}</th></tr></thead>
          <tbody>
            {top.map((u, i) => (
              <tr key={u.id}>
                <td data-label="#">{i + 1}</td>
                <td data-label={ctx.m.units.columns.unit}><Link href={`/units/${encodeURIComponent(u.id)}`}>{u.name}</Link></td>
                <td data-label={ctx.m.units.columns.country}>{u.countryId ? u.countryId.toUpperCase() : ctx.m.common.none}</td>
                <td className="num" data-label={ctx.m.units.columns.damage}>{fmt.format(BigInt(u.damage!))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  } catch (error) {
    return <p className="banner" role="alert">{ctx.m.overview.unavailable}: {describeError(error).title}</p>;
  }
}

export async function RecentEvents({ ctx }: { ctx: Ctx }) {
  try {
    const { data } = await fetchEndpoint(endpoints.history());
    const rows = objectRows(listOf(data)?.rows ?? []);
    if (!rows) return <p className="note">{ctx.m.overview.unrecognized}</p>;
    const first = rows.slice(0, 5);
    return <GenericTable rows={first} columns={pickColumns(first, 5)} section={null} labels={ctx.m.explorer} />;
  } catch (error) {
    return <p className="banner" role="alert">{ctx.m.overview.unavailable}: {describeError(error).title}</p>;
  }
}

/** GET /rankings/playerDamage (board id given as the example in the production spec). Generic table: fields as returned. */
export async function Leaderboard({ ctx }: { ctx: Ctx }) {
  try {
    const { data } = await fetchEndpoint(endpoints.ranking("playerDamage", { limit: 10 }));
    const list = listOf(data);
    const rows = list ? objectRows(list.rows) : null;
    if (!rows) return <p className="note">{ctx.m.overview.unrecognized}</p>;
    return <GenericTable rows={rows} columns={pickColumns(rows, 5)} section={null} labels={ctx.m.explorer} />;
  } catch (error) {
    return <p className="banner" role="alert">{ctx.m.overview.unavailable}: {describeError(error).title}</p>;
  }
}
