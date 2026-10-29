// AC 14: stored rows to the event contract for land, sea and legacy (not yet re-assigned) rows.
import { describe, expect, it } from "vitest";
import { toEarthquakeEvent, type EarthquakeRow } from "../src/serialize";

const BASE: EarthquakeRow = {
  id: 1,
  eventKey: "0123456789abcdef",
  eventTimeUtc: new Date("2026-10-27T16:30:00.000Z"),
  eventTimeWib: "27 Okt 2026 23:30:00 WIB",
  latitude: -2.5337,
  longitude: 140.7181,
  depthKm: 10,
  magnitude: 4.2,
  regionName: "Jayapura",
  potentialText: null,
  tsunamiPotential: false,
  feltText: null,
  shakemapUrl: null,
  source: "BMKG",
  provinceSlug: null,
  areaKind: null,
  nearestProvinceSlug: null,
  nearestProvinceKm: null,
  regionVersion: 0,
  firstSeenAt: new Date("2026-10-27T16:31:00.000Z"),
  lastUpdatedAt: new Date("2026-10-27T16:31:00.000Z"),
  createdAt: new Date("2026-10-27T16:31:00.000Z"),
  updatedAt: new Date("2026-10-27T16:31:00.000Z"),
};

describe("toEarthquakeEvent area fields (AC 14)", () => {
  it("a land row has the province, its name and its zone", () => {
    expect(toEarthquakeEvent({ ...BASE, areaKind: "land", provinceSlug: "papua", regionVersion: 1 })).toMatchObject({
      areaKind: "land",
      provinceSlug: "papua",
      provinceName: "Papua",
      nearestProvinceSlug: null,
      nearestProvinceName: null,
      nearestProvinceKm: null,
      zone: "WIT",
    });
  });

  it("a sea row has no province, the nearest province with km, and the nearest province's zone", () => {
    expect(
      toEarthquakeEvent({ ...BASE, areaKind: "sea", nearestProvinceSlug: "bali", nearestProvinceKm: 112, regionVersion: 1 }),
    ).toMatchObject({
      areaKind: "sea",
      provinceSlug: null,
      provinceName: null,
      nearestProvinceSlug: "bali",
      nearestProvinceName: "Bali",
      nearestProvinceKm: 112,
      zone: "WITA",
    });
  });

  it("a legacy row keeps its stored province and that province's zone", () => {
    expect(toEarthquakeEvent({ ...BASE, provinceSlug: "jawa-barat" })).toMatchObject({
      areaKind: null,
      provinceSlug: "jawa-barat",
      provinceName: "Jawa Barat",
      nearestProvinceSlug: null,
      nearestProvinceKm: null,
      zone: "WIB",
    });
  });

  it("a legacy row without a province reads WIB", () => {
    expect(toEarthquakeEvent(BASE)).toMatchObject({ areaKind: null, provinceSlug: null, provinceName: null, zone: "WIB" });
  });
});
