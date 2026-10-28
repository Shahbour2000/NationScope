/** Pure search helpers: query normalisation (Latin + Arabic) and ranking. No I/O. */
export type EntityType = "country" | "player" | "unit" | "alliance" | "party";

export interface Suggestion {
  type: EntityType;
  id: string;
  name: string;
  image: string | null;
  /** Short context line (country, level...), already display-ready. */
  sub: string | null;
  href: string;
}

const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";

/** Case-insensitive, whitespace-collapsed, diacritic-insensitive; folds Arabic letter variants (alef forms, ya, ta marbuta) and digits. */
export function normalize(s: string): string {
  return s
    .normalize("NFKC")
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "") // tashkeel, dagger alef, tatweel
    .replace(/[\u0623\u0625\u0622\u0671]/g, "\u0627") // alef variants -> alef
    .replace(/\u0649/g, "\u064A") // alef maqsura -> ya
    .replace(/\u0629/g, "\u0647") // ta marbuta -> ha
    .replace(/[\u0660-\u0669]/g, (d) => String(AR_DIGITS.indexOf(d)))
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Latin accents
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** 100 exact, 80 prefix, 60 word-prefix, 40 substring, 0 no match. */
export function matchScore(query: string, name: string): number {
  const q = normalize(query), n = normalize(name);
  if (!q || !n) return 0;
  if (n === q) return 100;
  if (n.startsWith(q)) return 80;
  if (n.split(/[\s\-_.]+/).some((w) => w.startsWith(q))) return 60;
  return n.includes(q) ? 40 : 0;
}

const TYPE_ORDER: Record<EntityType, number> = { country: 0, player: 1, unit: 2, alliance: 3, party: 4 };

/**
 * Ranks suggestions. A single exact match goes first and nothing weaker than a prefix match is shown above it; all other real matches follow.
 * Ambiguous exact names (several entities share the name) are all kept, ordered by type. Duplicate type+id pairs are collapsed.
 */
export function rankSuggestions(query: string, items: readonly Suggestion[], limit = 8): Suggestion[] {
  const seen = new Set<string>();
  const scored = items
    .filter((s) => { const k = `${s.type}:${s.id}`; if (seen.has(k)) return false; seen.add(k); return true; })
    .map((s) => ({ s, score: matchScore(query, s.name) }))
    .filter((x) => x.score > 0);
  scored.sort((a, b) => b.score - a.score || TYPE_ORDER[a.s.type] - TYPE_ORDER[b.s.type] || a.s.name.length - b.s.name.length || a.s.name.localeCompare(b.s.name));
  return scored.slice(0, limit).map((x) => x.s);
}
