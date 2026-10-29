import { describe, expect, it } from "vitest";
import { describeLocation } from "../../../packages/regions/src/lookup";
import { provinceBySlug } from "../../../packages/regions/src/meta";
import { REGIONS, seedRows } from "./stack.mjs";

const NOW = Date.UTC(2026, 9, 29, 4, 0, 0);
const rows = seedRows(120, NOW);

describe("national e2e seed (AC 42)", () => {
  it("is deterministic for a given count and time", () => {
    expect(seedRows(120, NOW)).toEqual(rows);
  });

  it("covers 14 land provinces in all 7 island groups", () => {
    const provinces = new Set(rows.map((row) => row.province_slug).filter((slug) => slug !== null));
    expect(provinces.size).toBe(14);
    expect(new Set([...provinces].map((slug) => provinceBySlug(slug)?.group)).size).toBe(7);
  });

  it("puts 77 of 120 rows (64%) in WITA or WIT provinces", () => {
    const eastern = rows.filter((row) => describeLocation(row.latitude, row.longitude)?.zone !== "WIB");
    expect(eastern).toHaveLength(77);
  });

  it("has 21 of 120 sea rows (18%)", () => {
    expect(rows.filter((row) => row.area_kind === "sea")).toHaveLength(21);
  });

  it.each(REGIONS.map((region) => [region[0], region]))("%s carries the server assignment of its coordinates", (_place, region) => {
    const [, , latitude, longitude, kind, slug, km] = region;
    const area = describeLocation(latitude, longitude);
    expect(
      kind === "land"
        ? { kind: area?.kind, provinceSlug: area?.provinceSlug }
        : { kind: area?.kind, nearestProvinceSlug: area?.nearestProvinceSlug, nearestProvinceKm: area?.nearestProvinceKm },
    ).toEqual(kind === "land" ? { kind, provinceSlug: slug } : { kind, nearestProvinceSlug: slug, nearestProvinceKm: km });
  });
});
