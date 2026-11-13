import { z } from "zod";
import { endpoints } from "@/lib/api/endpoints";
import { getApiClient } from "@/lib/api/instance";
import { getEquipmentOffers, getMarket, getPlayerCompanies } from "@/lib/data/economy";
import { getPlayerProfile } from "@/lib/data/players";
import { importForBuild, OFFER_PAGE_SIZE, type BuildImport, type ImportDeps, type UserInputs } from "@/features/build-optimizer";

/**
 * Server-side "Import Profile" binding for the Build Optimizer. It only wires NationScope's EXISTING data-layer functions
 * (getPlayerProfile, getPlayerCompanies, getMarket, getEquipmentOffers) and the shared API client into the pure importer.
 * No new client, cache or parser. `stats` is read raw because /players/{id}/stats has no captured fixture or schema yet.
 */
export const defaultImportDeps: ImportDeps = {
  profile: (id) => getPlayerProfile(id),
  companies: (id) => getPlayerCompanies(id, { limit: 100 }),
  stats: async (id) => { const e = endpoints.playerStats(id); return (await getApiClient().get(e.path, { schema: z.unknown(), query: e.query })).data; },
  market: () => getMarket(),
  offers: (slot, offset) => getEquipmentOffers({ slot, sort: "priceAsc", limit: OFFER_PAGE_SIZE, offset }),
};

export const importPlayerForBuild = (playerId: string, user?: UserInputs, deps: ImportDeps = defaultImportDeps): Promise<BuildImport | null> => importForBuild(playerId, deps, user);
