// AC 9, 10, 12, D25: the committed generated geo files and their documentation.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { INDONESIA_BOUNDS, PROVINCE_OPTIONS, provinceBySlug } from "@indoquake/regions/meta";

const REPO = join(import.meta.dirname, "..", "..", "..");
const read = (relative: string) => readFileSync(join(REPO, relative), "utf8");
const json = (relative: string) => JSON.parse(read(relative)) as Record<string, unknown>;
const SLUGS = PROVINCE_OPTIONS.map((province) => province.slug);
const ATTRIBUTION = { attribution: "geoBoundaries (CC BY 4.0)", source: "geoBoundaries gbOpen IDN, commit 9469f09592ced973a3448cf66b6100b741b64c0d" };

interface LookupFile {
  provinces: { slug: string; polygons: number[][][][] }[];
}
interface FeatureFile {
  type: string;
  properties: { slug: string };
  geometry: { type: string };
}

describe("lookup and meta data (AC 9)", () => {
  const lookup = json("packages/regions/src/data/provinces-lookup.json") as unknown as LookupFile;

  it("has exactly the 38 slugs in table order, each with at least one polygon ring", () => {
    expect(lookup.provinces.map((province) => province.slug)).toEqual(SLUGS);
    expect(lookup.provinces.filter((province) => province.polygons.length === 0 || province.polygons[0][0].length < 4)).toEqual([]);
  });

  it("is at most 1.5 MB raw", () => {
    expect(read("packages/regions/src/data/provinces-lookup.json").length).toBeLessThanOrEqual(1_500_000);
  });

  it.each(SLUGS)("puts the bbox of %s inside INDONESIA_BOUNDS +/- 1 degree", (slug) => {
    const { bbox } = provinceBySlug(slug)!;
    expect(bbox.minLat).toBeGreaterThanOrEqual(INDONESIA_BOUNDS.south - 1);
    expect(bbox.maxLat).toBeLessThanOrEqual(INDONESIA_BOUNDS.north + 1);
    expect(bbox.minLon).toBeGreaterThanOrEqual(INDONESIA_BOUNDS.west - 1);
    expect(bbox.maxLon).toBeLessThanOrEqual(INDONESIA_BOUNDS.east + 1);
  });

  it("gives Papua Barat Daya a center and a bbox that holds Sorong", () => {
    const province = provinceBySlug("papua-barat-daya")!;
    expect(province.bbox.minLat).toBeLessThan(-0.8762);
    expect(province.bbox.maxLat).toBeGreaterThan(-0.8762);
    expect(province.bbox.minLon).toBeLessThan(131.2558);
    expect(province.bbox.maxLon).toBeGreaterThan(131.2558);
    expect(province.center).toEqual({ latitude: expect.any(Number), longitude: expect.any(Number) });
  });

  it.each(["packages/regions/src/data/provinces-lookup.json", "packages/regions/src/data/provinces-meta.json"])(
    "%s carries the geoBoundaries attribution and release (D25)",
    (relative) => {
      expect(json(relative)).toMatchObject(ATTRIBUTION);
    },
  );
});

describe("public geo files (AC 10)", () => {
  it("provinsi.json is a FeatureCollection of the 38 slugs with attribution", () => {
    const file = json("apps/web/public/geo/provinsi.json") as { type: string; features: FeatureFile[] };
    expect(file).toMatchObject({ type: "FeatureCollection", ...ATTRIBUTION });
    expect(file.features.map((feature) => feature.properties.slug)).toEqual(SLUGS);
  });

  it.each(SLUGS)("provinsi/%s.json is one Feature of that province with attribution", (slug) => {
    const feature = json(`apps/web/public/geo/provinsi/${slug}.json`) as unknown as FeatureFile;
    expect(feature).toMatchObject({ type: "Feature", properties: { slug }, ...ATTRIBUTION });
    expect(["Polygon", "MultiPolygon"]).toContain(feature.geometry.type);
  });

  it("garis-pantai.json keeps the {source, bbox, lines} shape of the old coastline", () => {
    const file = json("apps/web/public/geo/garis-pantai.json") as { source: string; bbox: object; lines: unknown[] };
    expect(Object.keys(file)).toEqual(["source", "bbox", "lines"]);
    expect(file.bbox).toEqual({ minLon: 94.4, minLat: -11.6, maxLon: 141.6, maxLat: 6.7 });
    expect(file.lines.length).toBeGreaterThan(100);
  });

});

describe("DATA_SOURCES.md (AC 12)", () => {
  const doc = read("docs/DATA_SOURCES.md");
  const sums = read("packages/regions/data-src/geo-inputs.SHA256SUMS");

  it.each([
    ["geoBoundaries-IDN-ADM1_simplified.geojson", "5a6be3d14841"],
    ["geoBoundaries-IDN-ADM2_simplified.geojson", "146653d48833"],
    ["ne_10m_coastline.geojson", "6f75ae0e0de1"],
  ])("documents %s with sha256 prefix %s, equal to SHA256SUMS", (name, prefix) => {
    expect(sums).toContain(`${prefix}`);
    expect(sums.split("\n").find((line) => line.endsWith(`  ${name}`))?.slice(0, 12)).toBe(prefix);
    const row = doc.split("\n").find((line) => line.startsWith(`| ${name} |`));
    expect(row).toContain(`| ${prefix} |`);
    expect(row).toContain("| 29-10-2026 |");
  });

  it("states CC BY 4.0, the release, the measured displacement and SNAP_KM", () => {
    expect(doc).toContain("geoBoundaries CC BY 4.0");
    expect(doc).toContain("commit 9469f09592ced973a3448cf66b6100b741b64c0d");
    expect(doc).toContain("Pergeseran maksimum lapisan lookup terhadap input geoBoundaries: 0,205 km");
    expect(doc).toContain("SNAP_KM = 2");
    expect(doc).toContain("### Display vs lookup geometry");
  });
});
