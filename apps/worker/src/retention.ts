import { lt } from "drizzle-orm";
import type { Logger } from "pino";
import { earthquakes, type Database } from "@indoquake/database";

export async function purgeOldEarthquakes(
  db: Database,
  retentionDays: number,
  logger: Logger,
): Promise<number> {
  const cutoff = new Date(Date.now() - retentionDays * 86_400_000);
  try {
    const deleted = await db
      .delete(earthquakes)
      .where(lt(earthquakes.eventTimeUtc, cutoff))
      .returning({ id: earthquakes.id });
    if (deleted.length > 0) {
      logger.info(
        { deleted: deleted.length, retentionDays, cutoff: cutoff.toISOString() },
        "retention_cleanup",
      );
    }
    return deleted.length;
  } catch (error) {
    logger.warn({ err: error }, "retention_cleanup_failed");
    return 0;
  }
}
