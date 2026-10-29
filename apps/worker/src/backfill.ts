import { and, asc, count, eq, gt, lt } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type { Logger } from "pino";
import { earthquakes } from "@indoquake/database";
import { ASSIGNMENT_VERSION } from "@indoquake/regions";
import { areaColumnsAt } from "./area";

export const BACKFILL_BATCH_SIZE = 500;
/** Session advisory lock: a second worker waits for the first backfill, then finds nothing left. */
export const BACKFILL_LOCK_KEY = 7137001;

export interface BackfillResult {
  scanned: number;
  updated: number;
  /** Rows still below ASSIGNMENT_VERSION after the run (0 when done). */
  remaining: number;
}

/**
 * Re-assigns every row whose region_version is below ASSIGNMENT_VERSION (D11, D24), in id order, one
 * transaction per batch, under BACKFILL_LOCK_KEY on its own connection. Silent: it only writes the five
 * area columns (never last_updated_at, event_log, Redis or the notifier). A row the ingest re-assigned in
 * the meantime is skipped (the update re-checks the version). Bumping ASSIGNMENT_VERSION re-runs it.
 */
export async function backfillRegions(
  databaseUrl: string,
  batchSize: number = BACKFILL_BATCH_SIZE,
): Promise<BackfillResult> {
  const client = postgres(databaseUrl, { max: 1, idle_timeout: 0, onnotice: () => undefined });
  const db = drizzle(client);
  const stale = lt(earthquakes.regionVersion, ASSIGNMENT_VERSION);
  try {
    await client`select pg_advisory_lock(${BACKFILL_LOCK_KEY})`;
    let lastId = 0;
    let scanned = 0;
    let updated = 0;
    for (;;) {
      const done = await db.transaction(async (tx) => {
        const rows = await tx
          .select({ id: earthquakes.id, latitude: earthquakes.latitude, longitude: earthquakes.longitude })
          .from(earthquakes)
          .where(and(stale, gt(earthquakes.id, lastId)))
          .orderBy(asc(earthquakes.id))
          .limit(batchSize);
        for (const row of rows) {
          const written = await tx
            .update(earthquakes)
            .set(areaColumnsAt(row.latitude, row.longitude))
            .where(and(eq(earthquakes.id, row.id), stale))
            .returning({ id: earthquakes.id });
          updated += written.length;
        }
        scanned += rows.length;
        lastId = rows.at(-1)?.id ?? lastId;
        return rows.length < batchSize;
      });
      if (done) break;
    }
    const [left] = await db.select({ n: count() }).from(earthquakes).where(stale);
    return { scanned, updated, remaining: left?.n ?? 0 };
  } finally {
    await client`select pg_advisory_unlock(${BACKFILL_LOCK_KEY})`.catch(() => undefined);
    await client.end({ timeout: 5 });
  }
}

/** Worker start step: REGION_BACKFILL=off skips it; remaining > 0 logs at warn level (D24). */
export async function runRegionBackfill(options: {
  databaseUrl: string;
  enabled: boolean;
  logger: Pick<Logger, "info" | "warn">;
  batchSize?: number;
}): Promise<BackfillResult | null> {
  if (!options.enabled) {
    options.logger.info({ reason: "REGION_BACKFILL=off" }, "province_backfill_skipped");
    return null;
  }
  const result = await backfillRegions(options.databaseUrl, options.batchSize);
  if (result.remaining > 0) options.logger.warn(result, "province_backfill_done");
  else options.logger.info(result, "province_backfill_done");
  return result;
}
