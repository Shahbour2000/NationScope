// Builds the list of page URLs to visit. Ids come from the real list fixtures (the same lists the app's id discovery reads), never typed by hand.
import fs from "node:fs";
import path from "node:path";

export function buildUrls(root = process.cwd()) {
  const dir = path.join(root, "tests", "fixtures", "real");
  const J = (f) => JSON.parse(fs.readFileSync(path.join(dir, `${f}.json`), "utf8"));
  const first = (a) => (Array.isArray(a) && a[0]) || {};
    const ids = {
    country: "eg", region: first(J("regions").regions).id, battle: first(J("battles")).id ?? first(J("battles").battles).id, item: first(J("market")).itemCode,
    board: "playerDamage", player: first(J("ranking-playerDamage").rows.filter((r) => r.subjectType === "user")).subjectId, company: first(J("companies").companies).id,
    unit: first(Array.isArray(J("units")) ? J("units") : J("units").units).id, alliance: first(J("alliances").alliances).id, party: first(J("parties-eg").parties).id,
    law: first(J("laws-eg").proposals).id, election: first(J("elections-eg").finished).id, article: first(J("articles").items).id, newspaper: first(J("articles").items).newspaperId,
    war: first(J("wars").wars ?? J("wars")).id, tournament: first(J("tournaments").active ?? []).id ?? J("tournaments").current?.id,
  };
  const urls = ["/", "/countries", "/regions", "/battles", "/wars", "/units", "/alliances", "/parties", "/laws", "/articles", "/market", "/companies", "/company-stats", "/jobs", "/equipment", "/equipment-floor", "/economy", "/rankings", "/tournaments", "/history", "/contracts", "/game", "/search?q=a", "/companies/battles"];
  const add = (u) => urls.push(u);
  add(`/countries/${ids.country}`); for (const s of ["government", "government-history", "citizens", "elections", "parties", "laws", "announcements", "embassies", "bank", "revolution", "wars", "battles", "units", "history", "companies", "company-stats", "events", "members", "profile"]) add(`/countries/${ids.country}/${s}`);
  add(`/regions/${ids.region}`); add(`/regions/${ids.region}/companies`); add(`/regions/${ids.region}/campaign`);
  add(`/battles/${ids.battle}`); add(`/battles/${ids.battle}/contracts`); add(`/market/${ids.item}`); for (const s of ["orders", "history", "trades"]) add(`/market/${ids.item}/${s}`);
  add(`/rankings/${ids.board}`); add(`/rankings/${ids.board}/archive`); add(`/players/${ids.player}`); add(`/players/${ids.player}/stats`); add(`/players/${ids.player}/companies`);
  add(`/companies/${ids.company}`); add(`/units/${ids.unit}`); add(`/alliances/${ids.alliance}`); add(`/alliances/${ids.alliance}/laws`); add(`/parties/${ids.party}`);
  add(`/laws/${ids.law}`); add(`/elections/${ids.election}`); add(`/articles/${ids.article}`); add(`/newspapers/${ids.newspaper}`); if (ids.war) add(`/wars/${ids.war}`); if (ids.tournament) add(`/tournaments/${ids.tournament}`);

  return { urls, ids };
}
