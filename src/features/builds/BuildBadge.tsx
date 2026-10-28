import type { Messages } from "@/i18n/messages";
import type { BuildKind } from "./classify";

/** Pure presentational badge (safe to import from client components). */
export function BuildBadge({ kind, m }: { kind: BuildKind | null; m: Messages["builds"] }) {
  if (!kind) return <span className="muted" title={m.unknown}>—</span>;
  return <span className="bbadge" data-kind={kind}>{m[kind]}</span>;
}
