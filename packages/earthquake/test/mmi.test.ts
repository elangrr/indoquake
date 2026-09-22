import { describe, expect, it } from "vitest";
import {
  DEFAULT_ATTENUATION_MODEL,
  describeMmi,
  estimateFeltRadiusKm,
  estimateMmi,
  parseMmiString,
} from "../src/mmi";

describe("estimateMmi", () => {
  it("decreases with distance", () => {
    const near = estimateMmi(6, 30);
    const far = estimateMmi(6, 200);
    expect(near).toBeGreaterThan(far);
  });

  it("increases with magnitude", () => {
    const small = estimateMmi(4, 50);
    const large = estimateMmi(7, 50);
    expect(large).toBeGreaterThan(small);
  });

  it("stays within the MMI scale", () => {
    expect(estimateMmi(9.5, 1)).toBeLessThanOrEqual(10);
    expect(estimateMmi(1, 1000)).toBeGreaterThanOrEqual(1);
  });

  it("gives plausible values for moderate events", () => {
    const nearby = estimateMmi(6, 30, DEFAULT_ATTENUATION_MODEL);
    expect(nearby).toBeGreaterThan(4);
    expect(nearby).toBeLessThan(7);

    const regional = estimateMmi(6, 300, DEFAULT_ATTENUATION_MODEL);
    expect(regional).toBeGreaterThan(1.5);
    expect(regional).toBeLessThan(4);
  });
});

describe("estimateFeltRadiusKm", () => {
  it("grows with magnitude", () => {
    expect(estimateFeltRadiusKm(6)).toBeGreaterThan(estimateFeltRadiusKm(4));
  });

  it("stays within realistic bounds per magnitude", () => {
    expect(estimateFeltRadiusKm(4.3)).toBeGreaterThan(40);
    expect(estimateFeltRadiusKm(4.3)).toBeLessThan(120);
    expect(estimateFeltRadiusKm(5.2)).toBeGreaterThan(100);
    expect(estimateFeltRadiusKm(5.2)).toBeLessThan(250);
    expect(estimateFeltRadiusKm(6)).toBeGreaterThan(200);
    expect(estimateFeltRadiusKm(6)).toBeLessThan(450);
  });

  it("shrinks for deeper hypocenters", () => {
    const shallow = estimateFeltRadiusKm(6.2, 10);
    const deep = estimateFeltRadiusKm(6.2, 145);
    expect(deep).toBeLessThan(shallow);
  });

  it("returns 0 when a deep event is not expected to be felt at the surface", () => {
    expect(estimateFeltRadiusKm(5.9, 376)).toBe(0);
  });

  it("is consistent with the attenuation model at the threshold", () => {
    const radius = estimateFeltRadiusKm(6, 10, 2);
    const hypocentral = Math.hypot(radius, 10);
    const mmiAtRadius = estimateMmi(6, hypocentral);
    expect(mmiAtRadius).toBeGreaterThan(1.7);
    expect(mmiAtRadius).toBeLessThan(2.3);
  });
});

describe("describeMmi", () => {
  it("maps values to roman numerals and Indonesian labels", () => {
    expect(describeMmi(3.2).roman).toBe("III");
    expect(describeMmi(6.4).roman).toBe("VI");
    expect(describeMmi(12).roman).toBe("X");
    expect(describeMmi(0).roman).toBe("I");
    expect(describeMmi(4).label).toBe("Ringan");
  });
});

describe("parseMmiString", () => {
  it("parses single and ranged MMI strings", () => {
    expect(parseMmiString("III")).toEqual({ min: 3, max: 3 });
    expect(parseMmiString("III-IV")).toEqual({ min: 3, max: 4 });
  });

  it("returns null for unknown values", () => {
    expect(parseMmiString("")).toBeNull();
    expect(parseMmiString("abc")).toBeNull();
  });
});
