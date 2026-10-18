import Link from "next/link";
import type { Messages } from "@/i18n/messages";
import { CountryBadge, Dt, ItemChip, RegionLink } from "@/features/entities/entities";
import { countryName, type Display } from "@/features/entities/display";
import { RESOLVABLE_KEYS } from "./columns";
import { linkFor } from "./links";

export type CellLabels = Pick<Messages["explorer"], "yes" | "no" | "missing" | "itemsCount" | "fieldsCount">;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

/** Renders one API value exactly as received. Missing (null) is distinct from 0 and false. */
const REGION_KEYS = new Set(["regionId", "sourceRegionId", "capitalRegionId", "homeRegionId"]);
const TERM_KEYS: Record<string, ("status" | "battleType" | "eventType" | "rarity" | "slot" | "role")[]> = { status: ["status"], type: ["battleType", "eventType"], kind: ["eventType"], rarity: ["rarity"], slot: ["slot"], role: ["role"] };

export function Cell({ k, v, labels, d }: { k: string; v: unknown; labels: CellLabels; d?: Display }) {
  if (v === null || v === undefined) return <span className="chip">{labels.missing}</span>;
  if (typeof v === "boolean") return <>{v ? labels.yes : labels.no}</>;
  if (typeof v === "number") return <>{String(v)}</>;
  if (typeof v === "string" && d) {
    if (RESOLVABLE_KEYS.has(k) && !REGION_KEYS.has(k) && (d.dir.countries[v] || countryName(v, d.dir) !== v.toUpperCase())) return <CountryBadge id={v} d={d} />;
    if (REGION_KEYS.has(k)) return <RegionLink id={v} d={d} />;
    if (k === "itemCode") return <ItemChip code={v} d={d} />;
    if (ISO.test(v)) return <Dt iso={v} d={d} />;
    for (const g of TERM_KEYS[k] ?? []) { const t = (d.m.t[g] as Record<string, string>)[v]; if (t) return <>{t}</>; }
  }
  if (typeof v === "string") {
    if (ISO.test(v)) return <time dateTime={v}>{v.replace("T", " ").replace(/\.\d+Z$/, "Z")}</time>;
    const href = linkFor(k, v);
    return href ? <Link href={href}>{v}</Link> : <>{v}</>;
  }
  if (Array.isArray(v)) return <span className="chip">{v.length} {labels.itemsCount}</span>;
  if (typeof v === "object") return <span className="chip">{Object.keys(v).length} {labels.fieldsCount}</span>;
  return <>{String(v)}</>;
}
