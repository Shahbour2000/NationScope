/** How well a number or rule is known. Shown next to every figure in the UI. */
export type Evidence =
  | "live"        // taken from a live API response in this request
  | "cached"      // from the API cache (still inside its TTL)
  | "stale"       // served from cache after a failed refresh
  | "user"        // typed in / chosen by the player
  | "wiki"        // stated by the game wiki (confirmed rule)
  | "inferred"    // follows from several sources, not stated outright
  | "assumption"; // unverified default

export const WEAKEST_ORDER: readonly Evidence[] = ["assumption", "inferred", "stale", "user", "wiki", "cached", "live"];
/** The overall confidence of a result is its weakest critical input. */
export function weakest(list: readonly Evidence[]): Evidence {
  if (list.length === 0) return "assumption";
  let w = 6;
  for (const e of list) w = Math.min(w, WEAKEST_ORDER.indexOf(e));
  return WEAKEST_ORDER[w]!;
}
export type Confidence = "high" | "medium" | "low";
export function confidenceOf(e: Evidence): Confidence {
  return e === "live" || e === "cached" || e === "wiki" || e === "user" ? "high" : e === "inferred" || e === "stale" ? "medium" : "low";
}
