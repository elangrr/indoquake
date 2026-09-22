import { describe, expect, it } from "vitest";
import {
  PROVINCE_OPTIONS,
  provinceBySlug,
  resolveProvince,
} from "../src/provinces";

describe("resolveProvince dengan data nyata", () => {
  const cases: [string, number, number][] = [
    ["banten", -6.1104, 106.1503],
    ["dki-jakarta", -6.1862, 106.834],
    ["jawa-barat", -6.9175, 107.6191],
    ["jawa-tengah", -6.9667, 110.4167],
    ["di-yogyakarta", -7.7956, 110.3695],
    ["jawa-timur", -7.2575, 112.7521],
    ["bali", -8.6705, 115.2126],
  ];

  for (const [slug, latitude, longitude] of cases) {
    it(`memetakan koordinat ${slug}`, () => {
      const resolution = resolveProvince(latitude, longitude);
      expect(resolution?.province.slug).toBe(slug);
      expect(resolution?.method).toBe("inside");
    });
  }

  it("memetakan gempa lepas pantai ke provinsi terdekat", () => {
    const resolution = resolveProvince(-9.5, 110.0, 250);
    expect(resolution?.method).toBe("nearest");
    expect(resolution?.distanceKm).toBeGreaterThan(0);
    expect(resolution?.distanceKm).toBeLessThanOrEqual(250);
  });

  it("mengembalikan null untuk lokasi yang sangat jauh", () => {
    expect(resolveProvince(0, 0, 250)).toBeNull();
  });

  it("menyediakan opsi provinsi lengkap", () => {
    expect(PROVINCE_OPTIONS).toHaveLength(7);
    expect(provinceBySlug("jawa-timur")?.name).toBe("Jawa Timur");
    expect(provinceBySlug("tidak-ada")).toBeNull();
  });
});
