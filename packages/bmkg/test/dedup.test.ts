import { describe, expect, it } from "vitest";
import { eventKeyFor } from "../src/dedup";

describe("eventKeyFor", () => {
  const base = {
    eventTimeUtc: "2026-09-16T01:11:31.000Z",
    latitude: -7.22,
    longitude: 107.62,
  };

  it("is stable for identical input", () => {
    expect(eventKeyFor(base)).toBe(eventKeyFor({ ...base }));
  });

  it("ignores sub-0.01 coordinate differences", () => {
    expect(eventKeyFor({ ...base, latitude: -7.224 })).toBe(eventKeyFor(base));
  });

  it("changes when time or location changes", () => {
    expect(
      eventKeyFor({ ...base, eventTimeUtc: "2026-09-16T01:12:31.000Z" }),
    ).not.toBe(eventKeyFor(base));
    expect(eventKeyFor({ ...base, longitude: 108 })).not.toBe(
      eventKeyFor(base),
    );
  });
});
