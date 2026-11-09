"use client";

import { useMemo, useState, type ReactNode } from "react";
import { sortRows } from "@/features/explorer/sort";

export type SortDir = "asc" | "desc";
export interface SortState { key: string; dir: SortDir }

/**
 * Shared sorting for client tables. Sorts RAW values (numbers, ISO dates, plain strings), never formatted text; missing values always sort last;
 * ties keep their original order (stable). Clicking the active column flips the direction, a new column starts at `defaultDir`.
 */
export function useSort<T extends Record<string, unknown>>(rows: readonly T[], initial: SortState | null = null) {
  const [sort, setSort] = useState<SortState | null>(initial);
  const sorted = useMemo(() => (sort ? sortRows(rows, sort.key, sort.dir) : [...rows]), [rows, sort]);
  const toggle = (key: string, defaultDir: SortDir = "asc") => setSort((s) => (s?.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: defaultDir }));
  return { sort, sorted, toggle, setSort };
}

/** <th> with a sort button, a visible direction indicator and aria-sort. */
export function SortTh({ k, sort, onSort, defaultDir = "asc", align, children }: { k: string; sort: SortState | null; onSort: (key: string, defaultDir?: SortDir) => void; defaultDir?: SortDir; align?: "end"; children: ReactNode }) {
  const active = sort?.key === k;
  return (
    <th scope="col" aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"} style={align === "end" ? { textAlign: "end" } : undefined}>
      <button type="button" className="sortbtn" data-active={active || undefined} onClick={() => onSort(k, defaultDir)}>
        {children}<span className="sort-ind" aria-hidden="true">{active ? (sort.dir === "asc" ? "▲" : "▼") : "↕"}</span>
      </button>
    </th>
  );
}
