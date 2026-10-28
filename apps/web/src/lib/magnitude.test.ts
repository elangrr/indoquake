import { describe, expect, it } from "vitest";
import { formatMagnitude, magnitudeColor, ringCount } from "./magnitude";

describe("ringCount", () => {
  it.each([
    [2.4, 1],
    [3.99, 1],
    [4, 2],
    [4.9, 2],
    [5, 3],
    [5.95, 3],
    [6, 4],
    [7.4, 4],
  ])("M%s draws %s rings", (magnitude, rings) => {
    expect(ringCount(magnitude)).toBe(rings);
  });
});

describe("magnitude labels", () => {
  it.each([
    [5.1, "5.1"],
    [4, "4.0"],
  ])("%s shows as %s", (magnitude, text) => {
    expect(formatMagnitude(magnitude)).toBe(text);
  });

  it.each([
    [2.9, "#7f8e8a"],
    [5.4, "#d9481c"],
    [6.2, "#a31616"],
  ])("M%s uses %s", (magnitude, color) => {
    expect(magnitudeColor(magnitude)).toBe(color);
  });
});
