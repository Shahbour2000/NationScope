import { getLocale, getMessages } from "@/i18n";
import { describeError } from "@/lib/api/errors";
import { ConfigError } from "@/lib/config/env";
import { RetryButton } from "./RetryButton";
import { StateMessage } from "./StateMessage";

/** One place that turns any thrown data-layer error into a safe, retryable, localised error state (server component: reads the page locale itself). */
export async function ApiErrorState({ error, retryLabel }: { error: unknown; retryLabel?: string }) {
  const m = getMessages(await getLocale());
  if (error instanceof ConfigError) return <StateMessage tone="error" title={m.errors.config.title} detail={error.message} />;
  const d = describeError(error, m.errors);
  return <StateMessage tone="error" title={d.title} detail={d.detail} action={d.canRetry ? <RetryButton label={retryLabel ?? m.common.retry} /> : undefined} />;
}
