"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Messages } from "@/i18n/messages";
import { Cell } from "./Cell";
import { rowHref } from "./links";
import type { Row } from "./shape";
import { sortRows } from "./sort";

interface Props { rows: Row[]; columns: string[]; section: string | null; labels: Messages["explorer"] }
const RENDER_CAP = 200;

/** Sortable, filterable table over arbitrary rows. Columns come from the data, never from assumed field names. */
export function GenericTable({ rows, columns, section, labels }: Props) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" } | null>(null);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = needle ? rows.filter((r) => columns.some((c) => String(r[c] ?? "").toLowerCase().includes(needle))) : rows;
    return sort ? sortRows(filtered, sort.key, sort.dir) : filtered;
  }, [rows, columns, q, sort]);

  const visible = shown.slice(0, RENDER_CAP);
  return (
    <>
      <div className="toolbar">
        <input className="field" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={labels.filter} aria-label={labels.filter} />
      </div>
      <p className="note">{labels.showing} {visible.length} {labels.of} {rows.length} {labels.rows}</p>
      <div className="tablewrap">
        <table className="table">
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c} scope="col" aria-sort={sort?.key === c ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
                  <button type="button" className="sortbtn" onClick={() => setSort((s) => ({ key: c, dir: s?.key === c && s.dir === "asc" ? "desc" : "asc" }))}>
                    {c}{sort?.key === c ? (sort.dir === "asc" ? " ▲" : " ▼") : ""}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((r, i) => {
              const href = section ? rowHref(section, r) : null;
              return (
                <tr key={i}>
                  {columns.map((c, ci) => (
                    <td key={c} data-label={c}>
                      {ci === 0 && href ? <Link href={href}><Cell k={c} v={r[c]} labels={labels} /></Link> : <Cell k={c} v={r[c]} labels={labels} />}
                    </td>
                  ))}
                </tr>
              );
            })}
            {visible.length === 0 && <tr><td colSpan={columns.length}>{labels.noRows}</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
