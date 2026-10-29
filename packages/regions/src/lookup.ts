// Server-only province assignment (SPEC section 6, DECISIONS D5). Imports the lookup geometry (about 1.3 MB):
// never import this from client code; use @indoquake/regions/meta there.
import { distanceToRingKm, pointInRing } from "@indoquake/geo";
import type { AreaResponse } from "@indoquake/shared";
import lookupFile from "./data/provinces-lookup.json";
import { PROVINCE_TABLE, SNAP_KM, provinceBySlug, zoneOfProvince, type ProvinceMeta } from "./meta";

/** One polygon = outer ring then hole rings; coordinates [lon, lat]. */
type Polygon = number[][][];

interface LookupProvince {
  slug: string;
  bbox: { minLat: number; minLon: number; maxLat: number; maxLon: number };
  polygons: Polygon[];
}

const LOOKUP: readonly LookupProvince[] = (lookupFile as { provinces: LookupProvince[] }).provinces;

if (LOOKUP.map((province) => province.slug).join() !== PROVINCE_TABLE.map((province) => province.slug).join()) {
  throw new Error("provinces-lookup.json tidak sama dengan provinces-table.json; jalankan scripts/build-provinces.mjs");
}

export type AreaAssignment =
  | { kind: "land"; provinceSlug: string; snapped: boolean }
  | { kind: "sea"; nearestProvinceSlug: string; nearestProvinceKm: number };

const BBOX_MARGIN_DEGREES = 0.05;
const KM_PER_DEG_LAT = 110.574;

function inside(polygons: Polygon[], point: { latitude: number; longitude: number }): boolean {
  return polygons.some(
    ([outer, ...holes]) => pointInRing(point, outer) && !holes.some((hole) => pointInRing(point, hole)),
  );
}

/** Lower bound of the distance (same local metric as distanceToRingKm) from the point to a bbox. */
function bboxDistanceKm(province: LookupProvince, latitude: number, longitude: number): number {
  const { bbox } = province;
  const dLat = Math.max(0, bbox.minLat - latitude, latitude - bbox.maxLat);
  const dLon = Math.max(0, bbox.minLon - longitude, longitude - bbox.maxLon);
  return Math.hypot(dLat * KM_PER_DEG_LAT, dLon * 111.32 * Math.cos((latitude * Math.PI) / 180));
}

/**
 * Land (inside a province, or within SNAP_KM of one: snapped) or sea with the nearest province and its integer km.
 * Null for non-finite or out-of-range coordinates. Overlapping provinces resolve by table order.
 */
export function assignArea(latitude: number, longitude: number): AreaAssignment | null {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  const point = { latitude, longitude };

  for (const province of LOOKUP) {
    const { bbox } = province;
    if (
      latitude < bbox.minLat - BBOX_MARGIN_DEGREES ||
      latitude > bbox.maxLat + BBOX_MARGIN_DEGREES ||
      longitude < bbox.minLon - BBOX_MARGIN_DEGREES ||
      longitude > bbox.maxLon + BBOX_MARGIN_DEGREES
    ) {
      continue;
    }
    if (inside(province.polygons, point)) return { kind: "land", provinceSlug: province.slug, snapped: false };
  }

  let nearest: LookupProvince = LOOKUP[0];
  let nearestKm = Infinity;
  for (const province of LOOKUP) {
    if (bboxDistanceKm(province, latitude, longitude) >= nearestKm) continue;
    for (const polygon of province.polygons) {
      for (const ring of polygon) {
        const km = distanceToRingKm(point, ring);
        if (km < nearestKm) {
          nearestKm = km;
          nearest = province;
        }
      }
    }
  }

  if (nearestKm <= SNAP_KM) return { kind: "land", provinceSlug: nearest.slug, snapped: true };
  return { kind: "sea", nearestProvinceSlug: nearest.slug, nearestProvinceKm: Math.round(nearestKm) };
}

/** The GET /api/v1/area data object, or null for invalid coordinates. */
export function describeLocation(latitude: number, longitude: number): AreaResponse["data"] | null {
  const area = assignArea(latitude, longitude);
  if (!area) return null;
  if (area.kind === "land") {
    return {
      latitude,
      longitude,
      kind: "land",
      provinceSlug: area.provinceSlug,
      provinceName: provinceBySlug(area.provinceSlug)?.name ?? null,
      nearestProvinceSlug: null,
      nearestProvinceName: null,
      nearestProvinceKm: null,
      zone: zoneOfProvince(area.provinceSlug) ?? "WIB",
    };
  }
  return {
    latitude,
    longitude,
    kind: "sea",
    provinceSlug: null,
    provinceName: null,
    nearestProvinceSlug: area.nearestProvinceSlug,
    nearestProvinceName: provinceBySlug(area.nearestProvinceSlug)?.name ?? null,
    nearestProvinceKm: area.nearestProvinceKm,
    zone: zoneOfProvince(area.nearestProvinceSlug) ?? "WIB",
  };
}

export interface ProvinceResolution {
  province: ProvinceMeta;
  method: "inside";
  distanceKm: 0;
}

/**
 * @deprecated Use assignArea. Land only (inside or snapped), null for sea. Kept so apps/worker store.ts and
 * notify.ts compile until lane A moves them to assignArea and removes this wrapper (SPEC section 7).
 */
export function resolveProvince(latitude: number, longitude: number): ProvinceResolution | null {
  const area = assignArea(latitude, longitude);
  if (!area || area.kind !== "land") return null;
  const province = provinceBySlug(area.provinceSlug);
  return province ? { province, method: "inside", distanceKm: 0 } : null;
}
