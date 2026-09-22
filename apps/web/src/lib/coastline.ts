import coastlineData from "@/data/java-coastline.json";

interface CoastlineFile {
  source: string;
  bbox: { minLon: number; minLat: number; maxLon: number; maxLat: number };
  lines: number[][][];
}

const DATA = coastlineData as unknown as CoastlineFile;

export function distanceToCoastKm(
  latitude: number,
  longitude: number,
): number | null {
  if (DATA.lines.length === 0) return null;

  const kmPerDegLat = 110.574;
  const kmPerDegLon = 111.32 * Math.cos((latitude * Math.PI) / 180);
  let best = Infinity;

  for (const line of DATA.lines) {
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
      const t =
        lengthSq > 0
          ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / lengthSq))
          : 0;
      const px = ax + t * dx;
      const py = ay + t * dy;
      const distance = Math.hypot(px, py);
      if (distance < best) best = distance;
    }
  }

  return Number.isFinite(best) ? Math.round(best * 10) / 10 : null;
}
