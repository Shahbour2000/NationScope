/**
 * Normalises GET /search into display groups. Only `players` has a recorded shape (id, username, avatarUrl, countryId, level);
 * for the other groups a row is kept only if it has a string `id` and some text label (name / title / username), nothing is invented.
 */
export type SearchGroupKey = "players" | "countries" | "units" | "alliances" | "parties" | "regions" | "articles";
export const SEARCH_GROUPS: SearchGroupKey[] = ["players", "countries", "units", "alliances", "parties", "regions", "articles"];

export interface SearchHit { id: string; label: string; countryId: string | null; level: number | null; avatarUrl: string | null }

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);

export function parseSearch(data: unknown): { total: number; groups: { key: SearchGroupKey; hits: SearchHit[] }[] } {
  const o = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  const groups = SEARCH_GROUPS.map((key) => {
    const raw = Array.isArray(o[key]) ? (o[key] as unknown[]) : [];
    const hits: SearchHit[] = [];
    for (const r of raw) {
      if (!r || typeof r !== "object") continue;
      const row = r as Record<string, unknown>;
      const id = str(row.id), label = str(row.username) ?? str(row.name) ?? str(row.title);
      if (!id || !label) continue;
      hits.push({ id, label, countryId: str(row.countryId), level: typeof row.level === "number" ? row.level : null, avatarUrl: str(row.avatarUrl) });
    }
    return { key, hits };
  }).filter((g) => g.hits.length > 0);
  return { total: groups.reduce((n, g) => n + g.hits.length, 0), groups };
}

export const hrefFor = (key: SearchGroupKey, id: string): string => `/${key}/${encodeURIComponent(id)}`;
