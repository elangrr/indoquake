import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { findDuplicate } from "../src";

const ORIGIN = { eventTimeUtc: "2026-09-16T01:11:31.000Z", latitude: -7.22, longitude: 107.62 };

describe("findDuplicate (A-02, D01)", () => {
  it("matches a revision 20 s and 0.03 deg away", () => {
    const row = { id: 1, eventTimeUtc: "2026-09-16T01:11:51.000Z", latitude: -7.25, longitude: 107.62 };
    expect(findDuplicate(ORIGIN, [row])?.row).toBe(row);
  });

  it("returns the nearest of several qualifying rows", () => {
    const far = { id: 1, eventTimeUtc: ORIGIN.eventTimeUtc, latitude: -7.5, longitude: 107.62 };
    const near = { id: 2, eventTimeUtc: ORIGIN.eventTimeUtc, latitude: -7.23, longitude: 107.62 };
    expect(findDuplicate(ORIGIN, [far, near])?.row.id).toBe(2);
  });

  it.each([
    ["61 s later", { eventTimeUtc: "2026-09-16T01:12:32.000Z", latitude: -7.22, longitude: 107.62 }],
    ["61 s earlier", { eventTimeUtc: "2026-09-16T01:10:30.000Z", latitude: -7.22, longitude: 107.62 }],
    ["51 km away", { eventTimeUtc: ORIGIN.eventTimeUtc, latitude: -7.22 - 51 / 111.195, longitude: 107.62 }],
  ])("never matches an event %s", (_label, row) => {
    expect(findDuplicate(ORIGIN, [row])).toBeNull();
  });

  it("is symmetric in the sign of dt and exact at 60 s (property)", () => {
    fc.assert(
      fc.property(fc.integer({ min: -120, max: 120 }), (seconds) => {
        const shifted = (sign: number) => ({
          ...ORIGIN,
          eventTimeUtc: new Date(Date.parse(ORIGIN.eventTimeUtc) + sign * seconds * 1000).toISOString(),
        });
        const later = findDuplicate(ORIGIN, [shifted(1)]) !== null;
        const earlier = findDuplicate(ORIGIN, [shifted(-1)]) !== null;
        expect(later).toBe(earlier);
        expect(later).toBe(Math.abs(seconds) <= 60);
      }),
      { seed: 133, numRuns: 100 },
    );
  });

  it("matches a then b exactly when it matches b then a (property)", () => {
    const point = fc.record({
      eventTimeUtc: fc.integer({ min: 0, max: 200 }).map((s) => new Date(Date.UTC(2026, 9, 1) + s * 1000).toISOString()),
      latitude: fc.double({ min: -9, max: -5, noNaN: true }),
      longitude: fc.double({ min: 105, max: 115, noNaN: true }),
    });
    fc.assert(
      fc.property(point, point, (a, b) => {
        expect(findDuplicate(a, [b]) !== null).toBe(findDuplicate(b, [a]) !== null);
      }),
      { seed: 133, numRuns: 100 },
    );
  });
});
