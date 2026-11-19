import type { Evidence } from "./evidence";

/**
 * Production recipes. Sources: wiki 02-economy §1.2 (production points per unit and inputs). A loaded company's own
 * `production.pointsPerUnit` / `production.needs` (live) always override this table.
 * `mapping` is "wiki" when the wiki name equals the API item code, "inferred" when the wiki name was matched to an API code by meaning.
 */
export interface Recipe {
  item: string;
  kind: "raw" | "manufactured";
  ppPerUnit: number;
  inputs: Readonly<Record<string, number>>;
  mapping: Extract<Evidence, "wiki" | "inferred">;
}
const raw = (item: string, ppPerUnit = 1, mapping: Recipe["mapping"] = "wiki"): Recipe => ({ item, kind: "raw", ppPerUnit, inputs: {}, mapping });
const made = (item: string, ppPerUnit: number, inputs: Record<string, number>, mapping: Recipe["mapping"] = "wiki"): Recipe => ({ item, kind: "manufactured", ppPerUnit, inputs, mapping });

export const RECIPES: readonly Recipe[] = [
  raw("limestone"), raw("grain"), raw("iron"), raw("lead"), raw("petroleum"), raw("wood"), raw("coffeeBeans"),
  raw("coca", 1, "inferred"), raw("livestock", 20, "inferred"), raw("fish", 40), raw("uranium", 10),
  made("concrete", 8, { limestone: 8 }),
  made("steel", 8, { iron: 8 }),
  made("bread", 8, { grain: 8 }),
  made("steak", 18, { livestock: 1 }, "inferred"),
  made("cookedFish", 36, { fish: 1 }),
  made("lightAmmo", 1, { lead: 1 }),
  made("ammo", 3, { lead: 3 }, "inferred"),
  made("heavyAmmo", 12, { lead: 12 }, "inferred"),
  made("cocain", 150, { coca: 150 }, "inferred"),
  made("oil", 1, { petroleum: 1 }),
  made("paper", 1, { wood: 1 }),
  made("espresso", 8, { coffeeBeans: 8 }, "inferred"),
  made("fuelCell", 100, { uranium: 1 }),
];
const BY_ITEM = new Map(RECIPES.map((r) => [r.item, r]));
export const recipeOf = (item: string): Recipe | null => BY_ITEM.get(item) ?? null;
/** Weapons and armour are not modelled: their stats are random per item and they are sold on the separate equipment market. */
export const isEquipmentCode = (item: string): boolean => /^(weapon|helmet|chest|pants|legs|boots|gloves)\d*$/i.test(item);
