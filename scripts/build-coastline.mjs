import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_coastline.geojson";

const BBOX = { minLon: 104, minLat: -11.5, maxLon: 117.5, maxLat: -4 };

const OUTPUT = fileURLToPath(
  new URL("../apps/web/src/data/java-coastline.json", import.meta.url),
);

function clipLine(coordinates) {
  const segments = [];
  let current = [];
  for (const [lon, lat] of coordinates) {
    const inside =
      lon >= BBOX.minLon &&
      lon <= BBOX.maxLon &&
      lat >= BBOX.minLat &&
      lat <= BBOX.maxLat;
    if (inside) {
      current.push([Number(lon.toFixed(4)), Number(lat.toFixed(4))]);
    } else if (current.length > 0) {
      if (current.length >= 2) segments.push(current);
      current = [];
    }
  }
  if (current.length >= 2) segments.push(current);
  return segments;
}

const response = await fetch(SOURCE);
if (!response.ok) {
  throw new Error(`Gagal mengunduh sumber: HTTP ${response.status}`);
}
const geojson = await response.json();

const lines = [];
for (const feature of geojson.features) {
  const geometry = feature.geometry;
  if (!geometry) continue;
  if (geometry.type === "LineString") {
    lines.push(...clipLine(geometry.coordinates));
  } else if (geometry.type === "MultiLineString") {
    for (const part of geometry.coordinates) {
      lines.push(...clipLine(part));
    }
  }
}

const totalPoints = lines.reduce((sum, line) => sum + line.length, 0);

const output = {
  source: "Natural Earth 10m coastline (public domain)",
  bbox: BBOX,
  lines,
};

mkdirSync(dirname(OUTPUT), { recursive: true });
writeFileSync(OUTPUT, JSON.stringify(output));

console.log(
  `segmen: ${lines.length} · titik: ${totalPoints} · output: ${OUTPUT}`,
);
