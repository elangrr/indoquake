import fc from "fast-check";
import { provinceBySlug } from "@indoquake/regions/meta";
import { describe, expect, it } from "vitest";
import { MAX_DETAIL, provincesInView } from "./province-layer";

const RUNS = { seed: 137, numRuns: 100 };

// Views inside and around INDONESIA_BOUNDS (south -11.1, west 94.9, north 6.2, east 141.1).
const lat = fc.double({ min: -13, max: 8, noNaN: true });
const lon = fc.double({ min: 92, max: 143, noNaN: true });
const view = fc
  .tuple(lat, lat, lon, lon)
  .map(([a, b, c, d]) => ({ south: Math.min(a, b), north: Math.max(a, b), west: Math.min(c, d), east: Math.max(c, d) }));

function bboxOf(slug: string) {
  const meta = provinceBySlug(slug);
  if (!meta) throw new Error(`unknown province ${slug}`);
  return meta.bbox;
}

describe("provincesInView (AC 29)", () => {
  it("returns a view over Bali with bali in it", () => {
    expect(provincesInView({ south: -8.9, west: 114.4, north: -8.0, east: 115.7 })).toContain("bali");
  });

  it("returns at most MAX_DETAIL slugs without duplicates", () => {
    fc.assert(
      fc.property(view, (v) => {
        const slugs = provincesInView(v);
        expect(slugs.length).toBeLessThanOrEqual(MAX_DETAIL);
        expect(new Set(slugs).size).toBe(slugs.length);
      }),
      RUNS,
    );
  });

  it("returns only provinces whose bbox meets the view", () => {
    fc.assert(
      fc.property(view, (v) => {
        for (const slug of provincesInView(v)) {
          const box = bboxOf(slug);
          expect(box.maxLat).toBeGreaterThanOrEqual(v.south);
          expect(box.minLat).toBeLessThanOrEqual(v.north);
          expect(box.maxLon).toBeGreaterThanOrEqual(v.west);
          expect(box.minLon).toBeLessThanOrEqual(v.east);
        }
      }),
      RUNS,
    );
  });

  it("orders the result by distance from the view centre to the bbox, nearest first", () => {
    fc.assert(
      fc.property(view, (v) => {
        const centerLat = (v.south + v.north) / 2;
        const centerLon = (v.west + v.east) / 2;
        const distances = provincesInView(v).map((slug) => {
          const box = bboxOf(slug);
          const nearLat = Math.max(box.minLat, Math.min(centerLat, box.maxLat));
          const nearLon = Math.max(box.minLon, Math.min(centerLon, box.maxLon));
          return Math.hypot(nearLat - centerLat, nearLon - centerLon);
        });
        expect(distances).toEqual([...distances].sort((a, b) => a - b));
      }),
      RUNS,
    );
  });
});
