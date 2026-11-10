import type { FloorRow } from "@/lib/domain/economy";
import { RARITY_ORDER, SLOT_ORDER } from "./analytics";

/**
 * Tier of a rarity code: its position in the documented order (Wiki 01-basics §3.3: common < uncommon < rare < epic < legendary < mythic), 0-based, or -1 when the API returns a code
 * NationScope does not know. NO colour is attached to a rarity: no source documents the game's rarity colours, so the UI uses one neutral hue and the tier/label only.
 */
export const rarityRank = (r: string): number => RARITY_ORDER.indexOf(r);
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
