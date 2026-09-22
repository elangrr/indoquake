export interface GeoPoint {
  latitude: number;
  longitude: number;
}

const EARTH_RADIUS_KM = 6371.0088;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function haversineKm(from: GeoPoint, to: GeoPoint): number {
  const dLat = toRadians(to.latitude - from.latitude);
  const dLon = toRadians(to.longitude - from.longitude);
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(to.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function hypocentralKm(horizontalKm: number, depthKm: number): number {
  return Math.hypot(horizontalKm, depthKm);
}
