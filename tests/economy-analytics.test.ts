import { describe, expect, it } from "vitest";
import { marketInsights, marketView } from "@/features/economy/analytics";
import type { MarketRow } from "@/lib/domain/economy";

const row = (itemCode: string, bestAsk: string | null, bestBid: string | null, last: string | null): MarketRow => ({ itemCode, bestAsk, bestBid, last, askQty: 1, bidQty: 1 }) as MarketRow;

describe("marketInsights", () => {
  const v = marketView([row("a", "120", "100", "100"), row("b", "90", "80", "100"), row("c", null, "50", "60"), row("d", "200", null, "100"), row("e", null, null, null)]);
  const i = marketInsights(v, 2);
  it("counts items and sides without treating missing as zero", () => expect(i).toMatchObject({ items: 5, withAsk: 3, withBid: 3, noAsk: 2 }));
  it("median spread uses only items with both sides", () => expect(i.medianSpreadBps).toBe(Math.trunc((2000 + 1250) / 2)));
  it("ranks asks above / below the last price", () => {
    expect(i.askAbove.map((x) => x.itemCode)).toEqual(["d", "a"]);
    expect(i.askBelow.map((x) => x.itemCode)).toEqual(["b"]);
  });
  it("no data gives null median and empty lists", () => expect(marketInsights(marketView([row("z", null, null, null)]))).toMatchObject({ medianSpreadBps: null, askAbove: [], askBelow: [] }));
});
