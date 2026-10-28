import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { nextDelayMs } from "../src/scheduler";

const RUNS = { seed: 133, numRuns: 100 };
const baseMs = fc.integer({ min: 1_000, max: 60_000 });
const failures = fc.integer({ min: 1, max: 12 });
const random = fc.double({ min: 0, max: 1, maxExcluded: true, noNaN: true });

describe("nextDelayMs properties (A-M3, D05)", () => {
  it("stays within 0.8..1.2 x min(base x 2^n, 120 s) after n failures", () => {
    fc.assert(
      fc.property(baseMs, failures, random, (base, n, r) => {
        const capped = Math.min(base * 2 ** n, 120_000);
        const delay = nextDelayMs(base, n, () => r);
        expect(delay).toBeGreaterThanOrEqual(Math.floor(capped * 0.8));
        expect(delay).toBeLessThanOrEqual(Math.ceil(capped * 1.2));
      }),
      RUNS,
    );
  });

  it("never waits less than a given Retry-After", () => {
    fc.assert(
      fc.property(baseMs, fc.integer({ min: 0, max: 12 }), random, fc.integer({ min: 0, max: 300_000 }), (base, n, r, retryAfterMs) => {
        expect(nextDelayMs(base, n, () => r, retryAfterMs)).toBeGreaterThanOrEqual(retryAfterMs);
      }),
      RUNS,
    );
  });
});
