#!/usr/bin/env node
// Captures REAL Age of Nations API responses for the Economy Engine tests. Run it from a machine that can reach the game.
//   node scripts/aon-sample.mjs --player "YourName"            (Windows PowerShell: node scripts\aon-sample.mjs --player "YourName")
// Options: --base <url> (default https://app.ageofnations.world)  --out <dir> (default tests/fixtures/real/live)
//          --max-companies <n> (default 3)  --items concrete,steel  --anonymize (replace your name/ids, drop private-looking keys)
// Needs Node 18+ (built-in fetch). Makes about 15-25 requests, paced under the 60/min limit; honours Retry-After on 429.
import fs from "node:fs";
import path from "node:path";
import { sample } from "./aon-sample-core.mjs";

const args = process.argv.slice(2); const get = (k, d) => { const i = args.indexOf(k); return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : d; };
const player = get("--player"); if (!player) { console.error('Usage: node scripts/aon-sample.mjs --player "YourName" [--anonymize]'); process.exit(2); }
const out = path.resolve(get("--out", "tests/fixtures/real/live")); fs.mkdirSync(out, { recursive: true });
const base = get("--base", "https://app.ageofnations.world").replace(/\/+$/, "");
const manifest = await sample({
  fetchFn: fetch, base, player, maxCompanies: Number(get("--max-companies", "3")), extraItems: (get("--items", "") || "").split(",").filter(Boolean), anonymizeOut: args.includes("--anonymize"),
  write: (name, data) => fs.writeFileSync(path.join(out, name), JSON.stringify(data, null, 2)), log: (m) => console.log(m),
});
fs.writeFileSync(path.join(out, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log(`\nSaved ${manifest.files.filter((f) => f.result === "ok").length} files to ${out}`);
if (manifest.stopped) console.log(`Stopped early: ${manifest.stopped}. (Only "player-not-found" means the name does not exist; anything else is a connection problem, try again.)`);
if (manifest.problems.length) { console.log("Problems:\n  " + manifest.problems.join("\n  ")); process.exitCode = 1; }
else console.log("All requests succeeded. Now run: npm test");
