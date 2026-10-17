import { Fragment } from "react";
import { StateMessage } from "@/components/StateMessage";
import type { Messages } from "@/i18n/messages";
import { Cell } from "./Cell";
import { pickColumns } from "./columns";
import { GenericTable } from "./GenericTable";
import { isRecord, isScalar, listOf, objectRows, type Row } from "./shape";

type L = Messages["explorer"];
const MAX_DEPTH = 5;

function summaryOf(v: unknown, l: L): string {
  if (Array.isArray(v)) return `${v.length} ${l.itemsCount}`;
  if (isRecord(v)) return `${Object.keys(v).length} ${l.fieldsCount}`;
  return "";
}

function Nested({ value, depth, l }: { value: unknown; depth: number; l: L }) {
  if (depth >= MAX_DEPTH) return <pre className="pre">{JSON.stringify(value, null, 1)}</pre>;
  if (Array.isArray(value)) {
    const rows = objectRows(value);
    if (rows) return <GenericTable rows={rows} columns={pickColumns(rows)} section={null} labels={l} />;
    return <ul className="keys">{value.map((x, i) => <li key={i}>{isScalar(x) ? <Cell k="" v={x} labels={l} /> : summaryOf(x, l)}</li>)}</ul>;
  }
  if (isRecord(value)) return <KeyValue value={value} depth={depth} l={l} />;
  return <Cell k="" v={value} labels={l} />;
}

function KeyValue({ value, depth, l }: { value: Row; depth: number; l: L }) {
  const entries = Object.entries(value);
  const scalars = entries.filter(([, v]) => isScalar(v));
  const nested = entries.filter(([, v]) => !isScalar(v));
  return (
    <>
      {scalars.length > 0 && (
        <dl className="rows">
          {scalars.map(([k, v]) => (
            <Fragment key={k}><dt>{k}</dt><dd><Cell k={k} v={v} labels={l} /></dd></Fragment>
          ))}
        </dl>
      )}
      {nested.map(([k, v]) => (
        <details key={k} open={depth < 1}>
          <summary>{k} <span className="chip">{summaryOf(v, l)}</span></summary>
          <div className="nested"><Nested value={v} depth={depth + 1} l={l} /></div>
        </details>
      ))}
    </>
  );
}

/** Generic renderer for any endpoint response. `section` enables row links to `/{section}/{id}` when rows carry a string id. */
export function DataView({ data, section, detailLinks, labels }: { data: unknown; section: string | null; detailLinks: boolean; labels: L }) {
  const list = listOf(data);
  if (list) {
    const rows = objectRows(list.rows);
    return (
      <>
        {Object.keys(list.rest).length > 0 && <section className="panel" style={{ marginBlockEnd: "1rem" }}><KeyValue value={list.rest} depth={1} l={labels} /></section>}
        {rows ? (
          <GenericTable rows={rows} columns={pickColumns(rows)} section={detailLinks ? section : null} labels={labels} />
        ) : list.rows.length === 0 ? (
          <StateMessage tone="empty" title={labels.empty} detail="" />
        ) : (
          <ul className="keys">{list.rows.map((x, i) => <li key={i}><Cell k="" v={x} labels={labels} /></li>)}</ul>
        )}
      </>
    );
  }
  if (isRecord(data)) {
    return Object.keys(data).length === 0
      ? <StateMessage tone="empty" title={labels.empty} detail="" />
      : <section className="panel"><KeyValue value={data} depth={0} l={labels} /></section>;
  }
  if (data === null || data === undefined) return <StateMessage tone="empty" title={labels.empty} detail="" />;
  return <pre className="pre">{JSON.stringify(data)}</pre>;
}
