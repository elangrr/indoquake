import { describe, expect, it } from "vitest";
import { haversineKm, hypocentralKm } from "../src/distance";
import { formatDistanceKm, formatDurationId } from "../src/format";

describe("haversineKm", () => {
  it("returns 0 for the same point", () => {
    const point = { latitude: -6.9175, longitude: 107.6191 };
    expect(haversineKm(point, point)).toBe(0);
  });

  it("computes Bandung - Jakarta roughly 119 km", () => {
    const bandung = { latitude: -6.9175, longitude: 107.6191 };
    const jakarta = { latitude: -6.2088, longitude: 106.8456 };
    const km = haversineKm(bandung, jakarta);
    expect(km).toBeGreaterThan(110);
    expect(km).toBeLessThan(130);
  });
});

describe("hypocentralKm", () => {
  it("uses pythagoras on horizontal distance and depth", () => {
    expect(hypocentralKm(4, 3)).toBe(5);
  });
});

describe("formatDurationId", () => {
  it("uses detik below 60 seconds", () => {
    expect(formatDurationId(0)).toBe("0 detik");
    expect(formatDurationId(45)).toBe("45 detik");
    expect(formatDurationId(59.4)).toBe("59 detik");
  });

  it("uses menit + detik at 60 seconds and above", () => {
    expect(formatDurationId(60)).toBe("1 menit");
    expect(formatDurationId(72)).toBe("1 mnt 12 dtk");
    expect(formatDurationId(3600)).toBe("60 menit");
  });
});

describe("formatDistanceKm", () => {
  it("formats with Indonesian thousand separators", () => {
    expect(formatDistanceKm(142.4)).toBe("142 km");
  });
});
