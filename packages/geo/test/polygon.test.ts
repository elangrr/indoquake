import { describe, expect, it } from "vitest";
import {
  distanceToRingKm,
  minDistanceToRingsKm,
  pointInRing,
  pointInRings,
} from "../src/polygon";

const SQUARE = [
  [0, 0],
  [2, 0],
  [2, 2],
  [0, 2],
  [0, 0],
];

describe("pointInRing", () => {
  it("detects points inside the ring", () => {
    expect(pointInRing({ latitude: 1, longitude: 1 }, SQUARE)).toBe(true);
  });

  it("rejects points outside the ring", () => {
    expect(pointInRing({ latitude: 3, longitude: 3 }, SQUARE)).toBe(false);
    expect(pointInRing({ latitude: -1, longitude: 1 }, SQUARE)).toBe(false);
  });
});

describe("pointInRings", () => {
  it("returns true when inside any ring", () => {
    const rings = [SQUARE, [[10, 10], [11, 10], [11, 11], [10, 11], [10, 10]]];
    expect(pointInRings({ latitude: 10.5, longitude: 10.5 }, rings)).toBe(true);
    expect(pointInRings({ latitude: 5, longitude: 5 }, rings)).toBe(false);
  });
});

describe("distanceToRingKm", () => {
  it("measures distance to the nearest edge", () => {
    const km = distanceToRingKm({ latitude: -0.5, longitude: 1 }, SQUARE);
    expect(km).toBeGreaterThan(50);
    expect(km).toBeLessThan(60);
  });

  it("returns 0 for a point on the ring", () => {
    expect(distanceToRingKm({ latitude: 0, longitude: 1 }, SQUARE)).toBeCloseTo(0, 5);
  });
});

describe("minDistanceToRingsKm", () => {
  it("picks the closest ring", () => {
    const rings = [
      [[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]],
      [[5, 5], [6, 5], [6, 6], [5, 6], [5, 5]],
    ];
    const km = minDistanceToRingsKm({ latitude: 4.9, longitude: 5.5 }, rings);
    expect(km).toBeLessThan(15);
  });
});
