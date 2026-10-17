import type { ApiResultMeta } from "@/lib/api/client";
import type { Messages } from "@/i18n/messages";

export function Provenance({ meta, m, note }: { meta: ApiResultMeta; m: Messages; note?: string }) {
  return (
    <>
      {meta.source === "stale" && (
        <p className="banner" role="status">{m.common.source.stale} ({Math.round(meta.ageMs / 1000)}s, {meta.staleReason})</p>
      )}
      <p className="provenance">
        {m.common.apiHost}: {meta.host} · {m.common.source[meta.source]} · {m.common.receivedAt} <time dateTime={meta.fetchedAt}>{meta.fetchedAt}</time>
        {note ? <><br />{note}</> : null}
      </p>
    </>
  );
}
