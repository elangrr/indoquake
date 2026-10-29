// Writes the small offline generator fixture (geoBoundaries-shaped ADM1 + ADM2) next to this file:
// 0.1 degree squares around each province's city point; the 42 Papua regencies sit in a row west of their
// province's city point, and ADM1 Papua / Papua Barat are made of the same squares (equal area, no overlap).
//   node scripts/test/fixtures/geo/make-fixture.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../../../../", import.meta.url));
const HERE = fileURLToPath(new URL(".", import.meta.url));
const config = JSON.parse(readFileSync(`${ROOT}packages/regions/data-src/build-config.json`, "utf8"));
const table = JSON.parse(readFileSync(`${ROOT}packages/regions/src/data/provinces-table.json`, "utf8")).provinces;
// City points for the 8 provinces SPEC section 6 does not list (fixture only).
const EXTRA = {
  riau: [0.5071, 101.4478],
  "kepulauan-riau": [0.9186, 104.4554],
  jambi: [-1.6101, 103.6131],
  "kepulauan-bangka-belitung": [-2.1316, 106.1169],
  bengkulu: [-3.7928, 102.2608],
  "kalimantan-utara": [2.8375, 117.3653],
  gorontalo: [0.5435, 123.0568],
  "sulawesi-barat": [-2.6748, 118.8885],
};
const square = (lat, lon) => {
  const r = (value) => Number(value.toFixed(4));
  const [s, n, w, e] = [r(lat - 0.05), r(lat + 0.05), r(lon - 0.05), r(lon + 0.05)];
  return [[[w, s], [e, s], [e, n], [w, n], [w, s]]];
};
const papua = new Set(config.papua.map((group) => group.slug));
const adm1 = [];
for (const row of table) {
  if (papua.has(row.slug)) continue;
  const [lat, lon] = config.cityPoints[row.slug] ?? EXTRA[row.slug];
  adm1.push({ type: "Feature", properties: { shapeName: row.name, shapeISO: row.iso, shapeType: "ADM1" }, geometry: { type: "Polygon", coordinates: square(lat, lon) } });
}
const adm2 = [{ type: "Feature", properties: { shapeName: "Aceh Barat", shapeID: "FIX-0", shapeType: "ADM2" }, geometry: { type: "Polygon", coordinates: square(4.2, 96.1) } }];
const papuaSquares = { "ID-PA": [], "ID-PB": [] };
for (const group of config.papua) {
  const [lat, lon] = config.cityPoints[group.slug];
  group.regencies.forEach((name, index) => {
    const polygon = square(lat, lon - index * 0.1);
    adm2.push({ type: "Feature", properties: { shapeName: name, shapeID: `FIX-${adm2.length}`, shapeType: "ADM2" }, geometry: { type: "Polygon", coordinates: polygon } });
    papuaSquares[group.slug === "papua-barat" || group.slug === "papua-barat-daya" ? "ID-PB" : "ID-PA"].push(polygon);
  });
}
// Kepulauan Seribu (ADM2), appended to dki-jakarta by the generator: a square around Pulau Pramuka.
adm2.push({ type: "Feature", properties: { shapeName: "Kepulauan Seribu", shapeID: `FIX-${adm2.length}`, shapeType: "ADM2" }, geometry: { type: "Polygon", coordinates: square(-5.7453, 106.6136) } });
adm1.push({ type: "Feature", properties: { shapeName: "Papua", shapeISO: "ID-PA", shapeType: "ADM1" }, geometry: { type: "MultiPolygon", coordinates: papuaSquares["ID-PA"] } });
adm1.push({ type: "Feature", properties: { shapeName: "West Papua", shapeISO: "ID-PB", shapeType: "ADM1" }, geometry: { type: "MultiPolygon", coordinates: papuaSquares["ID-PB"] } });
writeFileSync(`${HERE}geoBoundaries-IDN-ADM1_simplified.geojson`, `${JSON.stringify({ type: "FeatureCollection", features: adm1 })}\n`);
writeFileSync(`${HERE}geoBoundaries-IDN-ADM2_simplified.geojson`, `${JSON.stringify({ type: "FeatureCollection", features: adm2 })}\n`);
console.log(`ADM1 ${adm1.length} fitur, ADM2 ${adm2.length} fitur`);
