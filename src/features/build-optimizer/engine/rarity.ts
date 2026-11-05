import { defineFormula } from './registry';

export type RarityName = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';
export const RARITIES: readonly RarityName[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];
export type GearSlot = 'weapon' | 'helmet' | 'gloves' | 'chest' | 'legs' | 'boots';
type Range = readonly [number, number];

defineFormula({ id: 'gear.rarityRanges', version: 1, status: 'documented',
  summary: 'Possible stat range per slot and rarity (inclusive). A range, never an exact item value; real item stats always take priority.',
  source: 'wiki 01-basics §3.3; project owner 2026-10-31', inputs: ['slot', 'rarity'], outputs: ['range'], dependsOn: [], tests: ['rarity ranges'] });

/** Wiki table. The API/wiki "Mythical" is accepted as 'mythic'. */
export const RARITY_RANGES: Record<RarityName, { weaponAttack: Range; weaponCrit: Range; helmetCritDamage: Range; armor: Range; dodge: Range; accuracy: Range }> = {
  common: { weaponAttack: [20, 35], weaponCrit: [2, 6], helmetCritDamage: [1, 12], armor: [1, 6], dodge: [1, 6], accuracy: [1, 6] },
  uncommon: { weaponAttack: [45, 65], weaponCrit: [5, 9], helmetCritDamage: [12, 28], armor: [6, 14], dodge: [6, 14], accuracy: [6, 14] },
  rare: { weaponAttack: [75, 100], weaponCrit: [10, 16], helmetCritDamage: [28, 48], armor: [14, 24], dodge: [14, 24], accuracy: [14, 24] },
  epic: { weaponAttack: [110, 145], weaponCrit: [15, 22], helmetCritDamage: [48, 72], armor: [24, 36], dodge: [24, 36], accuracy: [24, 36] },
  legendary: { weaponAttack: [150, 190], weaponCrit: [24, 32], helmetCritDamage: [72, 100], armor: [36, 50], dodge: [36, 50], accuracy: [36, 50] },
  mythic: { weaponAttack: [230, 320], weaponCrit: [38, 48], helmetCritDamage: [100, 135], armor: [50, 67], dodge: [50, 67], accuracy: [50, 67] },
};
export const normaliseRarity = (r: string | null | undefined): RarityName | null => {
  const k = (r ?? '').trim().toLowerCase(); const m = k === 'mythical' ? 'mythic' : k;
  return (RARITIES as readonly string[]).includes(m) ? (m as RarityName) : null;
};
export type StatEstimate = 'low' | 'mid' | 'high';
const pick = (r: Range, w: StatEstimate): number => (w === 'low' ? r[0] : w === 'high' ? r[1] : (r[0] + r[1]) / 2);

/** Stat bundle for a slot at a rarity, as a RANGE point (low/mid/high). Only for items whose real stats are unknown. */
export function rarityStats(slot: GearSlot, rarity: RarityName, w: StatEstimate): Record<string, number> {
  const t = RARITY_RANGES[rarity];
  switch (slot) {
    case 'weapon': return { attack: pick(t.weaponAttack, w), critChance: pick(t.weaponCrit, w) };
    case 'helmet': return { critDamage: pick(t.helmetCritDamage, w) };
    case 'gloves': return { accuracy: pick(t.accuracy, w) };
    case 'boots': return { dodge: pick(t.dodge, w) };
    default: return { armor: pick(t.armor, w) };
  }
}
/** Data check: do real item stats lie inside the documented range for their rarity? Returns human-readable violations (empty = consistent). */
export function validateItemStats(slot: GearSlot, rarity: RarityName, stats: Record<string, number>): string[] {
  const out: string[] = []; const lo = rarityStats(slot, rarity, 'low'), hi = rarityStats(slot, rarity, 'high');
  for (const k of Object.keys(lo)) { const v = stats[k]; if (typeof v === 'number' && (v < lo[k]! || v > hi[k]!)) out.push(`${slot} ${rarity} ${k}=${v} outside ${lo[k]}-${hi[k]}`); }
  return out;
}
