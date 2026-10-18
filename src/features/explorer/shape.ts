export type Row = Record<string, unknown>;
export type Scalar = string | number | boolean | null;

export const isRecord = (v: unknown): v is Row => typeof v === "object" && v !== null && !Array.isArray(v);
export const isScalar = (v: unknown): v is Scalar => v === null || ["string", "number", "boolean"].includes(typeof v);

/**
 * Finds the list in a response without assuming field names: a top-level array, or an object with
 * exactly one array-valued property. Anything else is "not recognised" (null).
 */
export function listOf(payload: unknown): { rows: unknown[]; wrappedKey: string | null; rest: Row } | null {
  if (Array.isArray(payload)) return { rows: payload, wrappedKey: null, rest: {} };
  if (isRecord(payload)) {
    const arrays = Object.entries(payload).filter(([, v]) => Array.isArray(v));
    if (arrays.length === 1) {
      const [key, rows] = arrays[0] as [string, unknown[]];
      const rest = Object.fromEntries(Object.entries(payload).filter(([k]) => k !== key));
      return { rows, wrappedKey: key, rest };
    }
  }
  return null;
}

export const countItems = (payload: unknown): number | null => listOf(payload)?.rows.length ?? null;

export function objectRows(rows: readonly unknown[]): Row[] | null {
  return rows.length > 0 && rows.every(isRecord) ? (rows as Row[]) : null;
}

/** A human title for an entity response (name / username / title / label), or null. Avoids showing raw ids in headings. */
export function entityTitle(payload: unknown): string | null {
  if (!isRecord(payload)) return null;
  for (const k of ["name", "username", "title", "label"]) {
    const v = payload[k];
    if (typeof v === "string" && v.trim()) return v;
  }
  return null;
}
