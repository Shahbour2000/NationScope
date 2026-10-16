import { ApiStatusPanel } from "@/components/ApiStatusPanel";
import { RetryButton } from "@/components/RetryButton";
import { StateMessage } from "@/components/StateMessage";
import { describeError } from "@/lib/api/errors";
import { ConfigError, getConfig } from "@/lib/config/env";
import { getGameInfo } from "@/lib/data/game";
import { summarizePayload } from "@/lib/data/inspect";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  try {
    getConfig();
  } catch (error) {
    if (error instanceof ConfigError) {
      return <StateMessage tone="error" title="Configuration problem" detail={error.message} />;
    }
    throw error;
  }

  try {
    const { data, meta } = await getGameInfo();
    return (
      <>
        <h1>Foundation status</h1>
        <ApiStatusPanel meta={meta} summary={summarizePayload(data)} />
      </>
    );
  } catch (error) {
    const d = describeError(error);
    return (
      <StateMessage
        tone="error"
        title={d.title}
        detail={d.detail}
        action={d.canRetry ? <RetryButton /> : undefined}
      />
    );
  }
}
