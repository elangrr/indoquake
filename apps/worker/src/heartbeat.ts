import Redis from "ioredis";
import {
  HEARTBEAT_KEY,
  HEARTBEAT_TTL_SECONDS,
  type FeedName,
  type WorkerHeartbeat,
} from "@indoquake/shared";
import { DOWN_AFTER_FAILURES, type FeedState } from "./scheduler";
import type { IngestTotals } from "./ingest";

export function createRedis(redisUrl: string): Redis {
  return new Redis(redisUrl, { maxRetriesPerRequest: 2, enableOfflineQueue: false });
}

function iso(ms: number | null): string | null {
  return ms === null ? null : new Date(ms).toISOString();
}

/** lastSuccessAt is the last successful autogempa poll: the "last updated" time users see. */
export function buildHeartbeat(
  states: FeedState[],
  totals: IngestTotals,
  startedAtMs: number,
  nowMs: number,
): WorkerHeartbeat {
  const feeds = {} as WorkerHeartbeat["feeds"];
  for (const state of states) {
    feeds[state.feed as FeedName] = {
      fetched: state.consecutiveFailures === 0 && state.lastOkAt !== null,
      events: 0,
      ...(state.lastError && state.consecutiveFailures > 0 ? { error: state.lastError } : {}),
      lastOkAt: iso(state.lastOkAt),
      lastErrorAt: iso(state.lastErrorAt),
      consecutiveFailures: state.consecutiveFailures,
      intervalSeconds: state.intervalMs / 1000,
    };
  }
  const autogempa = states.find((state) => state.feed === "autogempa");
  return {
    at: new Date(nowMs).toISOString(),
    ok: states.every((state) => state.consecutiveFailures < DOWN_AFTER_FAILURES),
    lastSuccessAt: iso(autogempa?.lastOkAt ?? null),
    startedAt: new Date(startedAtMs).toISOString(),
    feeds,
    totals: { ...totals },
  };
}

export async function writeHeartbeat(redis: Redis, heartbeat: WorkerHeartbeat): Promise<void> {
  await redis.set(HEARTBEAT_KEY, JSON.stringify(heartbeat), "EX", HEARTBEAT_TTL_SECONDS);
}
