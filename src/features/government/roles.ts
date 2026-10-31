/**
 * Government role handling shared by the country overview and the Government tab.
 * Roles come from the API (`/countries/{id}/government/members`, `/summary`); this module never invents
 * a role. Known roles get a stable display order, any other non-congress role the API sends is kept
 * (appended in API order) so a newly introduced position cannot silently disappear from one page.
 */
export const KNOWN_ROLE_ORDER = ["president", "vicePresident", "ministerDefense", "ministerForeignAffairs", "ministerEconomy"] as const;

const rank = (role: string): number => {
  const i = (KNOWN_ROLE_ORDER as readonly string[]).indexOf(role);
  return i === -1 ? KNOWN_ROLE_ORDER.length : i;
};

/** Non-congress holders in display order (stable for equal ranks). Congress members are excluded on purpose. */
export function leadershipHolders<T extends { role: string }>(rows: readonly T[]): T[] {
  return rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => row.role !== "congress")
    .sort((a, b) => rank(a.row.role) - rank(b.row.role) || a.index - b.index)
    .map(({ row }) => row);
}
