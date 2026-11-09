import type { FloorRow } from "@/lib/domain/economy";
import { RARITY_ORDER, SLOT_ORDER } from "./analytics";

/** The six rarity codes the API returns, lowest to highest. The colour of each is a display mapping (white, green, blue, purple, gold, red); the code itself always comes from the API. */
export const RARITY_COLORS: Record<string, string> = { common: "#e5e7eb", uncommon: "#4ade80", rare: "#60a5fa", epic: "#c084fc", legendary: "#facc15", mythic: "#f87171" };
export const isKnownRarity = (r: string): boolean => RARITY_ORDER.includes(r);

export interface FloorCell { slot: string; rarity: string; low: string; offers: number; lowest: boolean }
export interface FloorGroup { slot: string; cells: (FloorCell | { slot: string; rarity: string; empty: true })[] }

const big = (v: string): bigint | null => (/^\d+$/.test(v) ? BigInt(v) : null);

/**
 * Groups the floor by slot. Every slot lists all six known rarities in order (a missing one is an explicit "no offers" tile, never a guessed price),
 * followed by any rarity code the API returns that NationScope does not know. `lowest` marks the cheapest priced rarity of the slot.
 */
export function floorGroups(rows: readonly FloorRow[], filter: { slot?: string | undefined; rarity?: string | undefined } = {}): FloorGroup[] {
  const slots = [...SLOT_ORDER.filter((s) => rows.some((r) => r.slot === s)), ...[...new Set(rows.map((r) => r.slot))].filter((s) => !SLOT_ORDER.includes(s)).sort()];
  const out: FloorGroup[] = [];
  for (const slot of slots) {
    if (filter.slot && filter.slot !== slot) continue;
    const inSlot = rows.filter((r) => r.slot === slot);
    const unknown = [...new Set(inSlot.map((r) => r.rarity))].filter((r) => !isKnownRarity(r)).sort();
    const rarities = [...RARITY_ORDER, ...unknown].filter((r) => !filter.rarity || filter.rarity === r);
    let min: bigint | null = null;
    for (const r of inSlot) { const v = big(String(r.low)); if (v !== null && (min === null || v < min)) min = v; }
    const cells = rarities.map((rarity) => {
      const row = inSlot.find((r) => r.rarity === rarity);
      if (!row) return { slot, rarity, empty: true as const };
      return { slot, rarity, low: String(row.low), offers: row.offers, lowest: min !== null && big(String(row.low)) === min };
    });
    out.push({ slot, cells });
  }
  return out;
}
