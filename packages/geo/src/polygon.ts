import type { GeoPoint } from "./distance";

export function pointInRing(point: GeoPoint, ring: number[][]): boolean {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const current = ring[index];
    const prior = ring[previous];
    const intersects =
      current[1] > point.latitude !== prior[1] > point.latitude &&
      point.longitude <
        ((prior[0] - current[0]) * (point.latitude - current[1])) /
          (prior[1] - current[1]) +
          current[0];
    if (intersects) inside = !inside;
  }
  return inside;
}

export function pointInRings(point: GeoPoint, rings: number[][][]): boolean {
  return rings.some((ring) => pointInRing(point, ring));
}

export function distanceToRingKm(point: GeoPoint, ring: number[][]): number {
  const kmPerDegLat = 110.574;
  const kmPerDegLon = 111.32 * Math.cos((point.latitude * Math.PI) / 180);
  let best = Infinity;

  for (let index = 0; index < ring.length - 1; index += 1) {
    const a = ring[index];
    const b = ring[index + 1];
    const ax = (a[0] - point.longitude) * kmPerDegLon;
    const ay = (a[1] - point.latitude) * kmPerDegLat;
    const bx = (b[0] - point.longitude) * kmPerDegLon;
    const by = (b[1] - point.latitude) * kmPerDegLat;

    const minX = ax < bx ? ax : bx;
    const maxX = ax < bx ? bx : ax;
    const minY = ay < by ? ay : by;
    const maxY = ay < by ? by : ay;
    const dxBox = minX > 0 ? minX : maxX < 0 ? -maxX : 0;
    const dyBox = minY > 0 ? minY : maxY < 0 ? -maxY : 0;
    if (dxBox * dxBox + dyBox * dyBox >= best * best) continue;

    const dx = bx - ax;
    const dy = by - ay;
    const lengthSq = dx * dx + dy * dy;
    const t =
      lengthSq > 0 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / lengthSq)) : 0;
    const distance = Math.hypot(ax + t * dx, ay + t * dy);
    if (distance < best) best = distance;
  }

  return Number.isFinite(best) ? best : Infinity;
}

export function minDistanceToRingsKm(
  point: GeoPoint,
  rings: number[][][],
): number {
  let best = Infinity;
  for (const ring of rings) {
    const distance = distanceToRingKm(point, ring);
    if (distance < best) best = distance;
  }
  return best;
}
