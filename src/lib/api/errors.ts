export type ApiErrorKind =
  | "timeout"
  | "network"
  | "http"
  | "rate_limited"
  | "invalid_request"
  | "invalid_response"
  | "validation";

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status?: number;
  readonly retryAfterMs?: number;
  /** True when our own request budget was exhausted (upstream was not contacted). */
  readonly local: boolean;

  constructor(
    kind: ApiErrorKind,
    message: string,
    opts: { status?: number; retryAfterMs?: number; local?: boolean; cause?: unknown } = {},
  ) {
    super(message, opts.cause !== undefined ? { cause: opts.cause } : undefined);
    this.name = "ApiError";
    this.kind = kind;
    this.status = opts.status;
    this.retryAfterMs = opts.retryAfterMs;
    this.local = opts.local ?? false;
  }
}

/** Errors for which a stale cached copy (same environment) may be shown, clearly flagged. */
export function isDegradable(error: ApiError): boolean {
  return (
    error.kind === "timeout" ||
    error.kind === "network" ||
    error.kind === "rate_limited" ||
    (error.kind === "http" && (error.status ?? 0) >= 500)
  );
}

export interface ErrorDescription {
  title: string;
  detail: string;
  canRetry: boolean;
}

/** User-facing text. Never includes URLs, headers or upstream bodies. */
export function describeError(error: unknown): ErrorDescription {
  if (!(error instanceof ApiError)) {
    return { title: "Something went wrong", detail: "An unexpected error occurred.", canRetry: true };
  }
  switch (error.kind) {
    case "timeout":
      return { title: "The API took too long to respond", detail: "The request timed out. The game API may be slow or unavailable.", canRetry: true };
    case "network":
      return { title: "Could not reach the API", detail: "The request failed before a response arrived. Check your connection and the configured API origin.", canRetry: true };
    case "rate_limited": {
      const wait = error.retryAfterMs ? ` Try again in about ${Math.ceil(error.retryAfterMs / 1000)} seconds.` : "";
      return { title: "Request limit reached", detail: `The API rate limit was hit.${wait}`, canRetry: true };
    }
    case "http":
      return error.status === 404
        ? { title: "Not found", detail: "The API reports that this resource does not exist.", canRetry: false }
        : { title: "The API returned an error", detail: `The API answered with HTTP ${error.status ?? "error"}.`, canRetry: (error.status ?? 0) >= 500 };
    case "invalid_response":
      return { title: "Unreadable API response", detail: "The API response was not valid JSON.", canRetry: true };
    case "validation":
      return { title: "Unexpected API response shape", detail: "The response did not match what NationScope expects. The API may have changed.", canRetry: true };
    case "invalid_request":
      return { title: "Invalid request", detail: error.message, canRetry: false };
  }
}
