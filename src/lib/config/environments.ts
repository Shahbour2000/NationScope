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
