import { describe, expect, it } from "vitest";
import {
  matchesSubscription,
  type AlertEvent,
  type AlertSubscription,
} from "../src/matching";

const event: AlertEvent = {
  eventKey: "abc",
  magnitude: 5.2,
  depthKm: 10,
  latitude: -9.5,
  longitude: 112.8,
  regionName: "156 km Tenggara KAB-MALANG-JATIM",
  eventTimeWib: "14 Sep 2026 08:42:08 WIB",
  feltText: "II-III Pacitan",
  tsunamiPotential: false,
  provinceSlug: "jawa-timur",
};

function subscription(
  overrides: Partial<AlertSubscription> = {},
): AlertSubscription {
  return {
    id: 1,
    channel: "telegram",
    target: "123",
    minMagnitude: 4.5,
    maxDistanceKm: null,
    provinceSlug: null,
    tsunamiOnly: false,
    feltOnly: false,
    locationLatitude: null,
    locationLongitude: null,
    ...overrides,
  };
}

describe("matchesSubscription", () => {
  it("matches when all thresholds are met", () => {
    expect(matchesSubscription(subscription(), event, null)).toBe(true);
  });

  it("rejects events below the magnitude threshold", () => {
    expect(
      matchesSubscription(subscription({ minMagnitude: 5.5 }), event, null),
    ).toBe(false);
  });

  it("applies the distance threshold", () => {
    expect(
      matchesSubscription(subscription({ maxDistanceKm: 100 }), event, 150),
    ).toBe(false);
    expect(
      matchesSubscription(subscription({ maxDistanceKm: 200 }), event, 150),
    ).toBe(true);
  });

  it("requires a known distance when a distance filter is set", () => {
    expect(
      matchesSubscription(subscription({ maxDistanceKm: 100 }), event, null),
    ).toBe(false);
  });

  it("filters by province", () => {
    expect(
      matchesSubscription(subscription({ provinceSlug: "jawa-timur" }), event, null),
    ).toBe(true);
    expect(
      matchesSubscription(subscription({ provinceSlug: "banten" }), event, null),
    ).toBe(false);
  });

  it("filters felt-only and tsunami-only", () => {
    expect(
      matchesSubscription(subscription({ feltOnly: true }), event, null),
    ).toBe(true);
    expect(
      matchesSubscription(subscription({ tsunamiOnly: true }), event, null),
    ).toBe(false);
    expect(
      matchesSubscription(
        subscription({ tsunamiOnly: true }),
        { ...event, tsunamiPotential: true },
        null,
      ),
    ).toBe(true);
  });
});
