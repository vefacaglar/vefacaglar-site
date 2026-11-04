import { reportRuntimeFailure } from "../application-logs/runtime-failures";
import Redis, { type Redis as RedisClient } from "ioredis";

export interface RedisConfig {
  url: string;
}

export function readRedisConfig(): RedisConfig | null {
  const url = process.env.REDIS_URL;
  return url ? { url } : null;
}

let cachedClient: RedisClient | null = null;
const reconnectDelays = [250, 1_000, 2_000];
const stableConnectionMs = 30_000;
const permanentReply = /^(?:WRONGPASS\b|NOAUTH\b|NOPERM\b|ERR (?:AUTH\b|SELECT\b|DB index\b))/i;

export function createRedisClient(config: RedisConfig): RedisClient {
  if (cachedClient) return cachedClient;

  let permanentFailure = false;
  let previousMessage: string | undefined;
  let reconnectAttempts = 0;
  let readyAt: number | undefined;
  const client = new Redis(config.url, {
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    retryStrategy: () => {
      if (permanentFailure) return null;
      if (readyAt !== undefined && Date.now() - readyAt >= stableConnectionMs) {
        reconnectAttempts = 0;
      }
      readyAt = undefined;
      return reconnectDelays[reconnectAttempts++] ?? null;
    },
  });

  client.on("ready", () => {
    readyAt = Date.now();
    permanentFailure = false;
    previousMessage = undefined;
  });
  client.on("error", (err) => {
    permanentFailure ||= err.name === "ReplyError" && permanentReply.test(err.message);
    if (err.message === previousMessage) return;
    previousMessage = err.message;
    reportRuntimeFailure("redis_client_error", "Redis client failed", err);
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
