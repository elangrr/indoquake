// National coastline for the web distance-to-coast estimate (R137 P0, SPEC section 5 budget (e)).
//   node scripts/build-coastline.mjs --download   fetch the pinned Natural Earth file into the raw dir
//   node scripts/build-coastline.mjs              build apps/web/public/geo/garis-pantai.json from it
// Output shape {source, bbox, lines} is the same as the old Java file, so the distance routine ports unchanged.
// Same input -> same bytes.
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const COMMIT = "f1890d9f152c896d250a77557a5751a93d494776"; // natural-earth-vector tag v5.1.2
const SOURCE = `https://raw.githubusercontent.com/nvkelso/natural-earth-vector/${COMMIT}/geojson/ne_10m_coastline.geojson`;
const INPUT = join(ROOT, "packages/regions/data-src/raw/ne_10m_coastline.geojson");
const SUMS = join(ROOT, "packages/regions/data-src/geo-inputs.SHA256SUMS");
const OUTPUT = join(ROOT, "apps/web/public/geo/garis-pantai.json");
// INDONESIA_BOUNDS (packages/regions meta) plus a 0.5 degree margin.
const BBOX = { minLon: 94.4, minLat: -11.6, maxLon: 141.6, maxLat: 6.7 };
const TOLERANCE_DEG = 0.005;
const DECIMALS = 4;

const sha256 = (buffer) => createHash("sha256").update(buffer).digest("hex");

function clipLine(coordinates) {
  const segments = [];
  let current = [];
  for (const [lon, lat] of coordinates) {
    const inside = lon >= BBOX.minLon && lon <= BBOX.maxLon && lat >= BBOX.minLat && lat <= BBOX.maxLat;
    if (inside) {
      current.push([lon, lat]);
    } else if (current.length > 0) {
      if (current.length >= 2) segments.push(current);
      current = [];
    }
  }
  if (current.length >= 2) segments.push(current);
  return segments;
}

/** Douglas-Peucker on an open line, planar degrees. */
function simplifyLine(line) {
  const keep = new Uint8Array(line.length);
  keep[0] = 1;
  keep[line.length - 1] = 1;
  const stack = [[0, line.length - 1]];
  while (stack.length > 0) {
    const [from, to] = stack.pop();
    const [ax, ay] = line[from];
    const [bx, by] = line[to];
    const dx = bx - ax;
    const dy = by - ay;
    const lengthSq = dx * dx + dy * dy;
    let best = -1;
    let bestDistance = TOLERANCE_DEG;
    for (let index = from + 1; index < to; index += 1) {
      const [px, py] = line[index];
      const t = lengthSq > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq)) : 0;
      const distance = Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
      if (distance > bestDistance) {
        best = index;
        bestDistance = distance;
      }
    }
    if (best >= 0) {
      keep[best] = 1;
      stack.push([from, best], [best, to]);
    }
  }
  const out = [];
  for (let index = 0; index < line.length; index += 1) {
    if (!keep[index]) continue;
    const point = [Number(line[index][0].toFixed(DECIMALS)), Number(line[index][1].toFixed(DECIMALS))];
    const last = out.at(-1);
    if (last && last[0] === point[0] && last[1] === point[1]) continue;
    out.push(point);
  }
  return out;
}

if (process.argv.includes("--download")) {
  const response = await fetch(SOURCE);
  if (!response.ok) throw new Error(`Gagal mengunduh sumber: HTTP ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  mkdirSync(dirname(INPUT), { recursive: true });
  writeFileSync(INPUT, buffer);
  console.log(`${sha256(buffer)}  ne_10m_coastline.geojson`);
  process.exit(0);
}

const buffer = readFileSync(INPUT);
const expected = readFileSync(SUMS, "utf8")
  .split("\n")
  .map((line) => line.trim().split(/\s+/))
  .find(([, name]) => name === "ne_10m_coastline.geojson")?.[0];
if (expected !== sha256(buffer)) {
  console.error("build-coastline: sha256 ne_10m_coastline.geojson tidak sama dengan geo-inputs.SHA256SUMS");
  process.exit(1);
}
const geojson = JSON.parse(buffer.toString("utf8"));
const lines = [];
for (const feature of geojson.features) {
  const geometry = feature.geometry;
  if (!geometry) continue;
  const parts = geometry.type === "LineString" ? [geometry.coordinates] : geometry.type === "MultiLineString" ? geometry.coordinates : [];
  for (const part of parts) {
    for (const segment of clipLine(part)) {
      const simple = simplifyLine(segment);
      if (simple.length >= 2) lines.push(simple);
    }
  }
}
const output = {
  source: `Natural Earth 10m coastline v5.1.2 (${COMMIT.slice(0, 7)}), public domain`,
  bbox: BBOX,
  lines,
};
mkdirSync(dirname(OUTPUT), { recursive: true });
writeFileSync(OUTPUT, `${JSON.stringify(output)}\n`);
const points = lines.reduce((sum, line) => sum + line.length, 0);
console.log(`segmen: ${lines.length} · titik: ${points} · output: ${OUTPUT}`);
