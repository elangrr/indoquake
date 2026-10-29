// AC 5-7 and D22: province assignment on the real national lookup data.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  type AreaAssignment,
  areaLabel,
  assignArea,
  describeLocation,
  provinceBySlug,
  resolveProvince,
  zoneOfEvent,
  zoneOfProvince,
} from "@indoquake/regions";

describe("assignArea: city centres are land (AC 5)", () => {
  it.each([
    ["Banda Aceh", 5.5483, 95.3238, "aceh"],
    ["Medan", 3.5952, 98.6722, "sumatera-utara"],
    ["Padang", -0.9471, 100.4172, "sumatera-barat"],
    ["Pekanbaru", 0.5071, 101.4478, "riau"],
    ["Tanjung Pinang", 0.9186, 104.4554, "kepulauan-riau"],
    ["Jambi", -1.6101, 103.6131, "jambi"],
    ["Palembang", -2.9761, 104.7754, "sumatera-selatan"],
    ["Pangkalpinang", -2.1316, 106.1169, "kepulauan-bangka-belitung"],
    ["Bengkulu", -3.7928, 102.2608, "bengkulu"],
    ["Bandar Lampung", -5.4292, 105.261, "lampung"],
    ["Serang", -6.1104, 106.1503, "banten"],
    ["Jakarta", -6.1862, 106.834, "dki-jakarta"],
    ["Bandung", -6.9175, 107.6191, "jawa-barat"],
    ["Semarang", -6.9667, 110.4167, "jawa-tengah"],
    ["Yogyakarta", -7.7956, 110.3695, "di-yogyakarta"],
    ["Surabaya", -7.2575, 112.7521, "jawa-timur"],
    ["Denpasar", -8.6705, 115.2126, "bali"],
    ["Mataram", -8.5833, 116.1167, "nusa-tenggara-barat"],
    ["Kupang", -10.1772, 123.607, "nusa-tenggara-timur"],
    ["Pontianak", -0.0263, 109.3425, "kalimantan-barat"],
    ["Palangka Raya", -2.2161, 113.9135, "kalimantan-tengah"],
    ["Banjarmasin", -3.3194, 114.5908, "kalimantan-selatan"],
    ["Samarinda", -0.5022, 117.1536, "kalimantan-timur"],
    ["Tanjung Selor", 2.8375, 117.3653, "kalimantan-utara"],
    ["Manado", 1.4748, 124.8421, "sulawesi-utara"],
    ["Gorontalo", 0.5435, 123.0568, "gorontalo"],
    ["Palu", -0.8917, 119.8707, "sulawesi-tengah"],
    ["Mamuju", -2.6748, 118.8885, "sulawesi-barat"],
    ["Makassar", -5.1477, 119.4327, "sulawesi-selatan"],
    ["Kendari", -3.9985, 122.5129, "sulawesi-tenggara"],
    ["Ambon", -3.6954, 128.1814, "maluku"],
    ["Ternate", 0.7898, 127.3764, "maluku-utara"],
    ["Jayapura", -2.5337, 140.7181, "papua"],
    ["Manokwari", -0.8615, 134.062, "papua-barat"],
    ["Merauke", -8.4932, 140.4018, "papua-selatan"],
    ["Timika", -4.5469, 136.8837, "papua-tengah"],
    ["Wamena", -4.0956, 138.9459, "papua-pegunungan"],
    ["Sorong", -0.8762, 131.2558, "papua-barat-daya"],
  ])("%s (%f, %f) is land in %s, not snapped", (_city, latitude, longitude, slug) => {
    expect(assignArea(latitude, longitude)).toEqual({ kind: "land", provinceSlug: slug, snapped: false });
  });

  it("a point exactly on a coast vertex of Bali is land", () => {
    expect(assignArea(-8.4962, 114.9525)).toMatchObject({ kind: "land", provinceSlug: "bali" });
  });

  it("Pulau Pramuka (Kepulauan Seribu, from ADM2) is land of DKI Jakarta, snapped to its simplified ring", () => {
    expect(assignArea(-5.7453, 106.6136)).toEqual({ kind: "land", provinceSlug: "dki-jakarta", snapped: true });
  });
});

describe("assignArea: coast snap, sea and invalid input (AC 6)", () => {
  it("1 km off the Gunungkidul coast is land of DI Yogyakarta, snapped", () => {
    expect(assignArea(-8.1553, 110.6)).toEqual({ kind: "land", provinceSlug: "di-yogyakarta", snapped: true });
  });

  it("3 km off the same coast, same bearing, is sea", () => {
    expect(assignArea(-8.1733, 110.6)).toEqual({ kind: "sea", nearestProvinceSlug: "di-yogyakarta", nearestProvinceKm: 3 });
  });

  it("the Indian Ocean south of Java is sea 100-250 km from a central Java province", () => {
    const area = assignArea(-9.5, 110.0);
    expect(area?.kind).toBe("sea");
    const sea = area as Extract<AreaAssignment, { kind: "sea" }>;
    expect(["jawa-tengah", "di-yogyakarta", "jawa-timur"]).toContain(sea.nearestProvinceSlug);
    expect(sea.nearestProvinceKm).toBeGreaterThanOrEqual(100);
    expect(sea.nearestProvinceKm).toBeLessThanOrEqual(250);
    const nearestProvinceName = provinceBySlug(sea.nearestProvinceSlug)!.name;
    expect(areaLabel({ areaKind: "sea", nearestProvinceName, nearestProvinceKm: sea.nearestProvinceKm })).toBe(
      "Perairan dekat DI Yogyakarta",
    );
  });

  it.each([
    ["Banda Sea", -5.5, 129.0, "maluku", 127, "Perairan dekat Maluku"],
    ["Selat Makassar", -1.0, 118.0, "kalimantan-timur", 50, "Perairan dekat Kalimantan Timur"],
    ["Selat Malaka", 2.5, 101.0, "riau", 21, "Perairan dekat Riau"],
    ["far Indian Ocean", -20, 100, "banten", 1546, "Laut/Perairan"],
  ])("%s is sea near %s at %i km, labelled %s", (_name, latitude, longitude, slug, km, label) => {
    expect(assignArea(latitude, longitude)).toEqual({ kind: "sea", nearestProvinceSlug: slug, nearestProvinceKm: km });
    expect(describeLocation(latitude, longitude)).toMatchObject({ nearestProvinceSlug: slug });
    expect(areaLabel({ areaKind: "sea", ...describeLocation(latitude, longitude) })).toBe(label);
  });

  it.each([
    ["NaN latitude", Number.NaN, 110],
    ["infinite longitude", -7, Number.POSITIVE_INFINITY],
    ["latitude 91", 91, 110],
    ["latitude and longitude swapped", 110, -7],
  ])("returns null for %s", (_name, latitude, longitude) => {
    expect(assignArea(latitude, longitude)).toBeNull();
  });

  it("is total and deterministic over the Indonesia box", () => {
    fc.assert(
      fc.property(
        fc.double({ min: -12, max: 7, noNaN: true }),
        fc.double({ min: 94, max: 142, noNaN: true }),
        (latitude, longitude) => {
          const first = assignArea(latitude, longitude);
          expect(first).not.toBeNull();
          expect(assignArea(latitude, longitude)).toEqual(first);
        },
      ),
      { seed: 137, numRuns: 100 },
    );
  });
});

describe("foreign land falls back to sea with the nearest province (D22)", () => {
  it.each([
    ["Dili", -8.5569, 125.5603, "nusa-tenggara-timur", 53, "WITA"],
    ["Kota Kinabalu", 5.9804, 116.0735, "kalimantan-utara", 176, "WITA"],
    ["Davao", 7.0731, 125.6128, "sulawesi-utara", 198, "WITA"],
    ["far sea", -20, 100, "banten", 1546, "WIB"],
  ])("%s is sea near %s (%i km), zone %s, the same on every call", (_name, latitude, longitude, slug, km, zone) => {
    const expected = { kind: "sea", nearestProvinceSlug: slug, nearestProvinceKm: km };
    expect([assignArea(latitude, longitude), assignArea(latitude, longitude)]).toEqual([expected, expected]);
    expect(zoneOfEvent({ provinceSlug: null, nearestProvinceSlug: slug })).toBe(zone);
    expect(zoneOfProvince(slug)).toBe(zone);
  });
});

describe("describeLocation", () => {
  it("describes Jayapura as land in Papua, zone WIT", () => {
    expect(describeLocation(-2.5337, 140.7181)).toEqual({
      latitude: -2.5337,
      longitude: 140.7181,
      kind: "land",
      provinceSlug: "papua",
      provinceName: "Papua",
      nearestProvinceSlug: null,
      nearestProvinceName: null,
      nearestProvinceKm: null,
      zone: "WIT",
    });
  });

  it("describes the Banda Sea as sea near Maluku, zone WIT", () => {
    expect(describeLocation(-5.5, 129.0)).toEqual({
      latitude: -5.5,
      longitude: 129.0,
      kind: "sea",
      provinceSlug: null,
      provinceName: null,
      nearestProvinceSlug: "maluku",
      nearestProvinceName: "Maluku",
      nearestProvinceKm: 127,
      zone: "WIT",
    });
  });

  it("returns null for invalid coordinates", () => {
    expect(describeLocation(Number.NaN, 0)).toBeNull();
  });
});

describe("deprecated resolveProvince wrapper (AC 7)", () => {
  it("is null at sea south of Java", () => {
    expect(resolveProvince(-9.5, 110.0)).toBeNull();
  });

  it("finds Bandung inside Jawa Barat", () => {
    expect(resolveProvince(-6.9175, 107.6191)).toMatchObject({
      province: { slug: "jawa-barat", name: "Jawa Barat" },
      method: "inside",
      distanceKm: 0,
    });
  });
});
