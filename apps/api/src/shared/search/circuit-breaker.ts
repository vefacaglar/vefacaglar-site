import type { Redis as RedisClient } from "ioredis";

const HEALTH_KEY = "typesense:health";
const OPEN_DURATION_SEC = 30;
const REDIS_READ_TIMEOUT_MS = 200;

export class RedisCircuitBreaker {
  constructor(private readonly redis: RedisClient | null) {}

  async isOpen(): Promise<boolean> {
    if (!this.redis) return false;
    try {
      const value = await withTimeoutMs(this.redis.get(HEALTH_KEY), REDIS_READ_TIMEOUT_MS);
      return value === "unhealthy";
    } catch {
      return false;
    }
  }

  async recordFailure(): Promise<void> {
    if (!this.redis) return;
    try {
      await withTimeoutMs(
        this.redis.set(HEALTH_KEY, "unhealthy", "EX", OPEN_DURATION_SEC),
        REDIS_READ_TIMEOUT_MS
      );
    } catch {
      // Redis itself is unavailable; breaker state will simply not be persisted.
    }
  }

  async recordSuccess(): Promise<void> {
    // No-op: the unhealthy key is set with TTL, so it self-clears.
    // Successful calls do not need to clear it explicitly.
  }
}

function withTimeoutMs<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("redis op timed out")), ms);
    promise
      .then((v) => {
        clearTimeout(timer);
        resolve(v);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}
