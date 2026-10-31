import type { LawDef } from "@/lib/domain/world";

/**
 * Presentation grouping for the law catalogue. The API gives no category, so this maps known law codes to a reader-friendly
 * section; any code it does not know goes to "other" (so new laws still appear). Nothing here changes law data.
 */
export type LawCategory = "war" | "pacts" | "tax" | "trade" | "land" | "gov" | "alliances" | "admin" | "other";
export const CATEGORY_ORDER: LawCategory[] = ["war", "pacts", "tax", "trade", "land", "gov", "alliances", "admin", "other"];

const MAP: Record<string, LawCategory> = {
  declare_war: "war", propose_peace: "war", define_enemy_country: "war",
  defensive_pact: "pacts", end_defensive_pact: "pacts", non_aggression_pact: "pacts", end_non_aggression_pact: "pacts",
  change_income_tax: "tax", change_market_tax: "tax", change_self_work_tax: "tax", change_production_tax: "tax", change_import_tax: "tax", change_export_tax: "tax",
  send_money_to_country: "trade", embargo_country: "trade", lift_embargo: "trade",
  transfer_region: "land", set_specialization: "land",
  set_color_scheme: "gov", set_citizenship_fee: "gov", set_immigration_pitch: "gov", set_discord_link: "gov", impeach_president: "gov",
  create_alliance: "alliances", request_join_alliance: "alliances", accept_alliance_invite: "alliances", withdraw_alliance_request: "alliances", leave_alliance: "alliances",
};

export function categoryOf(law: Pick<LawDef, "code" | "scope">): LawCategory {
  return MAP[law.code] ?? (law.scope === "alliance" || law.code.startsWith("alliance_") ? "admin" : "other");
}

export function groupLaws<T extends Pick<LawDef, "code" | "scope">>(laws: readonly T[]): { category: LawCategory; laws: T[] }[] {
  return CATEGORY_ORDER.map((category) => ({ category, laws: laws.filter((l) => categoryOf(l) === category) })).filter((g) => g.laws.length > 0);
}
