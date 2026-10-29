// Builds the 38-province geometry (R137 P0, SPEC section 5, DECISIONS D2-D4, D21, D25).
//   node scripts/build-provinces.mjs --download     fetch the pinned geoBoundaries inputs into the raw dir
//   node scripts/build-provinces.mjs                build from the raw dir (sha256 checked against SHA256SUMS)
//   node scripts/build-provinces.mjs --input <dir> --out <dir>   build from other inputs (offline test fixture)
// Same input -> same bytes: no timestamps, fixed key order, fixed precision.
// Exits non-zero with a message naming the problem when any D21 check fails.
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import mapshaper from "mapshaper";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const CONFIG = JSON.parse(readFileSync(join(ROOT, "packages/regions/data-src/build-config.json"), "utf8"));
const TABLE = JSON.parse(readFileSync(join(ROOT, "packages/regions/src/data/provinces-table.json"), "utf8")).provinces;
const RAW_DIR = join(ROOT, "packages/regions/data-src/raw");
const SUMS = join(ROOT, "packages/regions/data-src/geo-inputs.SHA256SUMS");
const INPUTS = { adm1: "geoBoundaries-IDN-ADM1_simplified.geojson", adm2: "geoBoundaries-IDN-ADM2_simplified.geojson" };
export const OUTPUTS = {
  lookup: "packages/regions/src/data/provinces-lookup.json",
  meta: "packages/regions/src/data/provinces-meta.json",
  display: "apps/web/public/geo/provinsi.json",
  detailDir: "apps/web/public/geo/provinsi",
};

class BuildError extends Error {}
const fail = (message) => {
  throw new BuildError(message);
};

function parseArgs(argv) {
  const args = { download: false, input: null, out: ROOT, quiet: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--download") args.download = true;
    else if (arg === "--quiet") args.quiet = true;
    else if (arg === "--input") args.input = argv[++index];
    else if (arg === "--out") args.out = argv[++index];
    else fail(`argumen tidak dikenal: ${arg}`);
  }
  return args;
}

const sha256 = (buffer) => createHash("sha256").update(buffer).digest("hex");

async function download() {
  mkdirSync(RAW_DIR, { recursive: true });
  for (const key of ["adm1", "adm2"]) {
    const url = `${CONFIG.source.baseUrl}/${CONFIG.source[key]}`;
    const response = await fetch(url, { redirect: "follow" });
    if (!response.ok) fail(`unduhan gagal (HTTP ${response.status}): ${url}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    writeFileSync(join(RAW_DIR, INPUTS[key]), buffer);
    console.log(`${sha256(buffer)}  ${INPUTS[key]}`);
  }
}

function readInputs(dir, verify) {
  const sums = verify
    ? Object.fromEntries(
        readFileSync(SUMS, "utf8")
          .split("\n")
          .filter((line) => line.trim() !== "")
          .map((line) => line.trim().split(/\s+/).reverse()),
      )
    : {};
  const out = {};
  for (const [key, name] of Object.entries(INPUTS)) {
    const buffer = readFileSync(join(dir, name));
    if (verify && sums[name] !== sha256(buffer)) fail(`sha256 ${name} tidak sama dengan geo-inputs.SHA256SUMS`);
    out[key] = JSON.parse(buffer.toString("utf8"));
  }
  return out;
}

// ---- geometry helpers (lon/lat degrees) ----
const EARTH_KM = 6371.0088;
const rad = (degrees) => (degrees * Math.PI) / 180;

/** Spherical area of a ring in km2 (absolute). */
function ringAreaKm2(ring) {
  let sum = 0;
  for (let index = 0; index < ring.length - 1; index += 1) {
    const [lon1, lat1] = ring[index];
    const [lon2, lat2] = ring[index + 1];
    sum += rad(lon2 - lon1) * (2 + Math.sin(rad(lat1)) + Math.sin(rad(lat2)));
  }
  return Math.abs((sum * EARTH_KM * EARTH_KM) / 2);
}

const polygonsOf = (geometry) =>
  !geometry ? [] : geometry.type === "Polygon" ? [geometry.coordinates] : geometry.type === "MultiPolygon" ? geometry.coordinates : [];

function areaKm2(geometry) {
  return polygonsOf(geometry).reduce(
    (sum, [outer, ...holes]) => sum + ringAreaKm2(outer) - holes.reduce((h, ring) => h + ringAreaKm2(ring), 0),
    0,
  );
}

function pointInRing(lon, lat, ring) {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const [x1, y1] = ring[index];
    const [x2, y2] = ring[previous];
    if (y1 > lat !== y2 > lat && lon < ((x2 - x1) * (lat - y1)) / (y2 - y1) + x1) inside = !inside;
  }
  return inside;
}

/** polygons: [outer, ...holes][] ; inside an outer ring and in none of its holes. */
export function pointInPolygons(lon, lat, polygons) {
  return polygons.some(([outer, ...holes]) => pointInRing(lon, lat, outer) && !holes.some((hole) => pointInRing(lon, lat, hole)));
}

function bboxOf(polygons) {
  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;
  for (const polygon of polygons) {
    for (const [lon, lat] of polygon[0]) {
      if (lon < minLon) minLon = lon;
      if (lat < minLat) minLat = lat;
      if (lon > maxLon) maxLon = lon;
      if (lat > maxLat) maxLat = lat;
    }
  }
  const r = (value) => Number(value.toFixed(4));
  return { minLat: r(minLat), minLon: r(minLon), maxLat: r(maxLat), maxLon: r(maxLon) };
}

function roundRing(ring, decimals) {
  const clean = [];
  for (const [lon, lat] of ring) {
    const point = [Number(lon.toFixed(decimals)), Number(lat.toFixed(decimals))];
    const last = clean.at(-1);
    if (last && last[0] === point[0] && last[1] === point[1]) continue;
    clean.push(point);
  }
  return clean.length >= 4 ? clean : null;
}

/** Rounds every ring; a polygon whose outer ring collapses is dropped, a collapsed hole is dropped. */
function roundPolygons(polygons, decimals) {
  const out = [];
  for (const [outer, ...holes] of polygons) {
    const ring = roundRing(outer, decimals);
    if (!ring) continue;
    out.push([ring, ...holes.map((hole) => roundRing(hole, decimals)).filter((hole) => hole !== null)]);
  }
  return out;
}

// Max distance (km) from any source vertex to the simplified outline of the same province (grid index).
function maxDisplacementKm(sourcePolygons, simplePolygons) {
  const cell = 0.05;
  const grid = new Map();
  const key = (x, y) => `${x}:${y}`;
  for (const polygon of simplePolygons) {
    for (const ring of polygon) {
      for (let index = 0; index < ring.length - 1; index += 1) {
        const a = ring[index];
        const b = ring[index + 1];
        const x0 = Math.floor(Math.min(a[0], b[0]) / cell);
        const x1 = Math.floor(Math.max(a[0], b[0]) / cell);
        const y0 = Math.floor(Math.min(a[1], b[1]) / cell);
        const y1 = Math.floor(Math.max(a[1], b[1]) / cell);
        for (let x = x0; x <= x1; x += 1) {
          for (let y = y0; y <= y1; y += 1) {
            const k = key(x, y);
            if (!grid.has(k)) grid.set(k, []);
            grid.get(k).push([a, b]);
          }
        }
      }
    }
  }
  let worst = 0;
  for (const polygon of sourcePolygons) {
    for (const ring of polygon) {
      for (const [lon, lat] of ring) {
        const kx = 111.32 * Math.cos(rad(lat));
        const ky = 110.574;
        const cx = Math.floor(lon / cell);
        const cy = Math.floor(lat / cell);
        let best = Infinity;
        for (let radius = 0; radius <= 40 && best > Math.max(0, radius - 1) * cell * ky * 0.9; radius += 1) {
          for (let x = cx - radius; x <= cx + radius; x += 1) {
            for (let y = cy - radius; y <= cy + radius; y += 1) {
              if (Math.max(Math.abs(x - cx), Math.abs(y - cy)) !== radius) continue;
              for (const [a, b] of grid.get(key(x, y)) ?? []) {
                const ax = (a[0] - lon) * kx;
                const ay = (a[1] - lat) * ky;
                const dx = (b[0] - a[0]) * kx;
                const dy = (b[1] - a[1]) * ky;
                const lengthSq = dx * dx + dy * dy;
                const t = lengthSq > 0 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / lengthSq)) : 0;
                const distance = Math.hypot(ax + t * dx, ay + t * dy);
                if (distance < best) best = distance;
              }
            }
          }
        }
        if (best > worst) worst = best;
      }
    }
  }
  return worst;
}

/** Douglas-Peucker on one closed ring, tolerance in metres (local equirectangular). Keeps >= 3 distinct points. */
function simplifyRing(ring, toleranceM) {
  const n = ring.length - 1; // last point repeats the first
  if (n < 4) return ring.slice();
  const lat0 = rad(ring.reduce((sum, point) => sum + point[1], 0) / ring.length);
  const xy = ring.map(([lon, lat]) => [lon * 111_320 * Math.cos(lat0), lat * 110_574]);
  const distance = (index, from, to) => {
    const [px, py] = xy[index];
    const [ax, ay] = xy[from];
    const [bx, by] = xy[to];
    const dx = bx - ax;
    const dy = by - ay;
    const lengthSq = dx * dx + dy * dy;
    const t = lengthSq > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq)) : 0;
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  };
  let far = 1;
  for (let index = 1; index < n; index += 1) if (distance(index, 0, 0) > distance(far, 0, 0)) far = index;
  const keep = new Uint8Array(n + 1);
  keep[0] = 1;
  keep[far] = 1;
  keep[n] = 1;
  const stack = [[0, far], [far, n]];
  while (stack.length > 0) {
    const [from, to] = stack.pop();
    let best = -1;
    let bestDistance = toleranceM;
    for (let index = from + 1; index < to; index += 1) {
      const d = distance(index, from, to);
      if (d > bestDistance) {
        best = index;
        bestDistance = d;
      }
    }
    if (best >= 0) {
      keep[best] = 1;
      stack.push([from, best], [best, to]);
    }
  }
  if (keep.reduce((sum, value) => sum + value, 0) < 4) {
    let third = -1;
    for (let index = 1; index < n; index += 1) {
      if (index !== far && (third < 0 || distance(index, 0, far) > distance(third, 0, far))) third = index;
    }
    if (third > 0) keep[third] = 1;
  }
  return ring.filter((_, index) => keep[index] === 1);
}

const simplifyPolygons = (polygons, toleranceM) =>
  polygons.map((polygon) => polygon.map((ring) => simplifyRing(ring, toleranceM)));

async function mapshaperRun(commands, input) {
  const out = await mapshaper.applyCommands(`-i in.json ${commands} -o out.json format=geojson`, { "in.json": input });
  return JSON.parse(String(out["out.json"]));
}

const featureCollection = (features) => ({ type: "FeatureCollection", features });

export async function build({ input, out, quiet }) {
  const log = quiet ? () => {} : (line) => console.log(line);
  const verify = input === null;
  const { adm1, adm2 } = readInputs(input ?? RAW_DIR, verify);
  const replaced = new Set(CONFIG.adm1Replaced);
  const papuaSlugs = new Set(CONFIG.papua.map((group) => group.slug));
  const features = [];

  // 32 provinces from ADM1, matched by ISO 3166-2 code.
  const adm1Count = adm1.features.length;
  for (const row of TABLE) {
    if (papuaSlugs.has(row.slug)) continue;
    const matches = adm1.features.filter((feature) => feature.properties?.shapeISO === row.iso);
    if (matches.length === 0) fail(`provinsi ${row.slug} (${row.iso}) tidak ada di ADM1: jumlah provinsi akan 37, harus 38`);
    if (matches.length > 1) fail(`ADM1 ${row.iso} (${row.slug}) cocok dengan ${matches.length} fitur, harus 1`);
    features.push({ type: "Feature", properties: { slug: row.slug }, geometry: matches[0].geometry });
  }

  // Islands ADM1 lacks, appended as extra rings from ADM2 (Kepulauan Seribu -> dki-jakarta).
  for (const addition of CONFIG.adm2Added) {
    const feature = features.find((f) => f.properties.slug === addition.slug);
    for (const name of addition.regencies) {
      const matches = adm2.features.filter((f) => f.properties?.shapeName === name);
      if (matches.length !== 1) fail(`kabupaten/kota "${name}" (${addition.slug}) cocok dengan ${matches.length} fitur ADM2, harus 1`);
      feature.geometry = { type: "MultiPolygon", coordinates: [...polygonsOf(feature.geometry), ...polygonsOf(matches[0].geometry)] };
    }
  }

  // The 6 Papua-region provinces dissolved from 42 ADM2 regencies (UU 14, 15, 16, 29 of 2022).
  const used = new Set();
  const regencies = [];
  for (const group of CONFIG.papua) {
    for (const name of group.regencies) {
      const matches = adm2.features.filter((feature) => feature.properties?.shapeName === name);
      if (matches.length !== 1) fail(`kabupaten/kota "${name}" (${group.slug}) cocok dengan ${matches.length} fitur ADM2, harus 1`);
      used.add(matches[0].properties.shapeID ?? name);
      regencies.push({ type: "Feature", properties: { slug: group.slug }, geometry: matches[0].geometry });
    }
  }
  if (used.size !== 42) fail(`fitur ADM2 berbeda yang dipakai: ${used.size}, harus 42`);
  // One dissolve per province: a shared run would hand an overlap to one province and hide it from the check.
  const papuaBySlug = new Map();
  for (const slug of papuaSlugs) {
    const dissolved = await mapshaperRun("-dissolve2 slug", featureCollection(regencies.filter((f) => f.properties.slug === slug)));
    if (dissolved.features?.[0]) papuaBySlug.set(slug, dissolved.features[0]);
  }
  for (const slug of papuaSlugs) {
    const feature = papuaBySlug.get(slug);
    if (!feature || polygonsOf(feature.geometry).filter(([outer]) => outer.length >= 4).length === 0) {
      fail(`provinsi ${slug} tidak punya ring yang valid`);
    }
  }

  // D21: overlap among the 6, then dissolved area vs ADM1 Papua + Papua Barat.
  const adm1PapuaArea = adm1.features
    .filter((feature) => replaced.has(feature.properties?.shapeISO))
    .reduce((sum, feature) => sum + areaKm2(feature.geometry), 0);
  const papuaAreas = [...papuaSlugs].map((slug) => areaKm2(papuaBySlug.get(slug).geometry));
  const papuaSum = papuaAreas.reduce((sum, value) => sum + value, 0);
  const areaRatio = Math.abs(papuaSum - adm1PapuaArea) / adm1PapuaArea;
  const union = await mapshaperRun("-dissolve2 all", featureCollection(regencies.map((f) => ({ ...f, properties: { all: 1 } }))));
  const overlap = Math.max(0, papuaSum - areaKm2(union.features[0]?.geometry));
  const smallest = Math.min(...papuaAreas);
  if (!(overlap / smallest < CONFIG.checks.papuaOverlapMax)) {
    fail(`tumpang tindih antar provinsi Papua ${overlap.toFixed(1)} km2 >= 0,1% dari provinsi terkecil (${smallest.toFixed(0)} km2)`);
  }
  if (!(areaRatio <= CONFIG.checks.papuaAreaTolerance)) {
    fail(`luas 6 provinsi Papua ${papuaSum.toFixed(0)} km2 beda ${(areaRatio * 100).toFixed(2)}% dari ADM1 Papua + Papua Barat ${adm1PapuaArea.toFixed(0)} km2 (maks 2%)`);
  }
  for (const slug of papuaSlugs) features.push({ type: "Feature", properties: { slug }, geometry: papuaBySlug.get(slug).geometry });

  const order = new Map(TABLE.map((row, index) => [row.slug, index]));
  features.sort((a, b) => order.get(a.properties.slug) - order.get(b.properties.slug));
  if (features.length !== 38) fail(`jumlah provinsi ${features.length}, harus 38`);
  for (const feature of features) {
    if (polygonsOf(feature.geometry).length === 0) fail(`provinsi ${feature.properties.slug} tidak punya ring`);
  }

  // Three simplifications: Douglas-Peucker per ring (every ring keeps >= 3 points, so no island is dropped), then
  // fixed-decimal rounding. mapshaper's -simplify was not used: on this input it moved coast vertices > 3 km.
  const layer = async ({ intervalM, decimals }) => {
    const bySlug = new Map(
      features.map((feature) => [feature.properties.slug, roundPolygons(simplifyPolygons(polygonsOf(feature.geometry), intervalM), decimals)]),
    );
    for (const row of TABLE) {
      if (!bySlug.get(row.slug) || bySlug.get(row.slug).length === 0) fail(`provinsi ${row.slug} tidak punya ring setelah penyederhanaan`);
    }
    return bySlug;
  };
  const lookup = await layer(CONFIG.simplify.lookup);
  const display = await layer(CONFIG.simplify.display);
  const detail = await layer(CONFIG.simplify.detail);

  // D21: every city point lies in its own province and in no other (lookup geometry, no snapping).
  for (const [slug, [lat, lon]] of Object.entries(CONFIG.cityPoints)) {
    const hits = TABLE.filter((row) => pointInPolygons(lon, lat, lookup.get(row.slug))).map((row) => row.slug);
    if (hits.length !== 1 || hits[0] !== slug) fail(`titik kota ${slug} (${lat}, ${lon}) ada di [${hits.join(", ")}], harus hanya ${slug}`);
  }

  let displacement = 0;
  for (const feature of features) {
    const km = maxDisplacementKm(polygonsOf(feature.geometry), lookup.get(feature.properties.slug));
    if (km > displacement) displacement = km;
  }
  if (!(displacement <= CONFIG.checks.maxDisplacementKm)) fail(`pergeseran maks lapisan lookup ${displacement.toFixed(3)} km > 1 km (STOP SPEC 5)`);

  // Outputs.
  const source = CONFIG.source.release;
  const attribution = CONFIG.attribution;
  const write = (relative, value) => {
    const path = join(out, relative);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${JSON.stringify(value)}\n`);
  };
  write(OUTPUTS.lookup, {
    attribution,
    source,
    provinces: TABLE.map((row) => ({ slug: row.slug, bbox: bboxOf(lookup.get(row.slug)), polygons: lookup.get(row.slug) })),
  });
  write(OUTPUTS.meta, {
    attribution,
    source,
    provinces: Object.fromEntries(
      TABLE.map((row) => {
        const bbox = bboxOf(lookup.get(row.slug));
        const center = {
          latitude: Number(((bbox.minLat + bbox.maxLat) / 2).toFixed(4)),
          longitude: Number(((bbox.minLon + bbox.maxLon) / 2).toFixed(4)),
        };
        return [row.slug, { center, bbox }];
      }),
    ),
  });
  const geometry = (polygons) =>
    polygons.length === 1 ? { type: "Polygon", coordinates: polygons[0] } : { type: "MultiPolygon", coordinates: polygons };
  write(OUTPUTS.display, {
    type: "FeatureCollection",
    attribution,
    source,
    features: TABLE.map((row) => ({ type: "Feature", properties: { slug: row.slug }, geometry: geometry(display.get(row.slug)) })),
  });
  for (const row of TABLE) {
    write(`${OUTPUTS.detailDir}/${row.slug}.json`, {
      type: "Feature",
      attribution,
      source,
      properties: { slug: row.slug, name: row.name },
      geometry: geometry(detail.get(row.slug)),
    });
  }

  const report = {
    adm1Features: adm1Count,
    adm2FeaturesUsed: used.size,
    provinces: features.length,
    papuaAreaKm2: Math.round(papuaSum),
    adm1PapuaAreaKm2: Math.round(adm1PapuaArea),
    papuaAreaDiffPct: Number((areaRatio * 100).toFixed(3)),
    papuaOverlapKm2: Number(overlap.toFixed(3)),
    maxDisplacementKm: Number(displacement.toFixed(3)),
  };
  log(JSON.stringify(report));
  return report;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.download) await download();
    else await build(args);
  } catch (error) {
    if (error instanceof BuildError) {
      console.error(`build-provinces: ${error.message}`);
      process.exit(1);
    }
    throw error;
  }
}
