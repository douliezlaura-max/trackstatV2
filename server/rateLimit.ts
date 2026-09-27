/**
 * In-memory token bucket, keyed by API key id. Fine for a single Node process;
 * swap for Redis if you run more than one instance.
 */
export class TokenBucketLimiter {
  private buckets = new Map<string, { tokens: number; updatedAt: number }>();

  constructor(
    private readonly capacity: number,
    private readonly refillPerSecond: number,
  ) {
    // Drop idle buckets so the map doesn't grow without bound.
    setInterval(() => this.prune(), 60_000).unref();
  }

  /** Returns 0 if the request is allowed, else the number of seconds to wait. */
  take(id: string, now = Date.now()): number {
    const b = this.buckets.get(id) ?? { tokens: this.capacity, updatedAt: now };
    b.tokens = Math.min(this.capacity, b.tokens + ((now - b.updatedAt) / 1000) * this.refillPerSecond);
    b.updatedAt = now;
    this.buckets.set(id, b);
    if (b.tokens >= 1) {
      b.tokens -= 1;
      return 0;
    }
    return Math.ceil((1 - b.tokens) / this.refillPerSecond);
  }

  private prune(now = Date.now()) {
    const fullAfterMs = (this.capacity / this.refillPerSecond) * 1000;
    for (const [id, b] of this.buckets) if (now - b.updatedAt > fullAfterMs) this.buckets.delete(id);
  }
}
