import { describe, expect, it } from "vitest";
import { formatGold, parseMoney, sumMoney } from "@/lib/money";

describe("money", () => {
  it("parses integer strings exactly, including very large values", () => {
    expect(parseMoney("12345")).toBe(12345n);
    expect(parseMoney("99999999999999999999999")).toBe(99999999999999999999999n);
    for (const bad of ["1.5", "", "abc", "1e3", " 1"]) expect(() => parseMoney(bad)).toThrow();
  });
  it("sums without floating point error", () => {
    expect(formatGold(sumMoney(["1000", "2000"]), { decimals: 4 })).toBe("0.3000");
  });
  it("formats 1/10,000 units", () => {
    expect(formatGold(12345n, { decimals: 4 })).toBe("1.2345");
    expect(formatGold(12345n)).toBe("1.23");
    expect(formatGold(15000n)).toBe("1.50");
    expect(formatGold(12350n)).toBe("1.24");
    expect(formatGold(12345678901n, { decimals: 0 })).toBe("1,234,568");
    expect(formatGold(-12345n, { decimals: 4 })).toBe("-1.2345");
    expect(formatGold(-1n, { decimals: 2 })).toBe("0.00");
    expect(formatGold(0n)).toBe("0.00");
  });
});
