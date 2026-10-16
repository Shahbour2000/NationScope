import { describe, expect, it } from "vitest";
import { RateLimiter } from "@/lib/api/limiter";

describe("RateLimiter", () => {
  it("allows up to max per window, then recovers", () => {
    let t = 0;
    const l = new RateLimiter(2, 1000, () => t);
    expect(l.tryAcquire()).toBe(true);
    expect(l.tryAcquire()).toBe(true);
    expect(l.tryAcquire()).toBe(false);
    expect(l.msUntilAvailable()).toBe(1000);
    t = 1000;
    expect(l.tryAcquire()).toBe(true);
  });
});
