import { parseFeltReports } from "@indoquake/bmkg";
import type { earthquakes } from "@indoquake/database";
import type { EarthquakeEvent } from "@indoquake/shared";
import { resolveProvince } from "@indoquake/regions";

type EarthquakeRow = typeof earthquakes.$inferSelect;

export function toEarthquakeEvent(row: EarthquakeRow): EarthquakeEvent {
  const resolution = resolveProvince(row.latitude, row.longitude);
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
    provinceSlug: resolution?.province.slug ?? null,
    provinceName: resolution?.province.name ?? null,
    firstSeenAt: row.firstSeenAt.toISOString(),
    lastUpdatedAt: row.lastUpdatedAt.toISOString(),
  };
}
