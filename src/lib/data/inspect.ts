import type { UnverifiedPayload } from "@/lib/api/schemas";

export interface PayloadSummary {
  fieldCount: number;
  /** Top-level key names only, capped. Values are not interpreted. */
  keys: string[];
}

export function summarizePayload(payload: UnverifiedPayload, maxKeys = 30): PayloadSummary {
  const keys = Object.keys(payload);
  return { fieldCount: keys.length, keys: keys.slice(0, maxKeys) };
}
