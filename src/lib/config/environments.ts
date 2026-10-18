/**
 * Single place where the game's environments are defined.
 * Origins are overridable via env vars; the "/api/v1" prefix lives in exactly one
 * constant and is joined to origin + path in exactly one function (buildApiUrl).
 */
export type ApiEnvironment = "main" | "development";

export const API_PATH_PREFIX_DEFAULT = "/api/v1";

export const ENVIRONMENTS: Record<
  ApiEnvironment,
  { label: string; originVar: string; defaultOrigin: string }
> = {
  // Confirmed working by the project owner (GET /api/v1/units returns real data).
  main: { label: "Main", originVar: "AOW_MAIN_API_ORIGIN", defaultOrigin: "https://app.ageofnations.world" },
  // Testing only. Never selected unless NATIONSCOPE_API_ENV=development.
  development: { label: "Development", originVar: "AOW_DEV_API_ORIGIN", defaultOrigin: "https://dev.ageofnations.world" },
};

/** origin ("https://host") + prefix ("/api/v1") + path ("/units") -> full URL. */
export function buildApiUrl(origin: string, prefix: string, path: string): string {
  if (!path.startsWith("/") || path === prefix || path.startsWith(`${prefix}/`)) {
    throw new Error("API path must be relative to the prefix and must not repeat it.");
  }
  return `${origin.replace(/\/+$/, "")}${prefix}${path}`;
}

/**
 * Official image sources.
 * - Item icons: https://ageofnations.world/items/{itemCode}.webp (observed on the game's public site for tank, steel, case2,
 *   helmet4, rifle, oil, bread, grain, concrete, jet, chest4, sniper). Other item codes are assumed to follow the same pattern;
 *   a missing file falls back to an icon in the UI.
 * - Player, unit, party and company-owner images: relative "/media/..." paths returned by the API, served from the API origin.
 * No country-flag asset has been found in the API or on the public site.
 */
export const ITEM_ICON_BASE = "https://ageofnations.world/items";
