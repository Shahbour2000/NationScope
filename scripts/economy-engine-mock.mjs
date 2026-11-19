// Offline test aid for the Economy Engine page. SYNTHETIC extras on top of scripts/mock-api.mjs (which serves real captured responses):
//   /players/by-name/*  -> a made-up profile (skills from the hand-transcribed fixture), id usr_mockeng
//   /market/{item}/orders -> a made-up two-level book around the real best bid/ask (orders were never captured)
// Usage: node scripts/mock-api.mjs 4060 & node scripts/economy-engine-mock.mjs 4061 ; AOW_MAIN_API_ORIGIN=http://127.0.0.1:4061 npm start
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "tests", "fixtures", "real");
const skills = JSON.parse(fs.readFileSync(path.join(dir, "player-skills.json"), "utf8")).skills;
const market = JSON.parse(fs.readFileSync(path.join(dir, "market.json"), "utf8"));
const upstream = "http://127.0.0.1:4060", port = Number(process.argv[2] ?? 4061);
http.createServer(async (req, res) => {
  res.setHeader("content-type", "application/json");
  const u = req.url.split("?")[0].replace("/api/v1", "");
  const bn = /^\/players\/by-name\/(.+)$/.exec(u);
  if (bn) { res.setHeader("x-mock", "synthetic"); const name = decodeURIComponent(bn[1]); if (name.toLowerCase() === "nobody") { res.statusCode = 404; return res.end('{"error":"not found"}'); } return res.end(JSON.stringify({ id: "usr_mockeng", username: name, countryId: "eg", regionId: "eg-center", level: 22, skills })); }
  const om = /^\/market\/([A-Za-z0-9_-]+)\/orders$/.exec(u);
  if (om) {
    const r = market.find((x) => x.itemCode === om[1]); res.setHeader("x-mock", "synthetic");
    if (!r) { res.statusCode = 404; return res.end("{}"); }
    const bid = BigInt(r.bestBid ?? "0"), ask = BigInt(r.bestAsk ?? "0");
    return res.end(JSON.stringify({ buys: bid > 0n ? [{ price: String(bid), qty: r.bidQty ?? 0 }, { price: String(bid * 9n / 10n), qty: 500 }] : [], sells: ask > 0n ? [{ price: String(ask), qty: r.askQty ?? 0 }] : [] }));
  }
  try { const r = await fetch(upstream + req.url); res.statusCode = r.status; return res.end(await r.text()); } catch { res.statusCode = 502; return res.end("{}"); }
}).listen(port, "127.0.0.1", () => console.log(`economy-engine mock on ${port}`));
