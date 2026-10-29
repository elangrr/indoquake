// Geo size budgets (R137 SPEC section 5, DECISIONS D4). Caps are fixed here; never raise them (SPEC 5 STOP rules).
//   node scripts/check-geo-budget.mjs [--root <dir>]   exit 0 when every file is within its cap, 1 otherwise
// Sizes: raw bytes for (a), gzip (zlib level 6) bytes for (b), (c), (e). 1 kB = 1000 bytes.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const REPO = fileURLToPath(new URL("..", import.meta.url));
export const CAPS = {
  a: { label: "(a) lookup raw", bytes: 1_500_000 },
  b: { label: "(b) provinsi.json gzip", bytes: 150_000 },
  c: { label: "(c) provinsi/<slug>.json gzip", bytes: 60_000 },
  e: { label: "(e) garis-pantai.json gzip", bytes: 200_000 },
};

const rootIndex = process.argv.indexOf("--root");
const root = rootIndex > 0 ? process.argv[rootIndex + 1] : REPO;
const slugs = JSON.parse(readFileSync(join(REPO, "packages/regions/src/data/provinces-table.json"), "utf8")).provinces.map(
  (row) => row.slug,
);

const failures = [];
const kb = (bytes) => `${(bytes / 1000).toFixed(1)} kB`;
function measure(cap, relative, gzip) {
  const path = join(root, relative);
  if (!existsSync(path)) {
    failures.push(`${cap.label}: ${relative} tidak ada`);
    return null;
  }
  const raw = readFileSync(path);
  const size = gzip ? gzipSync(raw, { level: 6 }).length : raw.length;
  const ok = size <= cap.bytes;
  if (!ok) failures.push(`${cap.label}: ${relative} ${kb(size)} > ${kb(cap.bytes)}`);
  console.log(`${ok ? "OK  " : "FAIL"} ${cap.label} ${relative}: ${kb(size)} (cap ${kb(cap.bytes)})`);
  return raw;
}

const lookup = measure(CAPS.a, "packages/regions/src/data/provinces-lookup.json", false);
if (lookup) {
  const data = JSON.parse(lookup.toString("utf8"));
  const got = data.provinces.map((province) => province.slug);
  if (JSON.stringify(got) !== JSON.stringify(slugs)) failures.push("(a) lookup: slug tidak sama dengan tabel 38 provinsi");
  for (const province of data.provinces) {
    if (!(province.polygons?.length >= 1)) failures.push(`(a) lookup: ${province.slug} tanpa ring`);
  }
}
const display = measure(CAPS.b, "apps/web/public/geo/provinsi.json", true);
if (display) {
  const got = JSON.parse(display.toString("utf8")).features.map((feature) => feature.properties.slug);
  if (JSON.stringify(got) !== JSON.stringify(slugs)) failures.push("(b) provinsi.json: fitur tidak sama dengan tabel 38 provinsi");
}
let largest = 0;
for (const slug of slugs) {
  const path = join(root, `apps/web/public/geo/provinsi/${slug}.json`);
  const raw = existsSync(path) ? readFileSync(path) : null;
  if (!raw) {
    failures.push(`${CAPS.c.label}: provinsi/${slug}.json tidak ada`);
    continue;
  }
  const size = gzipSync(raw, { level: 6 }).length;
  if (size > largest) largest = size;
  if (size > CAPS.c.bytes) failures.push(`${CAPS.c.label}: provinsi/${slug}.json ${kb(size)} > ${kb(CAPS.c.bytes)}`);
}
console.log(`${largest <= CAPS.c.bytes ? "OK  " : "FAIL"} ${CAPS.c.label} largest of ${slugs.length}: ${kb(largest)} (cap ${kb(CAPS.c.bytes)})`);
measure(CAPS.e, "apps/web/public/geo/garis-pantai.json", true);

for (const failure of failures) console.error(`geo-budget FAIL ${failure}`);
console.log(failures.length === 0 ? "geo-budget OK" : `geo-budget FAIL (${failures.length})`);
process.exit(failures.length === 0 ? 0 : 1);
