import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { distanceToCoastKm, type CoastlineFile } from "./coastline";

const NATIONAL = JSON.parse(
  readFileSync(new URL("../../public/geo/garis-pantai.json", import.meta.url), "utf8"),
) as CoastlineFile;

describe("distanceToCoastKm on the national coastline file (AC 35)", () => {
  it.each([
    ["Jayapura", -2.5337, 140.7181],
    ["Denpasar", -8.6705, 115.2126],
    ["Kupang", -10.1772, 123.607],
  ])("%s is on the coast (<= 10 km)", (_city, latitude, longitude) => {
    expect(distanceToCoastKm(latitude, longitude, NATIONAL)).toBeLessThanOrEqual(10);
  });

  it("Bandung is inland (>= 50 km)", () => {
    expect(distanceToCoastKm(-6.9175, 107.6191, NATIONAL)).toBeGreaterThanOrEqual(50);
  });

  it("Palangka Raya is far inland (>= 100 km)", () => {
    expect(distanceToCoastKm(-2.2161, 113.9135, NATIONAL)).toBeGreaterThanOrEqual(100);
  });

  it("returns null for an empty coastline", () => {
    expect(distanceToCoastKm(-2.5, 140.7, { source: "", bbox: { minLon: 0, minLat: 0, maxLon: 0, maxLat: 0 }, lines: [] })).toBeNull();
  });
});
