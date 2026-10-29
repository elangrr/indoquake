export type NotificationChannel = "telegram" | "discord" | "email";

export interface AlertSubscription {
  id: number;
  channel: string;
  target: string;
  minMagnitude: number;
  maxDistanceKm: number | null;
  provinceSlug: string | null;
  tsunamiOnly: boolean;
  feltOnly: boolean;
  locationLatitude: number | null;
  locationLongitude: number | null;
}

/**
 * A province subscription also matches sea events whose nearest province it is, up to this distance
 * (D28). Same value as NEAR_SEA_MAX_KM in @indoquake/regions; this package has no dependencies, so the
 * worker test pins the two together.
 */
export const NEAR_SEA_MATCH_KM = 300;

export interface AlertEvent {
  eventKey: string;
  magnitude: number;
  depthKm: number;
  latitude: number;
  longitude: number;
  regionName: string;
  eventTimeWib: string;
  feltText: string | null;
  tsunamiPotential: boolean | null;
  /** Containing province (land only). */
  provinceSlug: string | null;
  eventTimeUtc?: string;
  /** Sea events only: nearest province and its distance in km. */
  nearestProvinceSlug?: string | null;
  nearestProvinceKm?: number | null;
  zone?: "WIB" | "WITA" | "WIT";
  /** Event time in its zone with the label, e.g. "Senin, 2 November 2026 08:11:31 WIT" (formatZoned). */
  eventTimeText?: string;
  /** "Papua", "Perairan dekat Bali", "Laut/Perairan" (areaLabel). */
  areaLabel?: string;
}

function inProvince(event: AlertEvent, provinceSlug: string): boolean {
  if (event.provinceSlug === provinceSlug) return true;
  const km = event.nearestProvinceKm;
  return event.nearestProvinceSlug === provinceSlug && typeof km === "number" && km <= NEAR_SEA_MATCH_KM;
}

export function matchesSubscription(
  subscription: AlertSubscription,
  event: AlertEvent,
  distanceKm: number | null,
): boolean {
  if (event.magnitude < subscription.minMagnitude) return false;

  if (subscription.tsunamiOnly && event.tsunamiPotential !== true) {
    return false;
  }
  if (subscription.feltOnly && !event.feltText) {
    return false;
  }
  if (subscription.provinceSlug && !inProvince(event, subscription.provinceSlug)) {
    return false;
  }
  if (subscription.maxDistanceKm !== null) {
    if (distanceKm === null) return false;
    if (distanceKm > subscription.maxDistanceKm) return false;
  }
  return true;
}
