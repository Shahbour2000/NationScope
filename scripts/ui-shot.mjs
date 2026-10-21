// Screenshot one page: node scripts/ui-shot.mjs <path> <en|ar> <width> <selector|-> <out.png> [height]
// Needs: npm i --no-save puppeteer-core @sparticuz/chromium ; a running server (BASE, default http://localhost:3150).
// See docs/ui-testing.md.
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
const [,, path, loc, width, sel, out, height = "900"] = process.argv;
const browser = await puppeteer.launch({ args: chromium.args, executablePath: await chromium.executablePath(), headless: "shell" });
const page = await browser.newPage();
const w = Number(width);
await page.setViewport({ width: w, height: Number(height), isMobile: w < 600, hasTouch: w < 600, deviceScaleFactor: w < 600 ? 2 : 1 });
await page.setCookie({ name: "ns_locale", value: loc, domain: "localhost", path: "/" });
await page.goto("http://localhost:3150" + path, { waitUntil: "networkidle0" });
if (sel && sel !== "-") { await page.$eval(sel, (e) => e.scrollIntoView({ block: "start" })); await new Promise((r) => setTimeout(r, 200)); }
await page.screenshot({ path: out });
await browser.close();
