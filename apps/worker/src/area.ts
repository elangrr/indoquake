import { ASSIGNMENT_VERSION, assignArea } from "@indoquake/regions";
import type { AreaKind } from "@indoquake/shared";

/** The five earthquakes columns that hold the region assignment (migration 0003). */
export interface AreaColumns {
  areaKind: AreaKind | null;
  provinceSlug: string | null;
  nearestProvinceSlug: string | null;
  nearestProvinceKm: number | null;
  regionVersion: number;
}

/**
 * Columns for an epicentre: land -> province only, sea -> nearest province and km only. Invalid
 * coordinates (assignArea null) store no area but still the current version, so the backfill does not
 * pick the row again.
 */
export function areaColumnsAt(latitude: number, longitude: number): AreaColumns {
  const area = assignArea(latitude, longitude);
  if (area === null) {
    return { areaKind: null, provinceSlug: null, nearestProvinceSlug: null, nearestProvinceKm: null, regionVersion: ASSIGNMENT_VERSION };
  }
  if (area.kind === "land") {
    return { areaKind: "land", provinceSlug: area.provinceSlug, nearestProvinceSlug: null, nearestProvinceKm: null, regionVersion: ASSIGNMENT_VERSION };
  }
  return {
    areaKind: "sea",
    provinceSlug: null,
    nearestProvinceSlug: area.nearestProvinceSlug,
    nearestProvinceKm: area.nearestProvinceKm,
    regionVersion: ASSIGNMENT_VERSION,
  };
}
