/** The game's country ids are lowercase two-letter codes, mostly ISO 3166-1. Exceptions are mapped here. */
const ALIASES: Record<string, string> = { uk: "gb" };

/** Local flag path (bundled in /public/flags, MIT flag-icons), or null when the id is not a two-letter code. */
export function flagSrc(countryId: string): string | null {
  const id = countryId.trim().toLowerCase();
  const code = ALIASES[id] ?? id;
  return /^[a-z]{2}$/.test(code) ? `/flags/${code}.svg` : null;
}
