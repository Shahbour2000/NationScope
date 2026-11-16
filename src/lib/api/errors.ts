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

/**
 * Type guard that survives module duplication. In Next.js dev (and when a client component boundary or separate server bundles
 * load this file twice) `error instanceof ApiError` can be false for a genuine ApiError, which made 404s read "Something went
 * wrong". Matches by name and shape instead.
 */
export function isApiError(e: unknown): e is ApiError {
  if (e instanceof ApiError) return true;
  return typeof e === "object" && e !== null && (e as { name?: unknown }).name === "ApiError" && typeof (e as { kind?: unknown }).kind === "string";
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

export interface ErrorTexts {
  unexpected: { title: string; detail: string }; timeout: { title: string; detail: string }; network: { title: string; detail: string };
  rateLimited: { title: string; detail: string; wait: string }; notFound: { title: string; detail: string }; httpError: { title: string; detail: string };
  invalidJson: { title: string; detail: string }; validation: { title: string; detail: string }; invalidRequest: { title: string }; config: { title: string };
}
/** English texts, also the default. Localised copies live in the message files (`errors`). */
export const EN_ERROR_TEXTS: ErrorTexts = {
  unexpected: { title: "Something went wrong", detail: "An unexpected error occurred." },
  timeout: { title: "The API took too long to respond", detail: "The request timed out. The game API may be slow or unavailable." },
  network: { title: "Could not reach the API", detail: "The request failed before a response arrived. Check your connection and the configured API origin." },
  rateLimited: { title: "Request limit reached", detail: "The API rate limit was hit.", wait: "Try again in about {s} seconds." },
  notFound: { title: "Not found", detail: "The API reports that this resource does not exist." },
  httpError: { title: "The API returned an error", detail: "The API answered with HTTP {status}." },
  invalidJson: { title: "Unreadable API response", detail: "The API response was not valid JSON." },
  validation: { title: "Unexpected API response shape", detail: "The response did not match what NationScope expects. The API may have changed." },
  invalidRequest: { title: "Invalid request" }, config: { title: "Configuration problem" },
};

/** User-facing text. Never includes URLs, headers or upstream bodies. Pass the page's localised texts as `x`. */
export function describeError(error: unknown, x: ErrorTexts = EN_ERROR_TEXTS): ErrorDescription {
  if (!isApiError(error)) return { ...x.unexpected, canRetry: true };
  switch (error.kind) {
    case "timeout": return { ...x.timeout, canRetry: true };
    case "network": return { ...x.network, canRetry: true };
    case "rate_limited": {
      const wait = error.retryAfterMs ? ` ${x.rateLimited.wait.replace("{s}", String(Math.ceil(error.retryAfterMs / 1000)))}` : "";
      return { title: x.rateLimited.title, detail: `${x.rateLimited.detail}${wait}`, canRetry: true };
    }
    case "http":
      return error.status === 404
        ? { ...x.notFound, canRetry: false }
        : { title: x.httpError.title, detail: x.httpError.detail.replace("{status}", String(error.status ?? "error")), canRetry: (error.status ?? 0) >= 500 };
    case "invalid_response": return { ...x.invalidJson, canRetry: true };
    case "validation": return { ...x.validation, canRetry: true };
    case "invalid_request": return { title: x.invalidRequest.title, detail: error.message, canRetry: false };
  }
}
