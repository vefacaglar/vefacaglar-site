import Redis, { type Redis as RedisClient } from "ioredis";

export interface RedisConfig {
  url: string;
}

export function readRedisConfig(): RedisConfig | null {
  const url = process.env.REDIS_URL;
  return url ? { url } : null;
}

let cachedClient: RedisClient | null = null;

export function createRedisClient(config: RedisConfig): RedisClient {
  if (cachedClient) return cachedClient;

  const client = new Redis(config.url, {
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    retryStrategy: (times) => Math.min(times * 200, 2000),
  });

  client.on("error", (err) => {
    console.error("[redis] client error:", err.message);
  });

  cachedClient = client;
  return client;
}

export function createDisabledRedisClient(): RedisClient {
  return new Proxy({} as RedisClient, {
    get(_target, prop) {
      const stub = () => {
        throw new Error(`redis is not configured (called: ${String(prop)})`);
      };
      return stub;
    },
  });
}

export function resetRedisClient(): void {
  if (cachedClient) {
    cachedClient.disconnect();
    cachedClient = null;
  }
}
