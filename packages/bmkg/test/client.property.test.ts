import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { parseRetryAfter } from "../src";

const NOW = Date.parse("2026-10-28T12:00:00.250Z");
const RUNS = { seed: 133, numRuns: 100 };

describe("parseRetryAfter properties (A-M3)", () => {
  it("returns null or whole seconds in 0..300 for any header value", () => {
    fc.assert(
      fc.property(fc.string(), (value) => {
        const seconds = parseRetryAfter(value, NOW);
        expect(seconds === null || (Number.isInteger(seconds) && seconds >= 0 && seconds <= 300)).toBe(true);
      }),
      RUNS,
    );
  });

  it("returns 0..300 for any delta-seconds value, however large", () => {
    fc.assert(
      fc.property(fc.bigInt({ min: 0n, max: 10n ** 30n }), (value) => {
        const seconds = parseRetryAfter(value.toString(), NOW);
        expect(seconds).toBeGreaterThanOrEqual(0);
        expect(seconds).toBeLessThanOrEqual(300);
      }),
      RUNS,
    );
  });

  it("returns 0..300 for any HTTP-date, past or future", () => {
    fc.assert(
      fc.property(fc.integer({ min: -86_400, max: 86_400 }), (offsetSeconds) => {
        const seconds = parseRetryAfter(new Date(NOW + offsetSeconds * 1000).toUTCString(), NOW);
        expect(seconds).toBeGreaterThanOrEqual(0);
        expect(seconds).toBeLessThanOrEqual(300);
      }),
      RUNS,
    );
  });

  it("returns null for junk without digits or a date", () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[!#%&*_~?=+]{1,12}$/), (value) => {
        expect(parseRetryAfter(value, NOW)).toBeNull();
      }),
      RUNS,
    );
  });
});
