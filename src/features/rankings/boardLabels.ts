/**
 * Arabic names for the leaderboard ids reported by GET /game (the API labels are English only). Boards not listed here keep the API label,
 * so a new leaderboard never shows a wrong name. Names follow the wiki's rankings table where it covers a board; the others are plain translations of the API label.
 */
const AR: Record<string, string> = {
  playerDamage: "اللاعبون حسب الضرر", playerLevel: "اللاعبون حسب المستوى", playerWork: "اللاعبون حسب العمل", playerTrade: "اللاعبون حسب التجارة", playerWealth: "اللاعبون حسب الثروة",
  muDamage: "الوحدات العسكرية حسب الضرر", muTreasury: "الوحدات العسكرية حسب الخزينة", muMembers: "الوحدات العسكرية حسب الأعضاء",
  countryDamage: "الدول حسب الضرر", countryDevelopment: "الدول حسب التنمية", countryPopulation: "الدول حسب السكان النشطين", countryRegions: "الدول حسب المناطق", countryTreasury: "الدول حسب الخزينة",
  allianceDevelopment: "التحالفات حسب حصة التطوّر", allianceDamage: "التحالفات حسب الضرر", allianceMembers: "التحالفات حسب الأعضاء",
};
export const boardLabel = (id: string, apiLabel: string | null | undefined, locale: string): string => (locale === "ar" ? AR[id] : undefined) ?? apiLabel ?? id;
