/** Sliding-window limiter. Per process: a safety margin under the upstream per-IP limit, not a global guarantee. */
export class RateLimiter {
  private stamps: number[] = [];

  constructor(
    private readonly max: number,
    private readonly windowMs = 60_000,
    private readonly now: () => number = Date.now,
  ) {}

  private prune(): void {
    const cutoff = this.now() - this.windowMs;
    while (this.stamps.length > 0 && (this.stamps[0] as number) <= cutoff) this.stamps.shift();
  }

  tryAcquire(): boolean {
    this.prune();
    if (this.stamps.length >= this.max) return false;
    this.stamps.push(this.now());
    return true;
  }

  msUntilAvailable(): number {
    this.prune();
    if (this.stamps.length < this.max) return 0;
    return Math.max(0, (this.stamps[0] as number) + this.windowMs - this.now());
  }
}
