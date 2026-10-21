// Real-browser interaction test: pins (persist, menu, unpin), mobile drawer, parliament, RTL.
// Needs: npm i --no-save puppeteer-core @sparticuz/chromium ; a running server (BASE, default http://localhost:3150).
// See docs/ui-testing.md.
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
const BASE = "http://localhost:3150";
const browser = await puppeteer.launch({ args: chromium.args, executablePath: await chromium.executablePath(), headless: "shell" });
const results = [];
const ok = (name, cond, extra = "") => results.push(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? "  (" + extra + ")" : ""}`);
for (const [vname, vp] of [["mobile", { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }], ["desktop", { width: 1280, height: 800 }]]) {
  for (const loc of ["en", "ar"]) {
    const page = await browser.newPage();
    await page.setViewport(vp);
    await page.setCookie({ name: "ns_locale", value: loc, domain: "localhost", path: "/" });
    const tag = `${vname}/${loc}`;
    await page.goto(BASE + "/countries/eg", { waitUntil: "networkidle0" });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: "networkidle0" });
    const dir = await page.evaluate(() => document.documentElement.dir);
    ok(`${tag} html dir`, dir === (loc === "ar" ? "rtl" : "ltr"), dir);
    // --- pin flow
    const btn = await page.$(".pinbtn");
    ok(`${tag} pin button present on country page`, !!btn);
    await btn.click();
    await new Promise((r) => setTimeout(r, 200));
    ok(`${tag} pin sets aria-pressed`, (await page.$eval(".pinbtn", (e) => e.getAttribute("aria-pressed"))) === "true");
    ok(`${tag} header pin count badge`, (await page.$eval(".pin-count", (e) => e.textContent).catch(() => "")) === "1");
    await page.reload({ waitUntil: "networkidle0" });
    ok(`${tag} pin survives refresh`, (await page.$eval(".pinbtn", (e) => e.getAttribute("aria-pressed"))) === "true");
    await page.goto(BASE + "/wars", { waitUntil: "networkidle0" });
    await page.click(".pin-trigger");
    await page.waitForSelector(".pin-panel", { timeout: 3000 });
    const items = await page.$$eval(".pin-body li", (l) => l.length);
    ok(`${tag} pin menu lists the saved country (persisted across navigation)`, items === 1, `items=${items}`);
    const panelBox = await page.$eval(".pin-panel", (e) => { const r = e.getBoundingClientRect(); return { l: Math.round(r.left), r: Math.round(r.right), w: innerWidth, t: Math.round(r.top), b: Math.round(r.bottom), h: innerHeight }; });
    ok(`${tag} pin panel inside viewport`, panelBox.l >= 0 && panelBox.r <= panelBox.w + 1 && panelBox.t >= 0 && panelBox.b <= panelBox.h + 1, JSON.stringify(panelBox));
    await page.screenshot({ path: `/tmp/shots/pinmenu-${vname}-${loc}.png` });
    await page.click(".pin-body li .icon-btn");
    await new Promise((r) => setTimeout(r, 200));
    ok(`${tag} unpin from menu shows empty state`, !!(await page.$(".pin-empty")));
    await page.keyboard.press("Escape");
    await new Promise((r) => setTimeout(r, 100));
    ok(`${tag} Escape closes the pin menu`, !(await page.$(".pin-panel")));
    // --- mobile drawer
    if (vname === "mobile") {
      await page.click(".menu-btn");
      await new Promise((r) => setTimeout(r, 350));
      const vis = await page.$eval(".sidebar", (e) => { const r = e.getBoundingClientRect(); return { l: Math.round(r.left), r: Math.round(r.right), vis: getComputedStyle(e).visibility }; });
      ok(`${tag} drawer opens inside the screen`, vis.vis === "visible" && vis.l >= -1 && vis.r <= 391, JSON.stringify(vis));
      await page.screenshot({ path: `/tmp/shots/drawer-${loc}.png` });
      await page.keyboard.press("Escape");
      await new Promise((r) => setTimeout(r, 350));
      ok(`${tag} drawer closes (hidden from AT)`, (await page.$eval(".sidebar", (e) => getComputedStyle(e).visibility)) === "hidden");
    }
    // --- parliament
    await page.goto(BASE + "/countries/eg/government", { waitUntil: "networkidle0" });
    const seats = await page.$$eval(".seat", (e) => e.length);
    ok(`${tag} parliament renders seats`, seats >= 10, `seats=${seats}`);
    await page.click(".seat:not(.seat-vacant)");
    await new Promise((r) => setTimeout(r, 150));
    const card = await page.$eval(".seat-card", (e) => e.textContent || "");
    ok(`${tag} tapping a seat shows member details with profile link`, /Level|المستوى/.test(card) && !!(await page.$(".seat-card a[href^='/players/']")));
    const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 || scrollX < -1);
    ok(`${tag} government page has no horizontal overflow`, !hasOverflow);
    await page.screenshot({ path: `/tmp/shots/gov-${vname}-${loc}.png`, fullPage: false });
    await page.close();
  }
}
await browser.close();
console.log(results.join("\n"));
