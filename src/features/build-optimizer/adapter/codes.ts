import type { SkillId } from '../engine/skills';
import { RECIPES, rawRecipe, type Recipe } from '../engine/economy';

/**
 * Mapping between NationScope/API codes and engine ids.
 * confidence 'exact' = identical name; 'inferred' = matched by meaning only (wiki skill names vs API codes); confirm once against the game's Skills page.
 */
export interface CodeMap<T> { id: T; confidence: 'exact' | 'inferred'; note?: string }
export const API_SKILL_CODES: Record<string, CodeMap<SkillId> | { id: null; confidence: 'exact'; note: string }> = {
  energy: { id: 'energy', confidence: 'exact' }, health: { id: 'health', confidence: 'exact' }, hunger: { id: 'hunger', confidence: 'exact' },
  attack: { id: 'attack', confidence: 'exact' }, production: { id: 'production', confidence: 'exact' }, armor: { id: 'armor', confidence: 'exact' },
  dodge: { id: 'dodge', confidence: 'exact' }, lootChance: { id: 'lootChance', confidence: 'exact' },
  criticalChance: { id: 'critChance', confidence: 'inferred', note: 'wiki: Critical hit chance' },
  criticalDamages: { id: 'critDamage', confidence: 'inferred', note: 'wiki: Critical damage' },
  precision: { id: 'accuracy', confidence: 'inferred', note: 'wiki: Accuracy' },
  companies: { id: 'companySlots', confidence: 'inferred', note: 'wiki: Company slots' },
  entrepreneurship: { id: 'business', confidence: 'inferred', note: 'wiki: Business (the company-project/initiative bar skill)' },
  management: { id: 'leadership', confidence: 'inferred', note: 'wiki: Leadership (number of workers)' },
  stamina: { id: null, confidence: 'exact', note: 'wiki: maximum stamina is always 100; not an optimizable skill' },
};

/** Equipment offer slot -> engine gear slot, and the stat key each slot's offers carry (seen in real /equipment responses). */
export const SLOT_STAT: Record<string, { gear: 'weapon' | 'helmet' | 'gloves' | 'chest' | 'legs' | 'boots' }> = {
  weapon: { gear: 'weapon' }, helmet: { gear: 'helmet' }, gloves: { gear: 'gloves' }, chest: { gear: 'chest' }, pants: { gear: 'legs' }, boots: { gear: 'boots' },
};

/** Engine recipe id -> market/company itemCode (from real /market and /companies samples). */
export const MARKET_CODE: Record<string, CodeMap<string>> = {
  limestone: { id: 'limestone', confidence: 'exact' }, grain: { id: 'grain', confidence: 'exact' }, iron: { id: 'iron', confidence: 'exact' },
  coca: { id: 'coca', confidence: 'exact' }, lead: { id: 'lead', confidence: 'exact' }, petroleum: { id: 'petroleum', confidence: 'exact' },
  wood: { id: 'wood', confidence: 'exact' }, fish: { id: 'fish', confidence: 'exact' }, uranium: { id: 'uranium', confidence: 'exact' },
  coffeeBeans: { id: 'coffeeBeans', confidence: 'exact' }, cattle: { id: 'livestock', confidence: 'inferred', note: 'wiki "cattle"' },
  concrete: { id: 'concrete', confidence: 'exact' }, steel: { id: 'steel', confidence: 'exact' }, bread: { id: 'bread', confidence: 'exact' },
  steak: { id: 'steak', confidence: 'exact' }, cookedFish: { id: 'cookedFish', confidence: 'exact' }, oil: { id: 'oil', confidence: 'exact' },
  paper: { id: 'paper', confidence: 'exact' }, fuelCell: { id: 'fuelCell', confidence: 'exact' },
  lightBullets: { id: 'lightAmmo', confidence: 'inferred', note: 'wiki "light bullets"' },
  mediumBullets: { id: 'ammo', confidence: 'inferred', note: 'wiki "medium bullets"; plain "ammo" assumed to be medium' },
  heavyBullets: { id: 'heavyAmmo', confidence: 'inferred', note: 'wiki "heavy bullets"' },
  stimulant: { id: 'cocain', confidence: 'inferred', note: 'the Pill (stimulant) is made from coca; market code "cocain" assumed' },
  coffee: { id: 'espresso', confidence: 'inferred', note: 'wiki "coffee"; "espresso" assumed' },
};
const RAW = new Set(['limestone', 'grain', 'iron', 'coca', 'lead', 'petroleum', 'wood', 'fish', 'uranium', 'coffeeBeans', 'cattle']);
const RAW_POINTS: Record<string, number> = { cattle: 20, fish: 40, uranium: 10 };

export const marketCodeOf = (engineId: string): string => MARKET_CODE[engineId]?.id ?? engineId;
/** Recipe for a company's/market itemCode, or null when the product is not modelled (e.g. weapons, crates). */
export function recipeForMarketCode(code: string): Recipe | null {
  for (const [engineId, m] of Object.entries(MARKET_CODE)) {
    if (m.id !== code) continue;
    if (RAW.has(engineId)) return rawRecipe(engineId, RAW_POINTS[engineId] ?? 1);
    return RECIPES[engineId] ?? null;
  }
  return null;
}
