import type { ApiResultMeta } from "@/lib/api/client";
import type { Messages } from "@/i18n/messages";

/** Quiet footer: only what a player needs (is this data old? when was it fetched?). No hosts, sources or error reasons. */
export function Provenance({ meta, m, note }: { meta: ApiResultMeta; m: Messages; note?: string }) {
  const at = new Date(meta.fetchedAt);
  const hhmm = Number.isNaN(at.getTime()) ? null : at.toISOString().slice(11, 16);
  return (
    <>
      {meta.source === "stale" && <p className="banner" role="status">{m.common.source.stale} ({Math.max(1, Math.round(meta.ageMs / 60000))} min)</p>}
      {hhmm && (
        <p className="provenance">
          {m.common.receivedAt} <time dateTime={meta.fetchedAt}>{hhmm} {m.time.utc}</time>
          {note ? <><br />{note}</> : null}
        </p>
      )}
    </>
  );
}
