/** Pure pin logic (no React, no storage access) so it is easy to test. Pins live in the browser only. */
export const PIN_TYPES = ["country", "player", "alliance", "party", "unit"] as const;
export type PinType = (typeof PIN_TYPES)[number];

export interface Pin {
  type: PinType;
  id: string;
  name: string;
  /** Flag path, avatar or emblem URL, or null. */
  image: string | null;
  /** Site-relative link to the entity page. */
  href: string;
  at: number;
}

export const PIN_KEY = "ns.pins.v1";
export const MAX_PINS = 200;
const ID = /^[A-Za-z0-9_-]{1,80}$/;

const safeHref = (h: unknown): h is string => typeof h === "string" && h.startsWith("/") && !h.startsWith("//") && h.length <= 200 && !/[\s<>"]/.test(h);
const safeImage = (v: unknown): string | null => (typeof v === "string" && v.length <= 300 && (v.startsWith("/") && !v.startsWith("//") || /^https:\/\//.test(v)) ? v : null);

/** Parses stored JSON defensively: wrong shapes are dropped, duplicates collapse, length is capped. */
export function parsePins(raw: string | null | undefined): Pin[] {
  if (!raw) return [];
  let data: unknown;
  try { data = JSON.parse(raw); } catch { return []; }
  if (!Array.isArray(data)) return [];
  const seen = new Set<string>();
  const out: Pin[] = [];
  for (const x of data) {
    if (typeof x !== "object" || x === null) continue;
    const r = x as Record<string, unknown>;
    if (!(PIN_TYPES as readonly unknown[]).includes(r.type) || typeof r.id !== "string" || !ID.test(r.id)) continue;
    if (typeof r.name !== "string" || !r.name.trim() || !safeHref(r.href)) continue;
    const key = `${r.type}:${r.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ type: r.type as PinType, id: r.id, name: r.name.trim().slice(0, 80), image: safeImage(r.image), href: r.href, at: typeof r.at === "number" ? r.at : 0 });
    if (out.length >= MAX_PINS) break;
  }
  return out;
}

export const serializePins = (pins: readonly Pin[]): string => JSON.stringify(pins);
export const hasPin = (pins: readonly Pin[], type: PinType, id: string): boolean => pins.some((p) => p.type === type && p.id === id);

/** Adding an existing pin refreshes its name/image/link in place; it never creates a duplicate. */
export function addPin(pins: readonly Pin[], pin: Pin): Pin[] {
  const i = pins.findIndex((p) => p.type === pin.type && p.id === pin.id);
  if (i >= 0) return pins.map((p, j) => (j === i ? { ...pin, at: p.at } : p));
  return [...pins, pin].slice(-MAX_PINS);
}

export const removePin = (pins: readonly Pin[], type: PinType, id: string): Pin[] => pins.filter((p) => !(p.type === type && p.id === id));
export const togglePin = (pins: readonly Pin[], pin: Pin): Pin[] => (hasPin(pins, pin.type, pin.id) ? removePin(pins, pin.type, pin.id) : addPin(pins, pin));

export function groupPins(pins: readonly Pin[]): { type: PinType; pins: Pin[] }[] {
  return PIN_TYPES.map((type) => ({ type, pins: pins.filter((p) => p.type === type).sort((a, b) => a.name.localeCompare(b.name)) })).filter((g) => g.pins.length > 0);
}
