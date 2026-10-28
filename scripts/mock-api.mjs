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
  ["/search", "search"],  ["/battles/btl_k6beibh5n4s42y81", "battle-detail"],
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
// SYNTHETIC players for offline UI testing only: /players/usr_* returns a made-up profile whose skills vary by id. Nothing here is real game data.
const skillsFile = JSON.parse(fs.readFileSync(path.join(dir, "player-skills.json"), "utf8")).skills;
function syntheticPlayer(id) {
  let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const k = [0.2, 0.55, 0.9, 1.0, 0.7][h % 5];
  return { id, username: `Mock ${id.slice(-5)}`, avatarUrl: null, countryId: "uk", level: 10 + (h % 30), damage: { total: String(1000 * (h % 997)), day: "0", week: "0", month: "0" },
    skills: skillsFile.map((s) => ({ ...s, level: s.maxLevel > 0 ? Math.min(s.maxLevel, Math.round(s.level * (h % 2 ? k : 1.6 - k))) : 0 })), presence: { online: false, lastActiveAt: null }, unit: null, party: null };
}
http.createServer((req, res) => {
  res.setHeader("content-type", "application/json");
  const u = req.url.split("?")[0].replace("/api/v1", "");
  const pm = /^\/players\/(usr_[A-Za-z0-9_-]+)$/.exec(u);
  if (pm) { res.setHeader("x-mock", "synthetic"); return res.end(JSON.stringify(syntheticPlayer(pm[1]))); }
  const hit = routes.find(([p]) => p === u);
  if (!hit) { res.statusCode = 404; return res.end('{"error":"not captured"}'); }
  res.end(fs.readFileSync(path.join(dir, hit[1] + ".json")));
}).listen(port, "127.0.0.1", () => console.log(`mock API (real fixtures) on http://127.0.0.1:${port}`));
