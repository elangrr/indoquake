import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE =
  "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/IDN/ADM1/geoBoundaries-IDN-ADM1_simplified.geojson";

const TARGETS = [
  { shapeName: "Banten", slug: "banten", name: "Banten" },
  {
    shapeName: "Jakarta Special Capital Region",
    slug: "dki-jakarta",
    name: "DKI Jakarta",
  },
  { shapeName: "West Java", slug: "jawa-barat", name: "Jawa Barat" },
  { shapeName: "Central Java", slug: "jawa-tengah", name: "Jawa Tengah" },
  {
    shapeName: "Special Region of Yogyakarta",
    slug: "di-yogyakarta",
    name: "DI Yogyakarta",
  },
  { shapeName: "East Java", slug: "jawa-timur", name: "Jawa Timur" },
  { shapeName: "Bali", slug: "bali", name: "Bali" },
];

const OUTPUT = fileURLToPath(
  new URL("../packages/regions/src/data/java-provinces.json", import.meta.url),
);

function extractRings(geometry) {
  const rings = [];
  if (!geometry) return rings;
  if (geometry.type === "Polygon") {
    if (geometry.coordinates[0]) rings.push(geometry.coordinates[0]);
  } else if (geometry.type === "MultiPolygon") {
    for (const polygon of geometry.coordinates) {
      if (polygon[0]) rings.push(polygon[0]);
    }
  }
  return rings;
}

function cleanRing(ring) {
  const out = [];
  let previous = null;
  for (const [lon, lat] of ring) {
    const point = [Number(lon.toFixed(4)), Number(lat.toFixed(4))];
    if (previous && previous[0] === point[0] && previous[1] === point[1]) {
      continue;
    }
    out.push(point);
    previous = point;
  }
  return out.length >= 4 ? out : null;
}

function boundingCenter(rings) {
  const bbox = boundingBox(rings);
  return {
    latitude: Number(((bbox.minLat + bbox.maxLat) / 2).toFixed(4)),
    longitude: Number(((bbox.minLon + bbox.maxLon) / 2).toFixed(4)),
  };
}

function boundingBox(rings) {
  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;
  for (const ring of rings) {
    for (const [lon, lat] of ring) {
      if (lon < minLon) minLon = lon;
      if (lat < minLat) minLat = lat;
      if (lon > maxLon) maxLon = lon;
      if (lat > maxLat) maxLat = lat;
    }
  }
  return {
    minLat: Number(minLat.toFixed(4)),
    minLon: Number(minLon.toFixed(4)),
    maxLat: Number(maxLat.toFixed(4)),
    maxLon: Number(maxLon.toFixed(4)),
  };
}

const response = await fetch(SOURCE, { redirect: "follow" });
if (!response.ok) {
  throw new Error(`Gagal mengunduh sumber: HTTP ${response.status}`);
}
const geojson = await response.json();

const provinces = [];
for (const target of TARGETS) {
  const feature = geojson.features.find(
    (candidate) => candidate.properties?.shapeName === target.shapeName,
  );
  if (!feature) {
    console.warn(`Tidak ditemukan: ${target.shapeName}`);
    continue;
  }
  const rings = extractRings(feature.geometry)
    .map(cleanRing)
    .filter((ring) => ring !== null);
  const points = rings.reduce((sum, ring) => sum + ring.length, 0);
  provinces.push({
    slug: target.slug,
    name: target.name,
    center: boundingCenter(rings),
    bbox: boundingBox(rings),
    rings,
  });
  console.log(`${target.name.padEnd(16)} ring: ${rings.length} · titik: ${points}`);
}

mkdirSync(dirname(OUTPUT), { recursive: true });
writeFileSync(
  OUTPUT,
  JSON.stringify({
    source: "geoBoundaries IDN ADM1 (simplified) — CC BY 4.0",
    provinces,
  }),
);
console.log(`output: ${OUTPUT}`);
