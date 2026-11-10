// Checks every item icon URL NationScope requests and prints a Markdown table (status, content-type) you can forward to the game developer.
// Usage (needs internet access to the game's host):  node scripts/check-item-icons.mjs [--base https://ageofnations.world/items] [--ext webp]
// Codes come from the real API fixtures in tests/fixtures/real plus the item names bundled in src/i18n/messages.ts; add more with --codes a,b,c.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : d; };
const base = arg("base", "https://ageofnations.world/items"), ext = arg("ext", "webp");
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const codes = new Set((arg("codes", "") || "").split(",").filter(Boolean));
const walk = (o) => { if (Array.isArray(o)) o.forEach(walk); else if (o && typeof o === "object") for (const [k, v] of Object.entries(o)) { if (k === "itemCode" && typeof v === "string") codes.add(v); walk(v); } };
const fx = path.join(root, "tests", "fixtures", "real");
for (const f of fs.readdirSync(fx)) if (f.endsWith(".json")) { try { walk(JSON.parse(fs.readFileSync(path.join(fx, f), "utf8"))); } catch { /* skip */ } }
const msg = fs.readFileSync(path.join(root, "src", "i18n", "messages.ts"), "utf8");
const start = msg.indexOf("items: {"), end = msg.indexOf("ui: {", start);
for (const m of msg.slice(start, end).matchAll(/(\w+): "/g)) if (m[1] !== "items") codes.add(m[1]);

const rows = [];
for (const code of [...codes].sort()) {
  const url = `${base}/${encodeURIComponent(code)}.${ext}`;
  let status = "", type = "", note = "";
  try {
    let r = await fetch(url, { method: "HEAD", redirect: "follow" });
    if (r.status === 405 || r.status === 403) r = await fetch(url, { redirect: "follow" });
    status = String(r.status); type = r.headers.get("content-type") ?? "";
    if (r.status === 200 && !/image\//.test(type)) note = "200 but not an image (HTML fallback page?)";
  } catch (e) { status = "ERR"; note = String(e.cause?.code ?? e.message); }
  rows.push({ code, url, status, type, note });
}
const netErr = rows.filter((r) => r.status === "ERR");
const httpBad = rows.filter((r) => r.status !== "ERR" && (r.status !== "200" || r.note));
const ok = rows.length - netErr.length - httpBad.length;
console.log(`| Item code | URL requested | HTTP | Content-Type | Note |\n|---|---|---|---|---|`);
for (const r of rows) console.log(`| ${r.code} | ${r.url} | ${r.status} | ${r.type} | ${r.note} |`);
console.log(`\nSummary: ${ok} OK image responses, ${httpBad.length} HTTP failures or non-image responses, ${netErr.length} network errors (no response received).`);
if (httpBad.length) console.log("Failing (HTTP) codes: " + httpBad.map((r) => r.code).join(", "));
if (netErr.length) console.log(`NOTE: ${netErr.length} request(s) never reached the host (${[...new Set(netErr.map((r) => r.note))].join(", ")}). A network error says NOTHING about whether those images exist; rerun from a machine that can reach ${new URL(base).host}.`);
process.exitCode = httpBad.length || netErr.length ? 1 : 0;
