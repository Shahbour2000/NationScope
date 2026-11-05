import { describe, expect, it } from "vitest";
import { cappedCols, desktopCols, tabletCols } from "@/features/government/Leadership";

describe("leadership grid columns", () => {
  it("never leaves a single card alone on the last desktop row", () => {
    for (let n = 1; n <= 12; n++) {
      const c = desktopCols(n);
      const lastRow = n % c === 0 ? c : n % c;
      expect(n === 1 || lastRow > 1 || c === 1).toBe(true);
    }
  });
  it("keeps three offices in one row (e.g. VP + two ministers)", () => { expect(desktopCols(3)).toBe(3); expect(cappedCols(3)).toBe(3); });
  it("balances four as 2x2 and five as 3+2", () => { expect(desktopCols(4)).toBe(2); expect(desktopCols(5)).toBe(3); expect(cappedCols(5)).toBe(3); });
  it("narrow containers use pairs or a single column, never an orphan", () => {
    for (let n = 1; n <= 10; n++) { const c = tabletCols(n); expect(n % c === 0 || c === 1).toBe(true); }
  });
});
