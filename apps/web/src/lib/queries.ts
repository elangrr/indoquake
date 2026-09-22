import {
  and,
  asc,
  desc,
  eq,
  gte,
  isNotNull,
  lte,
  type SQL,
} from "drizzle-orm";
import {
  earthquakeFeeds,
  earthquakes,
  earthquakeUpdates,
} from "@indoquake/database";
import type {
  EarthquakeDetail,
  EarthquakeEvent,
  EarthquakeRevision,
} from "@indoquake/shared";
import { getDb } from "./db";
import { toEarthquakeEvent } from "./serialize";

export interface ListEarthquakesOptions {
  limit?: number;
  minMagnitude?: number;
  maxMagnitude?: number;
  minDepthKm?: number;
  maxDepthKm?: number;
  fromUtc?: string;
  toUtc?: string;
  feltOnly?: boolean;
  tsunamiOnly?: boolean;
  provinceSlug?: string;
  order?: "desc" | "asc";
}

export async function listEarthquakes(
  options: ListEarthquakesOptions = {},
): Promise<EarthquakeEvent[]> {
  const filters: SQL[] = [];

  if (options.minMagnitude !== undefined) {
    filters.push(gte(earthquakes.magnitude, options.minMagnitude));
  }
  if (options.maxMagnitude !== undefined) {
    filters.push(lte(earthquakes.magnitude, options.maxMagnitude));
  }
  if (options.minDepthKm !== undefined) {
    filters.push(gte(earthquakes.depthKm, options.minDepthKm));
  }
  if (options.maxDepthKm !== undefined) {
    filters.push(lte(earthquakes.depthKm, options.maxDepthKm));
  }
  if (options.fromUtc) {
    filters.push(gte(earthquakes.eventTimeUtc, new Date(options.fromUtc)));
  }
  if (options.toUtc) {
    filters.push(lte(earthquakes.eventTimeUtc, new Date(options.toUtc)));
  }
  if (options.feltOnly) {
    filters.push(isNotNull(earthquakes.feltText));
  }
  if (options.tsunamiOnly) {
    filters.push(eq(earthquakes.tsunamiPotential, true));
  }

  const rows = await getDb()
    .select()
    .from(earthquakes)
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(
      options.order === "asc"
        ? asc(earthquakes.eventTimeUtc)
        : desc(earthquakes.eventTimeUtc),
    )
    .limit(options.limit ?? 200);

  const events = rows.map(toEarthquakeEvent);

  if (options.provinceSlug) {
    return events.filter(
      (event) => event.provinceSlug === options.provinceSlug,
    );
  }
  return events;
}

export async function getEarthquakeDetail(
  eventKey: string,
): Promise<EarthquakeDetail | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(earthquakes)
    .where(eq(earthquakes.eventKey, eventKey))
    .limit(1);
  if (!row) return null;

  const feedRows = await db
    .select({ feed: earthquakeFeeds.feed })
    .from(earthquakeFeeds)
    .where(eq(earthquakeFeeds.earthquakeId, row.id));

  const revisionRows = await db
    .select()
    .from(earthquakeUpdates)
    .where(eq(earthquakeUpdates.earthquakeId, row.id))
    .orderBy(desc(earthquakeUpdates.observedAt));

  const revisions: EarthquakeRevision[] = revisionRows.map((revision) => ({
    field: revision.field,
    oldValue: revision.oldValue,
    newValue: revision.newValue,
    observedAt: revision.observedAt.toISOString(),
  }));

  return {
    ...toEarthquakeEvent(row),
    feeds: feedRows.map((feedRow) => feedRow.feed),
    revisions,
  };
}
