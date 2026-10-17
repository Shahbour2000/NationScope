const ID = /^[A-Za-z0-9_-]{1,80}$/;

const PREFIX: ReadonlyArray<readonly [RegExp, string]> = [
  [/^usr_/, "players"], // observed on Main (unit owners)
  [/^mu_/, "units"], // observed on Main (unit ids)
];

/** HEURISTIC: field-name suffix to section. A wrong guess only yields a link to a page that reports "not found". */
const KEY_SUFFIX: ReadonlyArray<readonly [string, string]> = [
  ["countryid", "countries"], ["allianceid", "alliances"], ["regionid", "regions"], ["partyid", "parties"],
  ["battleid", "battles"], ["electionid", "elections"], ["companyid", "companies"], ["articleid", "articles"],
  ["newspaperid", "newspapers"], ["proposalid", "laws"], ["muid", "units"], ["unitid", "units"],
  ["userid", "players"], ["playerid", "players"], ["ownerid", "players"], ["leaderid", "players"],
  ["presidentid", "players"], ["editionid", "tournaments"], ["itemcode", "market"],
];

export function linkFor(key: string, value: unknown): string | null {
  if (typeof value !== "string" || !ID.test(value)) return null;
  for (const [re, section] of PREFIX) if (re.test(value)) return `/${section}/${encodeURIComponent(value)}`;
  const k = key.toLowerCase();
  for (const [suffix, section] of KEY_SUFFIX) if (k.endsWith(suffix)) return `/${section}/${encodeURIComponent(value)}`;
  return null;
}

export function rowHref(section: string, row: Record<string, unknown>): string | null {
  for (const key of ["id", "code", "itemCode"]) {
    const id = row[key];
    if (typeof id === "string" && ID.test(id)) return `/${section}/${encodeURIComponent(id)}`;
  }
  return null;
}
