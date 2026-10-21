// Real-browser audit: horizontal overflow, direction, broken images, tap targets, JS errors; phone/tablet/desktop x en/ar.
// Needs: npm i --no-save puppeteer-core @sparticuz/chromium ; a running server (BASE, default http://localhost:3150).
// See docs/ui-testing.md.
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
import fs from "node:fs";
const BASE = process.env.BASE ?? "http://localhost:3150";
const PAGES = (process.env.PAGES ?? "/,/countries,/countries/eg,/countries/eg/government,/wars,/battles,/alliances,/companies,/economy,/market,/equipment,/equipment-floor,/jobs,/rankings/playerDamage,/units,/history,/articles,/countries/eg/citizens,/company-stats").split(",");
const VIEWS = { mobile: { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, tablet: { width: 768, height: 1024 }, desktop: { width: 1280, height: 800 } };
const LOCALES = (process.env.LOCALES ?? "en,ar").split(",");
const SHOTS = process.env.SHOTS ?? "";
fs.mkdirSync("/tmp/shots", { recursive: true });
const browser = await puppeteer.launch({ args: chromium.args, executablePath: await chromium.executablePath(), headless: "shell" });
const issues = [];
for (const [vname, vp] of Object.entries(VIEWS)) {
  if (process.env.VIEWS && !process.env.VIEWS.split(",").includes(vname)) continue;
  for (const loc of LOCALES) {
    const page = await browser.newPage();
    await page.setViewport(vp);
    await page.setCookie({ name: "ns_locale", value: loc, domain: "localhost", path: "/" });
    const errors = []; const failed = new Set();
    page.on("response", (r) => { if (r.status() >= 400) failed.add(r.status() + " " + r.url().replace(/^https?:\/\/[^/]+/, "").slice(0, 60)); });
    page.on("pageerror", (e) => errors.push(String(e).slice(0, 160)));
    page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text().slice(0, 160)); });
    for (const path of PAGES) {
      errors.length = 0; failed.clear();
      let status = 0;
      try { const r = await page.goto(BASE + path, { waitUntil: "networkidle0", timeout: 30000 }); status = r?.status() ?? 0; } catch (e) { issues.push(`${vname}/${loc} ${path}: NAV FAIL ${String(e).slice(0, 80)}`); continue; }
      const res = await page.evaluate(() => {
        const doc = document.documentElement; const vw = doc.clientWidth;
        const dir = doc.dir, lang = doc.lang;
        const inScroller = (el) => { for (let p = el.parentElement; p; p = p.parentElement) { const o = getComputedStyle(p).overflowX; if ((o === "auto" || o === "scroll") && p.scrollWidth > p.clientWidth) return true; if (p === document.body) break; } return false; };
        const off = [];
        for (const el of document.querySelectorAll("body *")) {
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0 || getComputedStyle(el).visibility === "hidden" || getComputedStyle(el).position === "fixed" || el.closest("thead")) continue;
          if ((r.right > vw + 1 || r.left < -1) && !inScroller(el)) { off.push(`${el.tagName.toLowerCase()}.${String(el.className).split(" ")[0]} [${Math.round(r.left)},${Math.round(r.right)}] "${(el.textContent || "").trim().slice(0, 24)}"`); if (off.length >= 4) break; }
        }
        const smallEls = [...document.querySelectorAll("a, button, select, input")].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && (r.height < 32 || r.width < 32) && getComputedStyle(e).visibility !== "hidden" && !e.closest("[hidden]") && !e.closest("td, th, li, p, h1, h2, h3, small, span.kv, .stat-chips, .ichip, .cbadge, .tab, .card-grid, .cols"); }); const small = smallEls.length; const smallInfo = smallEls.slice(0, 3).map((e) => `${e.tagName.toLowerCase()}.${String(e.className).split(" ")[0]}[${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)}]"${(e.textContent || e.getAttribute("aria-label") || "").trim().slice(0, 14)}"`);
        const imgBroken = [...document.images].filter((i) => i.complete && i.naturalWidth === 0).length;
        return { overflow: Math.max(doc.scrollWidth - vw, -Math.min(0, Math.round(window.scrollX))), off, dir, lang, small, smallInfo, imgBroken, h1: (document.querySelector("h1")?.textContent || "").trim().slice(0, 30) };
      });
      const expectDir = loc === "ar" ? "rtl" : "ltr";
      const tag = `${vname}/${loc} ${path}`;
      if (status >= 400 && status !== 404) issues.push(`${tag}: HTTP ${status}`);
      if (res.dir !== expectDir) issues.push(`${tag}: dir=${res.dir} expected ${expectDir}`);
      if (res.overflow > 1) issues.push(`${tag}: PAGE OVERFLOW +${res.overflow}px :: ${res.off.join(" | ")}`);
      else if (res.off.length) issues.push(`${tag}: element outside viewport :: ${res.off.join(" | ")}`);
      if (res.imgBroken > 0) issues.push(`${tag}: ${res.imgBroken} broken <img>`);
      if (vname === "mobile" && res.small > 0) issues.push(`${tag}: ${res.small} small tap targets :: ${res.smallInfo.join(" | ")}`);
      const realErrors = errors.filter((e) => !e.startsWith("console: Failed to load resource")); if (realErrors.length) issues.push(`${tag}: JS errors ${realErrors.slice(0, 2).join(" ; ")}`);
      const badUrls = [...failed].filter((u) => !u.includes("/media/")); if (badUrls.length) issues.push(`${tag}: failed requests ${badUrls.slice(0, 3).join(" , ")}`); failed.clear();
      if (SHOTS && SHOTS.split(",").includes(path)) await page.screenshot({ path: `/tmp/shots/${vname}-${loc}-${path.replace(/\W+/g, "_") || "home"}.png`, fullPage: false });
    }
    await page.close();
  }
}
await browser.close();
console.log(issues.length ? issues.join("\n") : "NO ISSUES");
console.log(`(${issues.length} issue lines)`);
