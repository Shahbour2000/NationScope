import type { Messages } from "@/i18n/messages";
import type { BuildKind } from "./classify";

/** Pure presentational badge (safe to import from client components). A missing kind means data is pending/unavailable - shown as a dash, never as a category. */
export function BuildBadge({ kind, m }: { kind: BuildKind | null; m: Messages["builds"] }) {
  if (!kind) return <span className="muted" title={m.pendingLabel}>—</span>;
  return <span className="bbadge" data-kind={kind}>{m[kind]}</span>;
}
