import { parseFeltReports } from "@indoquake/bmkg";
import { provinceBySlug, zoneOfEvent } from "@indoquake/regions/meta";
import type { AreaKind, EarthquakeEvent } from "@indoquake/shared";
import type { earthquakes } from "./schema";

export type EarthquakeRow = typeof earthquakes.$inferSelect;

const AREA_KINDS = new Set<string>(["land", "sea"]);

/**
 * Stored row to the contract shape (SSE payload, API JSON). Area comes from the stored columns:
 * land = province; sea = nearest province + km (province null); legacy (area_kind null) = stored province as before.
 * zone: the province's, else the nearest province's, else WIB.
 */
export function toEarthquakeEvent(row: EarthquakeRow): EarthquakeEvent {
  const areaKind = row.areaKind && AREA_KINDS.has(row.areaKind) ? (row.areaKind as AreaKind) : null;
  const provinceSlug = areaKind === "sea" ? null : (row.provinceSlug ?? null);
  const nearestProvinceSlug = areaKind === "sea" ? (row.nearestProvinceSlug ?? null) : null;
  const province = provinceSlug ? provinceBySlug(provinceSlug) : null;
  const nearest = nearestProvinceSlug ? provinceBySlug(nearestProvinceSlug) : null;
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
    provinceSlug,
    provinceName: province?.name ?? null,
    areaKind,
    nearestProvinceSlug,
    nearestProvinceName: nearest?.name ?? null,
    nearestProvinceKm: areaKind === "sea" ? (row.nearestProvinceKm ?? null) : null,
    zone: zoneOfEvent({ provinceSlug, nearestProvinceSlug }),
    firstSeenAt: row.firstSeenAt.toISOString(),
    lastUpdatedAt: row.lastUpdatedAt.toISOString(),
  };
}
