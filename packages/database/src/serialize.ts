import { parseFeltReports } from "@indoquake/bmkg";
import { provinceBySlug } from "@indoquake/regions";
import type { EarthquakeEvent } from "@indoquake/shared";
import type { earthquakes } from "./schema";

export type EarthquakeRow = typeof earthquakes.$inferSelect;

/** Stored row to the contract shape (SSE payload, API JSON). Province comes from the stored column. */
export function toEarthquakeEvent(row: EarthquakeRow): EarthquakeEvent {
  const province = row.provinceSlug ? provinceBySlug(row.provinceSlug) : null;
  return {
    eventKey: row.eventKey,
    eventTimeUtc: row.eventTimeUtc.toISOString(),
    eventTimeWib: row.eventTimeWib,
    latitude: row.latitude,
    longitude: row.longitude,
    depthKm: row.depthKm,
    magnitude: row.magnitude,
    regionName: row.regionName,
    potentialText: row.potentialText,
    tsunamiPotential: row.tsunamiPotential,
    feltText: row.feltText,
    feltReports: parseFeltReports(row.feltText ?? undefined),
    shakemapUrl: row.shakemapUrl,
    source: row.source,
    provinceSlug: row.provinceSlug ?? null,
    provinceName: province?.name ?? null,
    firstSeenAt: row.firstSeenAt.toISOString(),
    lastUpdatedAt: row.lastUpdatedAt.toISOString(),
  };
}
