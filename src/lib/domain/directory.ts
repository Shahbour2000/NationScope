import { humanizeCode } from "@/lib/format";

/** Serializable lookup used to turn ids into names. Countries come from GET /countries; regions have no name endpoint. */
export interface Directory {
  countries: Record<string, { name: string; scheme: string | null }>;
  regionNames: Record<string, string>;
}

export const EMPTY_DIRECTORY: Directory = { countries: {}, regionNames: {} };

export function countryName(id: string, dir: Directory): string {
  return dir.countries[id]?.name ?? id.toUpperCase();
}

/**
 * Region ids look like "{country}-{name}". The API exposes region NAMES only inside country profiles
 * (coreRegions / controlledRegions), so a known name wins; otherwise the part after the first "-" is humanized.
 */
export function regionName(id: string, dir: Directory): string {
  const known = dir.regionNames[id];
  if (known) return known;
  const i = id.indexOf("-");
  return humanizeCode(i >= 0 ? id.slice(i + 1) : id);
}

/** Approximate display colors for the game's named color schemes (presentation only). */
export const SCHEME_COLORS: Record<string, string> = {
  amber: "#f5a623", blue: "#3b82f6", brown: "#9a6a43", cyan: "#22d3ee", deepPink: "#ec2f8c", emerald: "#10b981", gray: "#8b97a8",
  green: "#22c55e", indigo: "#6366f1", lightBlue: "#60a5fa", lightGreen: "#86efac", lightOrange: "#fdba74", lime: "#a3e635",
  olive: "#8a8f3a", orange: "#f97316", pink: "#f472b6", purple: "#a855f7", red: "#ef4444", sand: "#d9c38f", teal: "#14b8a6",
  violet: "#8b5cf6", yellow: "#facc15",
};
export const schemeColor = (scheme: string | null | undefined): string => (scheme && SCHEME_COLORS[scheme]) || "#8b97a8";
