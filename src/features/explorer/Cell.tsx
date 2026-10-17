import Link from "next/link";
import type { Messages } from "@/i18n/messages";
import { linkFor } from "./links";

export type CellLabels = Pick<Messages["explorer"], "yes" | "no" | "missing" | "itemsCount" | "fieldsCount">;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

/** Renders one API value exactly as received. Missing (null) is distinct from 0 and false. */
export function Cell({ k, v, labels }: { k: string; v: unknown; labels: CellLabels }) {
  if (v === null || v === undefined) return <span className="chip">{labels.missing}</span>;
  if (typeof v === "boolean") return <>{v ? labels.yes : labels.no}</>;
  if (typeof v === "number") return <>{String(v)}</>;
  if (typeof v === "string") {
    if (ISO.test(v)) return <time dateTime={v}>{v.replace("T", " ").replace(/\.\d+Z$/, "Z")}</time>;
    const href = linkFor(k, v);
    return href ? <Link href={href}>{v}</Link> : <>{v}</>;
  }
  if (Array.isArray(v)) return <span className="chip">{v.length} {labels.itemsCount}</span>;
  if (typeof v === "object") return <span className="chip">{Object.keys(v).length} {labels.fieldsCount}</span>;
  return <>{String(v)}</>;
}
