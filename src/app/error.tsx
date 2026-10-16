"use client";

import { StateMessage } from "@/components/StateMessage";

/** Last-resort boundary for unexpected render errors. Expected API errors are handled in pages. */
export default function ErrorBoundary({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <StateMessage
      tone="error"
      title="Something went wrong"
      detail="An unexpected error occurred while loading this page."
      action={<button type="button" className="btn" onClick={reset}>Try again</button>}
    />
  );
}
