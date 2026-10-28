import { NextResponse } from "next/server";
import { normalize, rankSuggestions, type Suggestion } from "@/features/search/rank";
import { getConfig } from "@/lib/config/env";
import { flagSrc } from "@/lib/flags";
import { getAlliances, getCountries, searchUpstream } from "@/lib/data/world";
import { getUnits } from "@/lib/data/units";
import { mediaSrc } from "@/lib/media";

export const dynamic = "force-dynamic";

const rec = (v: unknown): Record<string, unknown> => (typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const SAFE_ID = /^[A-Za-z0-9_-]{1,80}$/;

/** Group rows from the upstream search, mapped defensively (only id + a name are required). */
function fromUpstream(group: unknown, type: Suggestion["type"], origin: string, countryName: (id: string) => string | null): Suggestion[] {
  if (!Array.isArray(group)) return [];
  const out: Suggestion[] = [];
  for (const x of group) {
    const r = rec(x);
    const id = str(r.id), name = str(r.username) ?? str(r.name) ?? str(r.title);
    if (!id || !name || !SAFE_ID.test(id)) continue;
    const cid = str(r.countryId);
    const level = typeof r.level === "number" ? `Lv ${r.level}` : null;
    out.push({
      type, id, name,
      image: type === "country" ? flagSrc(id) : mediaSrc(str(r.avatarUrl) ?? str(r.logoUrl), origin),
      sub: [cid ? countryName(cid) : null, level].filter(Boolean).join(" · ") || null,
      href: `/${type === "country" ? "countries" : type === "player" ? "players" : type === "unit" ? "units" : type === "alliance" ? "alliances" : "parties"}/${encodeURIComponent(id)}`,
    });
  }
  return out;
}

/**
 * Live suggestions. Countries, alliances and units are matched locally against the cached list endpoints (partial/middle matches work);
 * players and parties come from the API's /search. If one source fails the others still answer and `partial` is true.
 */
export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get("q") ?? "").slice(0, 60);
  if (normalize(q).length < 2) return NextResponse.json({ results: [], partial: false });
  const origin = getConfig().origin;
  const [countries, alliances, units, upstream] = await Promise.allSettled([getCountries(), getAlliances(), getUnits(), searchUpstream(q.trim())]);
  const names = new Map<string, string>();
  const items: Suggestion[] = [];
  if (countries.status === "fulfilled") {
    for (const c of countries.value.countries) { names.set(c.id, c.name); items.push({ type: "country", id: c.id, name: c.name, image: flagSrc(c.id), sub: null, href: `/countries/${encodeURIComponent(c.id)}` }); }
  }
  const cn = (id: string) => names.get(id) ?? null;
  if (alliances.status === "fulfilled") for (const a of alliances.value.rows) items.push({ type: "alliance", id: a.id, name: a.name, image: null, sub: null, href: `/alliances/${encodeURIComponent(a.id)}` });
  if (units.status === "fulfilled") for (const u of units.value.units) items.push({ type: "unit", id: u.id, name: u.name, image: u.logoSrc ?? null, sub: u.countryId ? cn(u.countryId) : null, href: `/units/${encodeURIComponent(u.id)}` });
  if (upstream.status === "fulfilled") {
    const r = upstream.value;
    items.push(...fromUpstream(r.players, "player", origin, cn), ...fromUpstream(r.parties, "party", origin, cn),
      ...fromUpstream(r.units, "unit", origin, cn), ...fromUpstream(r.alliances, "alliance", origin, cn));
  }
  const failed = [countries, alliances, units, upstream].filter((x) => x.status === "rejected").length;
  if (failed === 4) return NextResponse.json({ results: [], partial: true, error: true }, { status: 502 });
  return NextResponse.json({ results: rankSuggestions(q, items, 8), partial: failed > 0 });
}
