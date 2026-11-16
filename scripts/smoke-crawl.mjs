// Smoke crawler: visits every page type in English and Arabic and reports broken output.
// Usage (dev server + mock API running):  node scripts/smoke-crawl.mjs [baseUrl]
// Ids come from the real list fixtures (the same lists the app's id discovery reads), never typed by hand.
import { buildUrls } from "./lib/crawl-urls.mjs";

const BASE = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : "http://127.0.0.1:3100";
const LOCALES = (process.argv.find((a) => a.startsWith("--locale="))?.split("=")[1] ?? "en,ar").split(",");
const { urls } = buildUrls();

const BAD = [/\bundefined\b/, /\bNaN\b/, /\[object /, /\bInfinity\b/];
const textOf = (h) => h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<template[\s\S]*?<\/template>/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
let ok = 0; const problems = []; const empties = [];
async function check(loc, u) {
  const label = `[${loc}] ${u}`;
  try {
    const r = await fetch(BASE + u, { headers: { cookie: `ns_locale=${loc}` }, redirect: "manual", signal: AbortSignal.timeout(90000) });
    const html = await r.text(), t = textOf(html);
    const flags = [];
    if (r.status >= 400) flags.push(`http ${r.status}`);
    for (const b of BAD) if (b.test(t)) flags.push(`text:${b.source}`);
    if (/Something went wrong|حدث خطأ ما/.test(t)) flags.push("error-state");
    if (loc === "ar" && !/<html[^>]*dir="rtl"/.test(html)) flags.push("not-rtl");
    if (/The API reports that this resource does not exist|يفيد الخادم بأن هذا المورد غير موجود|Could not reach the API|The API returned an error/.test(t)) empties.push(label);
    if (flags.length) problems.push(`${label}  ${flags.join(", ")}`); else ok++;
  } catch (err) { problems.push(`${label}  fetch failed: ${err.message}`); }
}
const jobs = LOCALES.flatMap((loc) => urls.map((u) => [loc, u]));
let next = 0;
await Promise.all(Array.from({ length: 6 }, async () => { while (next < jobs.length) { const [loc, u] = jobs[next++]; await check(loc, u); } }));
console.log(`checked ${jobs.length} pages: ${ok} clean, ${problems.length} flagged`);
for (const p of problems.sort()) console.log("  " + p);
console.log(`pages that show an API error/not-found state (usually the mock lacks that data): ${empties.length}`);
for (const p of empties.sort()) console.log("  - " + p);
