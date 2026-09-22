import Redis from "ioredis";
import type { CycleSummary } from "./ingest";

export const HEARTBEAT_KEY = "indoquake:worker:heartbeat";
export const HEARTBEAT_TTL_SECONDS = 120;

export function createRedis(redisUrl: string): Redis {
  return new Redis(redisUrl, { maxRetriesPerRequest: 2 });
}

export async function writeHeartbeat(
  redis: Redis,
  summary: CycleSummary,
): Promise<void> {
  await redis.set(
    HEARTBEAT_KEY,
    JSON.stringify(summary),
    "EX",
    HEARTBEAT_TTL_SECONDS,
  );
}
