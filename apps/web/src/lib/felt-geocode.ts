import type { EarthquakeDetail } from "@indoquake/shared";
import { getRedis } from "./redis";
import { searchNominatim, waitForNominatimSlot } from "./nominatim";

export interface FeltLocation {
  mmi: string;
  place: string;
  latitude: number;
  longitude: number;
}

interface Point {
  latitude: number;
  longitude: number;
}

const ADMIN_PREFIX = /^(kab\.|kabupaten|kota|kec\.|kecamatan|prov\.|provinsi)\s+/i;
const NEGATIVE_VALUE = "notfound";
const HIT_TTL_SECONDS = 30 * 24 * 60 * 60;
const MISS_TTL_SECONDS = 7 * 24 * 60 * 60;
const VIEWBOX_DELTA_DEGREES = 3;

const globalForFelt = globalThis as unknown as {
  indoquakeFeltInFlight?: Set<string>;
};

function inFlight(): Set<string> {
  if (!globalForFelt.indoquakeFeltInFlight) {
    globalForFelt.indoquakeFeltInFlight = new Set();
  }
  return globalForFelt.indoquakeFeltInFlight;
}

export function normalizePlaceQuery(place: string): string {
  return place.replace(ADMIN_PREFIX, "").trim();
}

function cacheKey(
  normalizedPlace: string,
  epicenter: Point,
): string {
  const latBucket = Math.round(epicenter.latitude);
  const lonBucket = Math.round(epicenter.longitude);
  return `indoquake:geo:place:${normalizedPlace.toLowerCase()}:${latBucket}:${lonBucket}`;
}

async function readCache(
  key: string,
): Promise<{ hit: boolean; value: Point | null }> {
  try {
    const cached = await getRedis().get(key);
    if (!cached) return { hit: false, value: null };
    if (cached === NEGATIVE_VALUE) return { hit: true, value: null };
    const parsed = JSON.parse(cached) as Point;
    if (
      Number.isFinite(parsed.latitude) &&
      Number.isFinite(parsed.longitude)
    ) {
      return { hit: true, value: parsed };
    }
    return { hit: false, value: null };
  } catch {
    return { hit: false, value: null };
  }
}

async function writeCache(key: string, value: Point | null): Promise<void> {
  try {
    const redis = getRedis();
    if (value) {
      await redis.set(key, JSON.stringify(value), "EX", HIT_TTL_SECONDS);
    } else {
      await redis.set(key, NEGATIVE_VALUE, "EX", MISS_TTL_SECONDS);
    }
  } catch {
    // cache tidak tersedia — abaikan
  }
}

async function geocodePlace(
  place: string,
  epicenter: Point,
): Promise<Point | null> {
  const normalized = normalizePlaceQuery(place);
  if (normalized.length < 3) return null;

  const query = `${normalized}, Indonesia`;
  const viewbox = {
    left: epicenter.longitude - VIEWBOX_DELTA_DEGREES,
    top: epicenter.latitude + VIEWBOX_DELTA_DEGREES,
    right: epicenter.longitude + VIEWBOX_DELTA_DEGREES,
    bottom: epicenter.latitude - VIEWBOX_DELTA_DEGREES,
  };

  try {
    await waitForNominatimSlot();
    let results = await searchNominatim({
      query,
      limit: 1,
      viewbox,
      bounded: true,
    });
    if (results.length === 0) {
      await waitForNominatimSlot();
      results = await searchNominatim({ query, limit: 1 });
    }
    const best = results[0];
    return best ? { latitude: best.latitude, longitude: best.longitude } : null;
  } catch {
    return null;
  }
}

export async function getCachedFeltLocations(
  event: EarthquakeDetail,
): Promise<{ resolved: FeltLocation[]; pendingPlaces: string[] }> {
  const reports = event.feltReports ?? [];
  const resolved: FeltLocation[] = [];
  const pendingPlaces: string[] = [];

  for (const report of reports) {
    const normalized = normalizePlaceQuery(report.place);
    if (normalized.length < 3) continue;
    const key = cacheKey(normalized, event);
    const cached = await readCache(key);
    if (cached.hit && cached.value) {
      resolved.push({
        mmi: report.mmi,
        place: report.place,
        latitude: cached.value.latitude,
        longitude: cached.value.longitude,
      });
    } else if (!cached.hit) {
      pendingPlaces.push(report.place);
    }
  }

  return { resolved, pendingPlaces };
}

export async function resolvePendingPlaces(
  event: EarthquakeDetail,
  places: string[],
): Promise<void> {
  const guard = inFlight();
  for (const place of places) {
    const normalized = normalizePlaceQuery(place);
    if (normalized.length < 3) continue;
    const key = cacheKey(normalized, event);
    if (guard.has(key)) continue;
    guard.add(key);
    try {
      const point = await geocodePlace(place, event);
      await writeCache(key, point);
    } finally {
      guard.delete(key);
    }
  }
}
