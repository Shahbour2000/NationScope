"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { MobileSort } from "@/components/MobileSort";
import { marketView, type MarketView } from "@/features/economy/analytics";
import { ItemIcon, Money } from "@/features/entities/entities";
import { itemName, type Display } from "@/features/entities/display";
import type { MarketRow } from "@/lib/domain/economy";
import type { Messages } from "@/i18n/messages";

type Key = "item" | "ask" | "bid" | "last" | "spread" | "askQty";
const bigCmp = (a: bigint | null, b: bigint | null) => (a === null ? 1 : b === null ? -1 : a < b ? -1 : a > b ? 1 : 0);

export function MarketTable({ rows, d, m }: { rows: MarketRow[]; d: Display; m: Messages["economyPage"] }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ key: Key; dir: 1 | -1 }>({ key: "item", dir: 1 });
  const nf = useMemo(() => new Intl.NumberFormat(d.nl), [d.nl]);
  const view = useMemo(() => marketView(rows), [rows]);
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const f = view.filter((v) => !needle || itemName(v.itemCode, d).toLowerCase().includes(needle) || v.itemCode.toLowerCase().includes(needle));
    const cmp = (a: MarketView, b: MarketView): number => {
      switch (sort.key) {
        case "item": return itemName(a.itemCode, d).localeCompare(itemName(b.itemCode, d));
        case "ask": return bigCmp(a.ask, b.ask);
        case "bid": return bigCmp(a.bid, b.bid);
        case "last": return bigCmp(a.last, b.last);
        case "spread": return a.spreadBps === null ? 1 : b.spreadBps === null ? -1 : a.spreadBps - b.spreadBps;
        case "askQty": return a.askQty - b.askQty;
      }
    };
    // Missing values stay last in both directions.
    return [...f].sort((a, b) => {
      const an = sort.key === "ask" ? a.ask === null : sort.key === "bid" ? a.bid === null : sort.key === "last" ? a.last === null : sort.key === "spread" ? a.spreadBps === null : false;
      const bn = sort.key === "ask" ? b.ask === null : sort.key === "bid" ? b.bid === null : sort.key === "last" ? b.last === null : sort.key === "spread" ? b.spreadBps === null : false;
      if (an !== bn) return an ? 1 : -1;
      return cmp(a, b) * sort.dir;
    });
  }, [view, q, sort, d]);

  const th = (key: Key, label: string, numeric = false) => (
    <th scope="col" className={numeric ? "num" : undefined} aria-sort={sort.key === key ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
      <button type="button" className="sortbtn" onClick={() => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : 1 }))}>{label}{sort.key === key ? (sort.dir === 1 ? " ▲" : " ▼") : ""}</button>
    </th>
  );

  return (
    <>
      <div className="filterbar"><label>{d.m.ui.search}<input className="field" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={m.item} /></label></div>
      <MobileSort label={d.m.ui.sortBy} value={sort.key} dir={sort.dir === 1 ? "asc" : "desc"} onKey={(k) => setSort((s) => ({ ...s, key: k as Key }))} onDir={() => setSort((s) => ({ ...s, dir: s.dir === 1 ? -1 : 1 }))}
        options={[{ key: "item", label: m.item }, { key: "ask", label: m.bestAsk }, { key: "bid", label: m.bestBid }, { key: "last", label: m.last }, { key: "spread", label: m.spread }, { key: "askQty", label: m.askQty }]} />
      <div className="tablewrap">
        <table className="table">
          <thead><tr>{th("item", m.item)}{th("ask", m.bestAsk, true)}{th("bid", m.bestBid, true)}{th("last", m.last, true)}{th("spread", m.spread, true)}{th("askQty", m.askQty, true)}<th scope="col" className="num">{m.bidQty}</th></tr></thead>
          <tbody>
            {shown.map((v) => (
              <tr key={v.itemCode}>
                <td data-label={m.item}><Link className="ichip" href={`/market/${encodeURIComponent(v.itemCode)}`}><ItemIcon code={v.itemCode} /><span>{itemName(v.itemCode, d)}</span></Link></td>
                <td className="num" data-label={m.bestAsk}>{v.ask === null ? <span className="chip">{m.noAsk}</span> : <Money value={v.ask.toString()} d={d} />}</td>
                <td className="num" data-label={m.bestBid}>{v.bid === null ? <span className="chip">{m.noBid}</span> : <Money value={v.bid.toString()} d={d} />}</td>
                <td className="num" data-label={m.last}>{v.last === null ? <span className="chip">{m.noTrades}</span> : <Money value={v.last.toString()} d={d} />}</td>
                <td className="num" data-label={m.spread}>{v.spreadBps === null ? "—" : `${nf.format(v.spreadBps / 100)}%`}</td>
                <td className="num" data-label={m.askQty}>{nf.format(v.askQty)}</td>
                <td className="num" data-label={m.bidQty}>{nf.format(v.bidQty)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
