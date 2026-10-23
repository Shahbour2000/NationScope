// Serves the REAL captured API responses (tests/fixtures/real) so the UI can be run and tested offline.
// It is a development/testing aid only. Usage: node scripts/mock-api.mjs [port]  then
//   AOW_MAIN_API_ORIGIN=http://127.0.0.1:4060 npm run dev
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "tests", "fixtures", "real");
const port = Number(process.argv[2] ?? 4060);
const routes = [
  ["/units/mu_xk3dx9x6bhf6s47c", "unit-detail"],
  ["/countries/eg/summary", "country-eg-summary"], ["/countries/eg/citizens", "citizens-eg"], ["/countries/eg/government/members", "government-members-eg"],
  ["/countries/eg/government/history", "government-history-eg"], ["/countries/eg/government", "government-eg"], ["/countries/eg/embassies", "embassies-eg"],
  ["/countries/eg/wars", "wars-eg"], ["/countries/eg/battles", "battles-eg"], ["/countries/eg/units", "units-eg"], ["/countries/eg/history", "history-eg"],
  ["/countries/eg/elections", "elections-eg"], ["/countries/eg/parties", "parties-eg"], ["/countries/eg/laws", "laws-eg"], ["/countries/eg/bank", "bank-eg"],
  ["/countries/eg/revolution", "revolution-eg"], ["/countries/eg/companies/stats", "company-stats-eg"], ["/countries/eg", "country-eg"], ["/countries", "countries"],
  ["/game", "game"], ["/alliances", "alliances"], ["/regions", "regions"], ["/units", "units"], ["/market/trades", "market-trades"], ["/market", "market"],
  ["/equipment/floor", "equipment-floor"], ["/equipment", "equipment-offers"], ["/companies/stats", "company-stats"], ["/companies", "companies"], ["/jobs", "jobs"],
  ["/battles", "battles"], ["/wars", "wars"], ["/contracts", "contracts"], ["/laws", "laws-catalog"], ["/rankings/playerDamage", "ranking-playerDamage"],
  ["/articles", "articles"], ["/history", "history"], ["/tournaments", "tournaments"],
];
http.createServer((req, res) => {
  res.setHeader("content-type", "application/json");
  const u = req.url.split("?")[0].replace("/api/v1", "");
  const hit = routes.find(([p]) => p === u);
  if (!hit) { res.statusCode = 404; return res.end('{"error":"not captured"}'); }
  res.end(fs.readFileSync(path.join(dir, hit[1] + ".json")));
}).listen(port, "127.0.0.1", () => console.log(`mock API (real fixtures) on http://127.0.0.1:${port}`));
