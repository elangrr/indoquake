import { describe, expect, it } from "vitest";
import { computeTravelTimes } from "../src/travel-time";
import { DEFAULT_VELOCITY_MODEL } from "../src/velocity";

describe("computeTravelTimes", () => {
  it("computes P and S travel times from hypocentral distance", () => {
    const times = computeTravelTimes(35, DEFAULT_VELOCITY_MODEL);
    expect(times.pTravelSeconds).toBeCloseTo(35 / 6.1, 5);
    expect(times.sTravelSeconds).toBeCloseTo(10, 5);
  });

  it("returns 0 for 0 distance", () => {
    const times = computeTravelTimes(0, DEFAULT_VELOCITY_MODEL);
    expect(times.pTravelSeconds).toBe(0);
    expect(times.sTravelSeconds).toBe(0);
  });

  it("never returns negative times", () => {
    const times = computeTravelTimes(-10, DEFAULT_VELOCITY_MODEL);
    expect(times.pTravelSeconds).toBe(0);
    expect(times.sTravelSeconds).toBe(0);
  });
});
