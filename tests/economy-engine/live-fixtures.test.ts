import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { mapJobs, mapMarket, mapPlayer } from "@/features/economy-engine/data/context";
import { readCompany } from "@/features/economy-engine/domain/company";
import { levelOf } from "@/features/economy-engine/domain/skills";
import { readHistory, readOrderBook, readTrades } from "@/lib/domain/market-item";

/**
 * PARSING TESTS FOR REAL CAPTURED RESPONSES.
 * They run only when `node scripts/aon-sample.mjs --player "<name>"` has saved real responses to tests/fixtures/real/live/.
 * Until then they are SKIPPED, and the roadmap says the live shapes are NOT verified. A skipped suite is not a pass.
 */
const dir = "tests/fixtures/real/live";
const have = existsSync(`${dir}/manifest.json`);
const read = (n: string) => JSON.parse(readFileSync(`${dir}/${n}`, "utf8"));
const files = have ? readdirSync(dir) : [];
const live = describe.skipIf(!have);

live("live captured responses", () => {
  it("market rows parse and carry prices", () => { const r = mapMarket(read("market.json"))!; expect(r.length).toBeGreaterThan(5); expect(r.some((x) => x.bestAsk !== null || x.bestBid !== null)).toBe(true); });
  it("jobs parse with the allowed-wage band", () => { const j = mapJobs(read("jobs.json"))!; expect(j.allowed).not.toBeNull(); expect(j.offersNet.length).toBeGreaterThan(0); });
  it("by-name profile has an id and a production skill", () => { const p = mapPlayer(read("by-name.json")) ?? mapPlayer(read("profile.json")); expect(p).not.toBeNull(); expect(levelOf(p!.skills, "production")).not.toBeNull(); });
  it("every captured company parses with a recipe, taxes and upgrades", () => {
    for (const f of files.filter((x) => /^company-\d+\.json$/.test(x))) { const c = readCompany(read(f))!; expect(c).not.toBeNull(); expect(c.ppPerUnit).not.toBeNull(); expect(c.incomeBp).not.toBeNull(); expect(c.upgrades.length).toBeGreaterThan(0); }
  });
  it("order books are recognised (not just empty)", () => { for (const f of files.filter((x) => x.startsWith("orders-"))) { const b = readOrderBook(read(f)); expect(b, f).not.toBeNull(); } });
  it("history is recognised", () => { for (const f of files.filter((x) => x.startsWith("history-"))) expect(readHistory(read(f)), f).not.toBeNull(); });
  it("item trades are recognised", () => { for (const f of files.filter((x) => x.startsWith("trades-"))) expect(readTrades(read(f)), f).not.toBeNull(); });
});
