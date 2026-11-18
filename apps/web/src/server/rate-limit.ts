/** A small in-memory sliding-window rate limiter (per server instance). */
export class RateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
  ) {}

  /** Records a hit and returns true when the key is still under the limit. */
  allow(key: string, now = Date.now()): boolean {
    const since = now - this.windowMs;
    const recent = (this.hits.get(key) ?? []).filter((t) => t > since);
    if (recent.length >= this.max) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(now);
    this.hits.set(key, recent);
    if (this.hits.size > 10_000) this.prune(since);
    return true;
  }

  private prune(since: number): void {
    for (const [key, times] of this.hits) {
      const kept = times.filter((t) => t > since);
      if (kept.length) this.hits.set(key, kept);
      else this.hits.delete(key);
    }
  }
}

export const authLimiter = new RateLimiter(10, 60_000);
export const shareReadLimiter = new RateLimiter(60, 60_000);
export const writeLimiter = new RateLimiter(60, 60_000);
