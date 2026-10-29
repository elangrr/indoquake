/** National coastline (Natural Earth 10m, public/geo/garis-pantai.json), loaded only once a user location exists. */
export interface CoastlineFile {
  source: string;
  bbox: { minLon: number; minLat: number; maxLon: number; maxLat: number };
  lines: number[][][];
}

export const COASTLINE_URL = "/geo/garis-pantai.json";

let pending: Promise<CoastlineFile | null> | null = null;

/** Fetches the coastline once per page; null when it cannot be loaded (callers then show no coast row). */
export function loadCoastline(): Promise<CoastlineFile | null> {
  pending ??= fetch(COASTLINE_URL)
    .then((response) => (response.ok ? (response.json() as Promise<CoastlineFile>) : null))
    .catch(() => null)
    .then((data) => {
      if (!data) pending = null; // allow a retry on the next location
      return data;
    });
  return pending;
}

/** Distance in km (one decimal) from a point to the nearest coastline segment, or null without data. */
export function distanceToCoastKm(latitude: number, longitude: number, coastline: CoastlineFile): number | null {
  if (coastline.lines.length === 0) return null;

  const kmPerDegLat = 110.574;
  const kmPerDegLon = 111.32 * Math.cos((latitude * Math.PI) / 180);
  let best = Infinity;

  for (const line of coastline.lines) {
    for (let index = 0; index < line.length - 1; index += 1) {
      const a = line[index];
      const b = line[index + 1];
      const ax = (a[0] - longitude) * kmPerDegLon;
      const ay = (a[1] - latitude) * kmPerDegLat;
      const bx = (b[0] - longitude) * kmPerDegLon;
      const by = (b[1] - latitude) * kmPerDegLat;

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
      const t = lengthSq > 0 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / lengthSq)) : 0;
      const distance = Math.hypot(ax + t * dx, ay + t * dy);
      if (distance < best) best = distance;
    }
  }

  return Number.isFinite(best) ? Math.round(best * 10) / 10 : null;
}
