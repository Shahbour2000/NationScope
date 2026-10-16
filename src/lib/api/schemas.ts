import { z } from "zod";

/**
 * The OpenAPI spec types every response as `{ type: "object", additionalProperties: true }`
 * and documents no fields. Until real responses are captured as fixtures, the only claim
 * we validate is "a JSON object". Do not read specific fields from this type.
 */
export const unverifiedPayload = z.record(z.string(), z.unknown());
export type UnverifiedPayload = z.infer<typeof unverifiedPayload>;

/** Accepts any JSON value. Used only by the diagnostics explorer, never by feature code. */
export const anyJson = z.unknown();
