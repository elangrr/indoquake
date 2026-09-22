import { haversineKm, hypocentralKm } from "@indoquake/geo";
import type { EarthquakeEvent } from "@indoquake/shared";
import type { UserLocation } from "./use-geolocation";

export interface DistanceInfo {
  epicentralKm: number;
  hypocentralKm: number;
}

export type DistanceMap = Map<string, DistanceInfo>;

export function buildDistanceMap(
  events: EarthquakeEvent[],
  location: UserLocation | null,
): DistanceMap | null {
  if (!location) return null;
  const distances: DistanceMap = new Map();
  for (const event of events) {
    const epicentralKm = haversineKm(location, {
      latitude: event.latitude,
      longitude: event.longitude,
    });
    distances.set(event.eventKey, {
      epicentralKm,
      hypocentralKm: hypocentralKm(epicentralKm, event.depthKm),
    });
  }
  return distances;
}

export function findNearest(
  events: EarthquakeEvent[],
  distances: DistanceMap | null,
): { event: EarthquakeEvent; distance: DistanceInfo } | null {
  if (!distances) return null;
  let best: { event: EarthquakeEvent; distance: DistanceInfo } | null = null;
  for (const event of events) {
    const distance = distances.get(event.eventKey);
    if (!distance) continue;
    if (!best || distance.epicentralKm < best.distance.epicentralKm) {
      best = { event, distance };
    }
  }
  return best;
}
