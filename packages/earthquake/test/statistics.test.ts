import { describe, expect, it } from "vitest";
import {
  countByDay,
  countByHour,
  countByProvince,
  depthDistribution,
  magnitudeDistribution,
  summarize,
  wibDateKey,
  type StatEvent,
} from "../src/statistics";

const events: StatEvent[] = [
  {
    eventTimeUtc: "2026-09-16T01:11:31.000Z",
    magnitude: 2.9,
    depthKm: 5,
    feltText: "III Pangalengan",
    tsunamiPotential: false,
    provinceSlug: "jawa-barat",
  },
  {
    eventTimeUtc: "2026-09-14T01:42:08.000Z",
    magnitude: 5.2,
    depthKm: 10,
    feltText: "II-III Pacitan",
    tsunamiPotential: false,
    provinceSlug: "jawa-timur",
  },
  {
    eventTimeUtc: "2026-09-14T10:58:04.000Z",
    magnitude: 6.2,
    depthKm: 145,
    feltText: null,
    tsunamiPotential: null,
    provinceSlug: null,
  },
];

describe("summarize", () => {
  it("aggregates counts and extremes", () => {
    const summary = summarize(events);
    expect(summary.total).toBe(3);
    expect(summary.countM3).toBe(2);
    expect(summary.countM4).toBe(2);
    expect(summary.countM5).toBe(2);
    expect(summary.countFelt).toBe(2);
    expect(summary.countTsunami).toBe(0);
    expect(summary.strongestMagnitude).toBe(6.2);
    expect(summary.deepestKm).toBe(145);
    expect(summary.averageMagnitude).toBeCloseTo(4.77, 2);
  });

  it("handles an empty list", () => {
    const summary = summarize([]);
    expect(summary.total).toBe(0);
    expect(summary.countSea).toBe(0);
    expect(summary.averageMagnitude).toBeNull();
  });

  it("countSea counts sea rows at any distance, not land or legacy rows (AC 18)", () => {
    expect(summarize(areaEvents).countSea).toBe(3);
  });
});

describe("distributions", () => {
  it("buckets magnitudes", () => {
    const buckets = magnitudeDistribution(events);
    const lookup = new Map(buckets.map((bucket) => [bucket.label, bucket.count]));
    expect(lookup.get("2 – 3")).toBe(1);
    expect(lookup.get("5 – 6")).toBe(1);
    expect(lookup.get("≥ 6")).toBe(1);
  });

  it("buckets depths", () => {
    const buckets = depthDistribution(events);
    const lookup = new Map(buckets.map((bucket) => [bucket.label, bucket.count]));
    expect(lookup.get("< 10")).toBe(1);
    expect(lookup.get("10 – 30")).toBe(1);
    expect(lookup.get("70 – 150")).toBe(1);
  });
});

describe("time aggregation", () => {
  it("uses WIB dates", () => {
    expect(wibDateKey("2026-09-16T01:11:31.000Z")).toBe("2026-09-16");
    expect(wibDateKey("2026-09-15T20:00:00.000Z")).toBe("2026-09-16");
  });

  it("counts by day over a window", () => {
    const days = countByDay(events, 7, "2026-09-16T12:00:00.000Z");
    const lookup = new Map(days.map((day) => [day.date, day.count]));
    expect(lookup.get("2026-09-16")).toBe(1);
    expect(lookup.get("2026-09-14")).toBe(2);
    expect(days).toHaveLength(7);
  });

  it("counts by hour in WIB", () => {
    const hours = countByHour(events);
    expect(hours).toHaveLength(24);
    expect(hours[8]).toBe(2);
    expect(hours[17]).toBe(1);
    expect(hours.reduce((sum, value) => sum + value, 0)).toBe(3);
  });

  it("byProvince lists every province with zone, land count and sea count within the limit (AC 18)", () => {
    expect(countByProvince(areaEvents, PROVINCES, 300)).toEqual([
      { slug: "papua", name: "Papua", zone: "WIT", count: 2, seaCount: 1 },
      { slug: "jawa-barat", name: "Jawa Barat", zone: "WIB", count: 1, seaCount: 0 },
      { slug: "bali", name: "Bali", zone: "WITA", count: 0, seaCount: 1 },
      { slug: "maluku", name: "Maluku", zone: "WIT", count: 0, seaCount: 0 },
    ]);
  });

  it("byProvince keeps table order between equal counts", () => {
    expect(countByProvince([], PROVINCES, 300).map((item) => item.slug)).toEqual(["jawa-barat", "bali", "maluku", "papua"]);
  });
});

const PROVINCES = [
  { slug: "jawa-barat", name: "Jawa Barat", zone: "WIB" },
  { slug: "bali", name: "Bali", zone: "WITA" },
  { slug: "maluku", name: "Maluku", zone: "WIT" },
  { slug: "papua", name: "Papua", zone: "WIT" },
] as const;

const base = { eventTimeUtc: "2026-10-28T00:00:00.000Z", magnitude: 4, depthKm: 10, feltText: null, tsunamiPotential: false };
const areaEvents: StatEvent[] = [
  { ...base, areaKind: "land", provinceSlug: "papua" },
  { ...base, areaKind: "land", provinceSlug: "papua" },
  { ...base, areaKind: null, provinceSlug: "jawa-barat" },
  { ...base, areaKind: null, provinceSlug: null },
  { ...base, areaKind: "sea", provinceSlug: null, nearestProvinceSlug: "papua", nearestProvinceKm: 300 },
  { ...base, areaKind: "sea", provinceSlug: null, nearestProvinceSlug: "bali", nearestProvinceKm: 12 },
  { ...base, areaKind: "sea", provinceSlug: null, nearestProvinceSlug: "maluku", nearestProvinceKm: 301 },
];
