import Link from "next/link";
import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/Icon";
import { formatDateTime, formatMoney } from "@/lib/format";
import { regionName } from "@/lib/domain/directory";
import { flagSrc } from "@/lib/flags";
import { itemIconSrc, mediaSrc } from "@/lib/media";
import { countryName, itemName, schemeColor, term, type Display } from "./display";
import { RemoteImage } from "./RemoteImage";

const idOk = (id: string) => /^[A-Za-z0-9_-]{1,80}$/.test(id);

/** Country flag from the bundled flag set (the API provides none). Falls back to a colour token if the file is missing. */
export function Flag({ id, d }: { id: string; d: Display }) {
  const token = <span className="cflag" style={{ background: schemeColor(d.dir.countries[id]?.scheme) }} aria-hidden="true">{id.slice(0, 2).toUpperCase()}</span>;
  const src = flagSrc(id);
  return src ? <RemoteImage src={src} size={27} fallback={token} alt="" cls="cflag-img" /> : token;
}

export function CountryBadge({ id, d, link = true }: { id: string | null | undefined; d: Display; link?: boolean }) {
  if (!id) return <span className="chip">{d.m.ui.none}</span>;
  const inner = (
    <>
      <Flag id={id} d={d} />
      <span className="cname" title={countryName(id, d.dir)}>{countryName(id, d.dir)}</span>
    </>
  );
  return link && idOk(id) ? <Link className="cbadge" href={`/countries/${encodeURIComponent(id)}`}>{inner}</Link> : <span className="cbadge">{inner}</span>;
}

export function RegionLink({ id, d, link = true }: { id: string | null | undefined; d: Display; link?: boolean }) {
  if (!id) return <span className="chip">{d.m.ui.none}</span>;
  const name = regionName(id, d.dir);
  return link && idOk(id) ? <Link href={`/regions/${encodeURIComponent(id)}`}>{name}</Link> : <>{name}</>;
}

export function ItemIcon({ code, size = 24 }: { code: string; size?: number }) {
  return <RemoteImage src={itemIconSrc(code)} size={size} fallback={<span className="img img-fallback" style={{ inlineSize: size, blockSize: size }}><Icon name="box" size={Math.round(size * 0.6)} /></span>} />;
}

export function ItemChip({ code, d, href }: { code: string; d: Display; href?: string }) {
  const inner = <><ItemIcon code={code} /><span>{itemName(code, d)}</span></>;
  return href ? <Link className="ichip" href={href}>{inner}</Link> : <span className="ichip">{inner}</span>;
}

export function Avatar({ path, size = 24, d, icon = "user" }: { path: string | null | undefined; size?: number; d: Display; icon?: IconName }) {
  return <RemoteImage src={mediaSrc(path, d.mediaOrigin)} size={size} round fallback={<span className="img img-round img-fallback" style={{ inlineSize: size, blockSize: size }}><Icon name={icon} size={Math.round(size * 0.6)} /></span>} />;
}

export function PlayerChip({ id, name, avatar, d }: { id?: string | null; name: string; avatar?: string | null; d: Display }) {
  const inner = <><Avatar path={avatar} d={d} /><span>{name}</span></>;
  return id && idOk(id) ? <Link className="ichip" href={`/players/${encodeURIComponent(id)}`}>{inner}</Link> : <span className="ichip">{inner}</span>;
}

const TONES: Record<string, string> = { active: "good", open: "good", executed: "good", ended: "muted", finished: "muted", closed: "muted", disbanded: "muted", rejected: "bad", failed: "bad" };
export function StatusBadge({ value, d, group = "status" }: { value: string | null | undefined; d: Display; group?: "status" | "battleType" | "rarity" | "eventType" }) {
  return <span className="badge" data-tone={group === "rarity" ? `rarity-${value}` : (value && TONES[value]) || "neutral"}>{term(group, value, d)}</span>;
}

export function Money({ value, d }: { value: string | null | undefined; d: Display }) {
  const f = formatMoney(value, d.nl);
  if (f === null) return <span className="chip">{d.m.ui.missing}</span>;
  return <span className="money" title={`${d.m.ui.gold}`}><Icon name="coins" size={14} /> {f}</span>;
}

export function Dt({ iso, d }: { iso: string | null | undefined; d: Display }) {
  const f = formatDateTime(iso, d.nl, d.m.time.utc);
  return f && iso ? <time dateTime={iso}>{f}</time> : <span className="chip">{d.m.ui.missing}</span>;
}

export function Metric({ icon, label, value, hint, children }: { icon: IconName; label: string; value?: ReactNode; hint?: ReactNode; children?: ReactNode }) {
  return (
    <div className="metric">
      <span className="metric-icon"><Icon name={icon} size={18} /></span>
      <div>
        <dt>{label}</dt>
        <dd>{value}</dd>
        {hint ? <small>{hint}</small> : null}
        {children}
      </div>
    </div>
  );
}

/** Marks where a figure comes from. Keeps raw API facts, calculations and estimates visibly different. */
export function Source({ kind, d }: { kind: "api" | "calc" | "estimate"; d: Display }) {
  const label = kind === "api" ? d.m.ui.fromApi : kind === "calc" ? d.m.ui.calculated : d.m.ui.estimate;
  return <span className="src" data-kind={kind}>{label}</span>;
}
