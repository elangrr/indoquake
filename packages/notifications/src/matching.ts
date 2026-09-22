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
  provinceSlug: string | null;
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
  if (
    subscription.provinceSlug &&
    event.provinceSlug !== subscription.provinceSlug
  ) {
    return false;
  }
  if (subscription.maxDistanceKm !== null) {
    if (distanceKm === null) return false;
    if (distanceKm > subscription.maxDistanceKm) return false;
  }
  return true;
}
