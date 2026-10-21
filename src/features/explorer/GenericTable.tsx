"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Messages } from "@/i18n/messages";
import { MobileSort } from "@/components/MobileSort";
import type { Display } from "@/features/entities/display";
import { Cell } from "./Cell";
import { rowHref } from "./links";
import type { Row } from "./shape";
import { sortRows } from "./sort";

interface Props { rows: Row[]; columns: string[]; section: string | null; labels: Messages["explorer"]; d?: Display }
const RENDER_CAP = 200;

/** Sortable, filterable table over arbitrary rows. Columns come from the data, never from assumed field names. */
export function GenericTable({ rows, columns, section, labels, d }: Props) {
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
      <MobileSort label={d?.m.ui.sortBy ?? "Sort by"} value={sort?.key ?? columns[0] ?? ""} dir={sort?.dir ?? "asc"} onKey={(k) => setSort((s) => ({ key: k, dir: s?.dir ?? "asc" }))} onDir={() => setSort((s) => ({ key: s?.key ?? columns[0] ?? "", dir: s?.dir === "asc" ? "desc" : "asc" }))}
        options={columns.map((c) => ({ key: c, label: c }))} />
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
                      {ci === 0 && href ? <Link href={href}><Cell k={c} v={r[c]} labels={labels} d={d} /></Link> : <Cell k={c} v={r[c]} labels={labels} d={d} />}
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
