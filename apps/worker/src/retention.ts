import { lt } from "drizzle-orm";
import type { Logger } from "pino";
import { earthquakes, eventLog, type Database } from "@indoquake/database";

export const RETENTION_INTERVAL_MS = 3_600_000;

/** Deletes quakes older than retentionDays; 0 (the default) keeps everything forever (D06). */
export async function purgeOldEarthquakes(db: Database, retentionDays: number, nowMs: number): Promise<number> {
  if (retentionDays <= 0) return 0;
  const cutoff = new Date(nowMs - retentionDays * 86_400_000);
  const deleted = await db.delete(earthquakes).where(lt(earthquakes.eventTimeUtc, cutoff)).returning({ id: earthquakes.id });
  return deleted.length;
}

/** Deletes event_log rows older than the retention window (D15); quake rows are not touched. */
export async function pruneEventLog(db: Database, retentionHours: number, nowMs: number): Promise<number> {
  const cutoff = new Date(nowMs - retentionHours * 3_600_000);
  const deleted = await db.delete(eventLog).where(lt(eventLog.createdAt, cutoff)).returning({ id: eventLog.id });
  return deleted.length;
}

/** Runs both purges at most once per hour, however often it is called. */
export function createRetentionJob(
  db: Database,
  options: { retentionDays: number; eventLogRetentionHours: number; logger: Logger; now?: () => number },
): () => Promise<boolean> {
  const now = options.now ?? Date.now;
  let lastRunAt: number | null = null;
  return async () => {
    const at = now();
    if (lastRunAt !== null && at - lastRunAt < RETENTION_INTERVAL_MS) return false;
    lastRunAt = at;
    try {
      const quakes = await purgeOldEarthquakes(db, options.retentionDays, at);
      const logs = await pruneEventLog(db, options.eventLogRetentionHours, at);
      if (quakes + logs > 0) options.logger.info({ quakes, eventLog: logs }, "retention_cleanup");
    } catch (error) {
      options.logger.warn({ err: String(error) }, "retention_cleanup_failed");
    }
    return true;
  };
}
