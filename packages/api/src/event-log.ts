import { and, asc, count, gt, gte, max, min } from "drizzle-orm";
import { eventLog, type Database } from "@indoquake/database";
import { SSE_REPLAY_MAX, SSE_REPLAY_MAX_AGE_MS, type EarthquakeStreamPayload } from "@indoquake/shared";

export interface LogEntry {
  seq: number;
  payload: EarthquakeStreamPayload;
}

/** event_log access for the stream: the outbox the worker writes in the same transaction as the quake. */
export function createEventLogReader(db: Database, now: () => number = Date.now) {
  const windowStart = () => new Date(now() - SSE_REPLAY_MAX_AGE_MS);
  return {
    async newestId(): Promise<number | null> {
      const [row] = await db.select({ id: max(eventLog.id) }).from(eventLog);
      return row?.id ?? null;
    },
    async replayWindow(afterId: number): Promise<{ oldestRetainedId: number | null; missingCount: number }> {
      const [oldest] = await db
        .select({ id: min(eventLog.id) })
        .from(eventLog)
        .where(gte(eventLog.createdAt, windowStart()));
      const [missing] = await db
        .select({ n: count() })
        .from(eventLog)
        .where(and(gt(eventLog.id, afterId), gte(eventLog.createdAt, windowStart())));
      return { oldestRetainedId: oldest?.id ?? null, missingCount: missing?.n ?? 0 };
    },
    async after(afterId: number, limit: number = SSE_REPLAY_MAX): Promise<LogEntry[]> {
      const rows = await db
        .select({ id: eventLog.id, payload: eventLog.payload })
        .from(eventLog)
        .where(and(gt(eventLog.id, afterId), gte(eventLog.createdAt, windowStart())))
        .orderBy(asc(eventLog.id))
        .limit(limit);
      return rows.map((row) => ({ seq: row.id, payload: { ...(row.payload as EarthquakeStreamPayload), seq: row.id } }));
    },
  };
}

export type EventLogReader = ReturnType<typeof createEventLogReader>;
