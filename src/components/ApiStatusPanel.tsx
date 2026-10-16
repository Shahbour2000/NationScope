import type { ApiResultMeta } from "@/lib/api/client";
import type { PayloadSummary } from "@/lib/data/inspect";
import { StateMessage } from "./StateMessage";

const SOURCE_LABEL = { live: "Live from the API", cache: "Cached (under 30s old)", stale: "Stale cached copy" } as const;

export function ApiStatusPanel({ meta, summary }: { meta: ApiResultMeta; summary: PayloadSummary }) {
  if (summary.fieldCount === 0) {
    return (
      <StateMessage
        tone="empty"
        title="The API returned an empty response"
        detail="The request succeeded but the response contains no fields."
      />
    );
  }
  return (
    <>
      {meta.source === "stale" && (
        <p className="banner" role="status">
          Showing a cached copy from {Math.round(meta.ageMs / 1000)}s ago because the live request failed ({meta.staleReason}).
        </p>
      )}
      <section className="panel" aria-labelledby="conn">
        <h2 id="conn" style={{ fontSize: "1.05rem", marginTop: 0 }}>API connection</h2>
        <dl className="rows">
          <dt>Environment</dt>
          <dd>{meta.environment === "main" ? "Main" : "Development"}</dd>
          <dt>API host</dt>
          <dd>{meta.host}</dd>
          <dt>Data source</dt>
          <dd>{SOURCE_LABEL[meta.source]}</dd>
          <dt>Received</dt>
          <dd><time dateTime={meta.fetchedAt}>{meta.fetchedAt}</time></dd>
          <dt>Response</dt>
          <dd>
            Object with {summary.fieldCount} top-level field{summary.fieldCount === 1 ? "" : "s"}
            <ul className="keys">{summary.keys.map((k) => <li key={k}>{k}</li>)}</ul>
          </dd>
        </dl>
        <p className="note">Only field names are shown. Field contents are not interpreted until response shapes are verified.</p>
      </section>
    </>
  );
}
