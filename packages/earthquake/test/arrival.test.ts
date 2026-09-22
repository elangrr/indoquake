import { describe, expect, it } from "vitest";
import {
  BLIND_ZONE_DISTANCE_KM,
  estimateArrival,
} from "../src/arrival";
import { DEFAULT_VELOCITY_MODEL } from "../src/velocity";

const ORIGIN_UTC = "2026-09-16T01:00:00.000Z";

describe("estimateArrival", () => {
  it("estimates S arrival and remaining warning time", () => {
    const estimate = estimateArrival({
      originTimeUtc: ORIGIN_UTC,
      hypocentralKm: 100,
      model: DEFAULT_VELOCITY_MODEL,
      nowUtc: "2026-09-16T01:00:10.000Z",
    });
    expect(estimate.sTravelSeconds).toBeCloseTo(28.57, 1);
    expect(estimate.secondsUntilS).toBeCloseTo(18.57, 1);
    expect(estimate.warningSecondsRemaining).toBeCloseTo(18.57, 1);
    expect(estimate.blindZone).toBe(false);
    expect(estimate.uncertaintySeconds).toBeCloseTo(28.57 * 0.25, 1);
    expect(estimate.pTravelSeconds).toBeLessThan(estimate.sTravelSeconds);
  });

  it("flags blind zone for very close hypocenters", () => {
    const estimate = estimateArrival({
      originTimeUtc: ORIGIN_UTC,
      hypocentralKm: BLIND_ZONE_DISTANCE_KM - 1,
      model: DEFAULT_VELOCITY_MODEL,
      nowUtc: ORIGIN_UTC,
    });
    expect(estimate.blindZone).toBe(true);
  });

  it("clamps warning time at zero after the S wave has passed", () => {
    const estimate = estimateArrival({
      originTimeUtc: ORIGIN_UTC,
      hypocentralKm: 35,
      model: DEFAULT_VELOCITY_MODEL,
      nowUtc: "2026-09-16T01:05:00.000Z",
    });
    expect(estimate.secondsUntilS).toBeLessThan(0);
    expect(estimate.warningSecondsRemaining).toBe(0);
  });

  it("produces an uncertainty window around the S arrival", () => {
    const estimate = estimateArrival({
      originTimeUtc: ORIGIN_UTC,
      hypocentralKm: 200,
      model: DEFAULT_VELOCITY_MODEL,
      nowUtc: ORIGIN_UTC,
    });
    const earliest = new Date(estimate.sArrivalEarliestUtc).getTime();
    const latest = new Date(estimate.sArrivalLatestUtc).getTime();
    const nominal = new Date(estimate.sArrivalUtc).getTime();
    expect(earliest).toBeLessThan(nominal);
    expect(latest).toBeGreaterThan(nominal);
  });
});
