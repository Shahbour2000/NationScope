import { describeError } from "@/lib/api/errors";
import { ConfigError } from "@/lib/config/env";
import { RetryButton } from "./RetryButton";
import { StateMessage } from "./StateMessage";

/** One place that turns any thrown data-layer error into a safe, retryable error state. */
export function ApiErrorState({ error, retryLabel }: { error: unknown; retryLabel?: string }) {
  if (error instanceof ConfigError) {
    return <StateMessage tone="error" title="Configuration problem" detail={error.message} />;
  }
  const d = describeError(error);
  return <StateMessage tone="error" title={d.title} detail={d.detail} action={d.canRetry ? <RetryButton label={retryLabel} /> : undefined} />;
}
