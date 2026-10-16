import { tryGetConfig } from "@/lib/config/env";
import type { Messages } from "@/i18n/messages";

export function EnvBadge({ labels }: { labels: Messages["common"]["environment"] }) {
  const env = tryGetConfig()?.environment ?? "unconfigured";
  return (
    <span className="env-badge" data-env={env}>
      {labels[env]}
    </span>
  );
}
