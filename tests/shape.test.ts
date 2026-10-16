import { describe, expect, it } from "vitest";
import { headline, renderShape, shapeOf } from "@/lib/diagnostics/shape";

describe("shapeOf", () => {
  it("summarizes objects, arrays and unions across array items", () => {
    const s = shapeOf({ a: 1, list: [{ x: "s" }, { x: 2, y: null }] });
    expect(headline(s)).toBe("object, 2 keys");
    const text = renderShape(s);
    expect(text).toContain("a: number");
    expect(text).toContain("x: number | string");
    expect(text).toContain("y: null");
  });
  it("caps keys and depth", () => {
    const big = Object.fromEntries(Array.from({ length: 70 }, (_, i) => [`k${i}`, i]));
    expect(renderShape(shapeOf(big))).toContain("… 10 more keys");
  });
});
