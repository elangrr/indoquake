import { and, asc, eq, gt, isNull } from "drizzle-orm";
import { earthquakes, type Database } from "@indoquake/database";
import { provinceSlugAt } from "./store";

export const BACKFILL_BATCH_SIZE = 500;

/**
 * Fills province_slug on rows stored before the column existed, in id order and batches. Rows outside
 * Java stay null (legal). Safe to run on every start: filled rows are skipped.
 */
export async function backfillProvinces(
  db: Database,
  batchSize: number = BACKFILL_BATCH_SIZE,
): Promise<{ scanned: number; updated: number }> {
  let lastId = 0;
  let scanned = 0;
  let updated = 0;
  for (;;) {
    const rows = await db
      .select({ id: earthquakes.id, latitude: earthquakes.latitude, longitude: earthquakes.longitude })
      .from(earthquakes)
      .where(and(isNull(earthquakes.provinceSlug), gt(earthquakes.id, lastId)))
      .orderBy(asc(earthquakes.id))
      .limit(batchSize);
    if (rows.length === 0) break;
    scanned += rows.length;
    for (const row of rows) {
      const slug = provinceSlugAt(row.latitude, row.longitude);
      if (slug === null) continue;
      await db.update(earthquakes).set({ provinceSlug: slug }).where(eq(earthquakes.id, row.id));
      updated += 1;
    }
    lastId = rows[rows.length - 1]?.id ?? lastId;
  }
  return { scanned, updated };
}
