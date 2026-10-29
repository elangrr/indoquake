// Client-safe entry (@indoquake/regions/meta): the 38-province table, zones, labels and time helpers.
// Never import provinces-lookup.json or @indoquake/geo polygon code here (AC 8): web client code uses this entry.
import type { AreaKind, ZoneId } from "@indoquake/shared";
import tableFile from "./data/provinces-table.json";
import { isZoneId } from "./zones";

export * from "./zones";

export interface ProvinceOption {
  slug: string;
  name: string;
  group: string;
  zone: ZoneId;
}

export interface ProvinceBbox {
  minLat: number;
  minLon: number;
  maxLat: number;
  maxLon: number;
}

export interface ProvinceMeta extends ProvinceOption {
  center: { latitude: number; longitude: number };
  bbox: ProvinceBbox;
}

interface TableFile {
  provinces: { slug: string; name: string; group: string; zone: string; iso: string }[];
}


const TABLE = (tableFile as TableFile).provinces;

/** The 38 provinces in table order (SPEC section 5). */
export const PROVINCE_TABLE: readonly ProvinceOption[] = TABLE.map((row) => {
  if (!isZoneId(row.zone)) throw new Error(`provinces-table.json: zona tidak dikenal ${row.zone}`);
  return { slug: row.slug, name: row.name, group: row.group, zone: row.zone };
});

export const PROVINCE_OPTIONS = PROVINCE_TABLE;

export interface ProvinceGroup {
  name: string;
  slugs: readonly string[];
}

/** The 7 island groups in display order, each with its slugs in table order. */
export const PROVINCE_GROUPS: readonly ProvinceGroup[] = PROVINCE_TABLE.reduce<ProvinceGroup[]>((groups, row) => {
  const last = groups.at(-1);
  if (last && last.name === row.group) {
    (last.slugs as string[]).push(row.slug);
  } else {
    groups.push({ name: row.group, slugs: [row.slug] });
  }
  return groups;
}, []);

const BY_SLUG = new Map<string, ProvinceOption>(PROVINCE_TABLE.map((row) => [row.slug, row]));

/** Province name, group, zone, center and bbox (no rings), or null for an unknown slug. */
export function provinceBySlug(slug: string): ProvinceOption | null {
  return BY_SLUG.get(slug) ?? null;
}

/** Indonesia's extent in degrees (the national map view). */
export const INDONESIA_BOUNDS = { south: -11.1, west: 94.9, north: 6.2, east: 141.1 } as const;

/** A point this close to a province outline (km) counts as land of that province (snapped). */
export const SNAP_KM = 2;
/** Sea events up to this distance (km) read "Perairan dekat <Provinsi>" and count for that province's sea filter. */
export const NEAR_SEA_MAX_KM = 300;
/** Bump to make the worker re-assign every stored row (backfill selects region_version below this). */
export const ASSIGNMENT_VERSION = 1;

export function zoneOfProvince(slug: string | null | undefined): ZoneId | null {
  if (!slug) return null;
  return BY_SLUG.get(slug)?.zone ?? null;
}

/** Zone field first, then the province, then the nearest province, else WIB. */
export function zoneOfEvent(event: {
  zone?: string | null;
  provinceSlug?: string | null;
  nearestProvinceSlug?: string | null;
}): ZoneId {
  if (isZoneId(event.zone)) return event.zone;
  return zoneOfProvince(event.provinceSlug) ?? zoneOfProvince(event.nearestProvinceSlug) ?? "WIB";
}

export const SEA_LABEL = "Laut/Perairan";
export const UNKNOWN_AREA_LABEL = "Wilayah belum ditentukan";

/** "<Provinsi>" | "Perairan dekat <Provinsi>" | "Laut/Perairan" | legacy province name | "Wilayah belum ditentukan". */
export function areaLabel(event: {
  areaKind?: AreaKind | null;
  provinceName?: string | null;
  nearestProvinceName?: string | null;
  nearestProvinceKm?: number | null;
}): string {
  if (event.areaKind === "sea") {
    const near =
      event.nearestProvinceName &&
      typeof event.nearestProvinceKm === "number" &&
      event.nearestProvinceKm <= NEAR_SEA_MAX_KM;
    return near ? `Perairan dekat ${event.nearestProvinceName}` : SEA_LABEL;
  }
  if (event.provinceName) return event.provinceName;
  return UNKNOWN_AREA_LABEL;
}
