import { describe, expect, it } from "vitest";
import { BOUNDARY_TEXT } from "@/app/error";
import { ApiError, describeError } from "@/lib/api/errors";
import { MESSAGES } from "@/i18n/messages";

describe("localised API errors", () => {
  it("returns Arabic text for every error kind", () => {
    const ar = MESSAGES.ar.errors, en = MESSAGES.en.errors;
    const kinds: ApiError[] = [new ApiError("timeout", "t"), new ApiError("network", "n"), new ApiError("rate_limited", "r", { retryAfterMs: 4200 }), new ApiError("http", "h", { status: 404 }), new ApiError("http", "h", { status: 503 }),
      new ApiError("invalid_response", "i"), new ApiError("validation", "v")];
    for (const e of kinds) { const a = describeError(e, ar), b = describeError(e, en); expect(a.title).not.toBe(b.title); expect(a.title).toMatch(/[\u0600-\u06FF]/); expect(a.detail).toMatch(/[\u0600-\u06FF]/); expect(a.detail).not.toContain("{"); }
    expect(describeError(new Error("x"), ar).title).toBe(ar.unexpected.title);
  });
  it("fills the placeholders", () => {
    expect(describeError(new ApiError("rate_limited", "r", { retryAfterMs: 4200 }), MESSAGES.ar.errors).detail).toContain("5");
    expect(describeError(new ApiError("http", "h", { status: 503 }), MESSAGES.en.errors)).toMatchObject({ detail: "The API answered with HTTP 503.", canRetry: true });
    expect(describeError(new ApiError("http", "h", { status: 404 }), MESSAGES.en.errors).canRetry).toBe(false);
  });
  it("English defaults are unchanged when no texts are passed", () => {
    expect(describeError(new ApiError("http", "h", { status: 404 })).title).toBe("Not found");
  });
  it("the client error boundary text stays equal to the message files", () => {
    expect(BOUNDARY_TEXT.en).toEqual(MESSAGES.en.errors.boundary); expect(BOUNDARY_TEXT.ar).toEqual(MESSAGES.ar.errors.boundary);
  });
});
