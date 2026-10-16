/** Structural summary of arbitrary JSON, used to inspect real responses without guessing. */
export type Shape =
  | { t: "object"; keys: Record<string, Shape>; extra: number }
  | { t: "array"; length: number; item: Shape | null }
  | { t: "mixed"; of: string[] }
  | { t: "string" | "number" | "boolean" | "null" };

const MAX_KEYS = 60;
const MAX_DEPTH = 6;
const ITEM_SAMPLE = 25;

function merge(a: Shape, b: Shape): Shape {
  if (a.t === "object" && b.t === "object") {
    const keys: Record<string, Shape> = { ...a.keys };
    for (const [k, v] of Object.entries(b.keys)) keys[k] = k in keys ? merge(keys[k] as Shape, v) : v;
    return { t: "object", keys, extra: Math.max(a.extra, b.extra) };
  }
  if (a.t === "array" && b.t === "array") {
    return { t: "array", length: Math.max(a.length, b.length), item: a.item && b.item ? merge(a.item, b.item) : (a.item ?? b.item) };
  }
  if (a.t === b.t && a.t !== "mixed") return a;
  const names = (s: Shape) => (s.t === "mixed" ? s.of : [s.t]);
  return { t: "mixed", of: [...new Set([...names(a), ...names(b)])].sort() };
}

export function shapeOf(value: unknown, depth = 0): Shape {
  if (value === null) return { t: "null" };
  if (typeof value === "string") return { t: "string" };
  if (typeof value === "number") return { t: "number" };
  if (typeof value === "boolean") return { t: "boolean" };
  if (depth >= MAX_DEPTH) return { t: "mixed", of: ["(depth limit)"] };
  if (Array.isArray(value)) {
    let item: Shape | null = null;
    for (const el of value.slice(0, ITEM_SAMPLE)) {
      const s = shapeOf(el, depth + 1);
      item = item ? merge(item, s) : s;
    }
    return { t: "array", length: value.length, item };
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    const keys: Record<string, Shape> = {};
    for (const [k, v] of entries.slice(0, MAX_KEYS)) keys[k] = shapeOf(v, depth + 1);
    return { t: "object", keys, extra: Math.max(0, entries.length - MAX_KEYS) };
  }
  return { t: "mixed", of: [typeof value] };
}

export function renderShape(s: Shape, indent = 0): string {
  const pad = "  ".repeat(indent);
  switch (s.t) {
    case "object": {
      const lines = Object.entries(s.keys).map(([k, v]) => `${pad}  ${k}: ${renderShape(v, indent + 1).trimStart()}`);
      if (s.extra > 0) lines.push(`${pad}  … ${s.extra} more keys`);
      return lines.length ? `{\n${lines.join("\n")}\n${pad}}` : "{}";
    }
    case "array":
      return s.item ? `array(${s.length}) of ${renderShape(s.item, indent).trimStart()}` : `array(${s.length}) empty`;
    case "mixed":
      return s.of.join(" | ");
    default:
      return s.t;
  }
}

export function headline(s: Shape): string {
  if (s.t === "object") return `object, ${Object.keys(s.keys).length + s.extra} keys`;
  if (s.t === "array") return `array, ${s.length} items`;
  return s.t === "mixed" ? s.of.join(" | ") : s.t;
}
