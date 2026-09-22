import { minDistanceToRingsKm, pointInRings } from "@indoquake/geo";
import provinceData from "./data/java-provinces.json";

export interface ProvinceBbox {
  minLat: number;
  minLon: number;
  maxLat: number;
  maxLon: number;
}

export interface ProvinceInfo {
  slug: string;
  name: string;
  center: { latitude: number; longitude: number };
  bbox: ProvinceBbox;
  rings: number[][][];
}

interface ProvinceFile {
  source: string;
  provinces: ProvinceInfo[];
}

const DATA = provinceData as unknown as ProvinceFile;

export const PROVINCES: readonly ProvinceInfo[] = DATA.provinces;

export const PROVINCE_OPTIONS: readonly { slug: string; name: string }[] =
  DATA.provinces.map((province) => ({
    slug: province.slug,
    name: province.name,
  }));

export function provinceBySlug(slug: string): ProvinceInfo | null {
  return PROVINCES.find((province) => province.slug === slug) ?? null;
}

export interface ProvinceResolution {
  province: ProvinceInfo;
  method: "inside" | "nearest";
  distanceKm: number;
}

function inBbox(
  province: ProvinceInfo,
  latitude: number,
  longitude: number,
  marginDegrees: number,
): boolean {
  const { bbox } = province;
  return (
    latitude >= bbox.minLat - marginDegrees &&
    latitude <= bbox.maxLat + marginDegrees &&
    longitude >= bbox.minLon - marginDegrees &&
    longitude <= bbox.maxLon + marginDegrees
  );
}

export function resolveProvince(
  latitude: number,
  longitude: number,
  maxNearestKm = 250,
): ProvinceResolution | null {
  const point = { latitude, longitude };

  for (const province of PROVINCES) {
    if (!inBbox(province, latitude, longitude, 0.05)) continue;
    if (pointInRings(point, province.rings)) {
      return { province, method: "inside", distanceKm: 0 };
    }
  }

  let best: ProvinceResolution | null = null;
  for (const province of PROVINCES) {
    if (!inBbox(province, latitude, longitude, maxNearestKm / 100 + 1)) {
      continue;
    }
    const km = minDistanceToRingsKm(point, province.rings);
    if (!best || km < best.distanceKm) {
      best = { province, method: "nearest", distanceKm: km };
    }
  }

  if (best && best.distanceKm <= maxNearestKm) {
    return {
      province: best.province,
      method: "nearest",
      distanceKm: Math.round(best.distanceKm),
    };
  }
  return null;
}

export function provinceDistanceKm(
  slug: string,
  latitude: number,
  longitude: number,
): number | null {
  const province = provinceBySlug(slug);
  if (!province) return null;
  return Math.round(
    minDistanceToRingsKm({ latitude, longitude }, province.rings),
  );
}
