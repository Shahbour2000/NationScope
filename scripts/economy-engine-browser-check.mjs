// Real-browser check of /economy/engine (English desktop, English tablet, Arabic phone). Needs: npm i --no-save puppeteer-core @sparticuz/chromium
// Offline demo: node scripts/mock-api.mjs 4060 & node scripts/economy-engine-mock.mjs 4061 & AOW_MAIN_API_ORIGIN=http://127.0.0.1:4061 npm start -- -p 3150
//   BASE=http://localhost:3150 PLAYER=Zed node scripts/economy-engine-browser-check.mjs        (exit code 1 when a check fails)
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
const BASE = process.env.BASE ?? "http://localhost:3150", PLAYER = process.env.PLAYER ?? "Zed";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await puppeteer.launch({ args: chromium.args, executablePath: await chromium.executablePath(), headless: "shell" });
const report = []; let failed = 0;
const setVal = (p, sel, val, proto = "HTMLInputElement") => p.evaluate((sel, val, proto) => { const el = document.querySelector(sel); Object.getOwnPropertyDescriptor(window[proto].prototype, "value").set.call(el, val); el.dispatchEvent(new Event(proto === "HTMLSelectElement" ? "change" : "input", { bubbles: true })); }, sel, val, proto);
for (const [loc, w, h] of [["en", 1280, 900], ["en", 768, 1024], ["ar", 390, 844]]) {
  const p = await b.newPage(); await p.setViewport({ width: w, height: h, isMobile: w < 600, hasTouch: w < 600 });
  await p.setCookie({ name: "ns_locale", value: loc, domain: new URL(BASE).hostname, path: "/" });
  const errs = []; p.on("pageerror", (e) => errs.push(String(e))); p.on("console", (m) => m.type() === "error" && !/ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED/.test(m.text()) && errs.push(m.text()));
  await p.goto(`${BASE}/economy/engine?player=${PLAYER}`, { waitUntil: "networkidle0" }); await wait(1000);
  const q = (fn, ...a) => p.evaluate(fn, ...a); const c = {};
  c.dir = await q(() => document.documentElement.dir); c.dirOk = c.dir === (loc === "ar" ? "rtl" : "ltr");
  c.noJsErrors = errs.length === 0;
  c.overflowMine = !(await q(() => document.documentElement.scrollWidth > innerWidth + 1));
  c.companyCards = await q(() => document.querySelectorAll("section[aria-label] > div > button").length) === 3;
  c.chartsLabelled = (await q(() => [...document.querySelectorAll("svg[role=img]")].map((x) => x.getAttribute("aria-label")).filter(Boolean).length)) >= 1;
  const detail = () => q(() => [...document.querySelectorAll("h3")].find((x) => x.nextElementSibling?.tagName === "DL")?.parentElement.innerText.replace(/\s+/g, " "));
  const seen = new Set(); for (let i = 0; i < 3; i++) { await q((i) => document.querySelectorAll("section[aria-label] > div > button")[i].click(), i); await wait(120); seen.add(await detail()); }
  c.wageCardsSwitchDetail = seen.size === 3;
  const snap = () => q(() => [...document.querySelectorAll("section[aria-label] > div > button")].map((x) => x.innerText).join("|"));
  const s1 = await snap(); await setVal(p, "input[type=range][min='-50']", "80"); await wait(200);
  c.priceSliderChangesResults = s1 !== (await snap());
  const w1 = await snap(); await setVal(p, "input[type=range][max='30']", "5"); await wait(200);
  c.workersSliderChangesResults = w1 !== (await snap());
  await setVal(p, "input[placeholder='0.1500']", "0.0500"); await wait(200); c.customWageResult = await q(() => !!document.querySelector("input[placeholder='0.1500']")?.parentElement.parentElement.querySelector("p"));
  await q(() => { const d = [...document.querySelectorAll("details")].find((x) => /More options|خيارات أكثر/.test(x.querySelector("summary").textContent)); d.open = true; d.dispatchEvent(new Event("toggle")); }); await wait(150);
  await setVal(p, "select", "patient", "HTMLSelectElement"); await wait(200); c.sellModeSwitch = (await q(() => document.querySelector("select").value)) === "patient";
  await q(() => [...document.querySelectorAll("details")].find((x) => /Details and assumptions|التفاصيل والافتراضات/.test(x.querySelector("summary").textContent)).setAttribute("open", "")); await wait(100);
  c.detailsTable = (await q(() => document.querySelectorAll("table").length)) >= 1;
  await q(() => document.querySelectorAll("[role=tab]")[0].click()); await wait(400);
  const names = () => q(() => [...document.querySelectorAll("[class*=cards] > div strong")].map((x) => x.textContent).join(","));
  const all = await names(); c.opportunityCards = (await q(() => document.querySelectorAll("[class*=cards] > div").length)) === 6;
  await q(() => document.querySelectorAll("button[class*=pill]")[1].click()); await wait(200); const raw = await names();
  await q(() => document.querySelectorAll("button[class*=pill]")[2].click()); await wait(200); const made = await names();
  c.filtersChangeList = all !== raw && raw !== made;
  await q(() => document.querySelectorAll("button[class*=pill]")[0].click()); await q(() => document.querySelectorAll("button[class*=pill]")[3].click()); await wait(200); c.hideThinKeepsResults = (await names()).length > 0;
  await q(() => [...document.querySelectorAll("details")].find((x) => /All products|كل المنتجات/.test(x.querySelector("summary").textContent)).setAttribute("open", "")); await wait(100);
  c.productTable = (await q(() => document.querySelectorAll("table tbody tr").length)) > 5;
  c.noBrokenImages = (await q(() => [...document.querySelectorAll("img")].filter((i) => i.complete && i.naturalWidth === 0).length)) === 0;
  c.overflowOpp = !(await q(() => document.documentElement.scrollWidth > innerWidth + 1));
  c.noTinyText = (await q(() => [...document.querySelectorAll("main *")].filter((e) => !e.children.length && e.textContent.trim() && parseFloat(getComputedStyle(e).fontSize) < 11).length)) === 0;
  c.tapTargets = (await q(() => [...document.querySelectorAll("main button, main select, main input:not([type=range])")].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height < 32; }).length)) === 0;
  await p.screenshot({ path: `/tmp/engine-${loc}-${w}.png`, fullPage: true });
  const bad = Object.entries(c).filter(([, v]) => typeof v === "boolean" && !v).map(([k]) => k); failed += bad.length;
  report.push({ loc, w, failedChecks: bad, errs, checks: c });
}
console.log(JSON.stringify(report, null, 1)); await b.close(); process.exit(failed ? 1 : 0);
