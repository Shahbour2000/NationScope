import type { z } from "zod";

/** Parses each row independently so one malformed row never hides the rest. */
export function parseRows<S extends z.ZodTypeAny>(raw: unknown, schema: S): { rows: z.infer<S>[]; skipped: number } {
  if (!Array.isArray(raw)) return { rows: [], skipped: 0 };
  const rows: z.infer<S>[] = [];
  let skipped = 0;
  for (const item of raw) {
    const r = schema.safeParse(item);
    if (r.success) rows.push(r.data); else skipped++;
  }
  return { rows, skipped };
}

export const asRecord = (v: unknown): Record<string, unknown> => (typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
