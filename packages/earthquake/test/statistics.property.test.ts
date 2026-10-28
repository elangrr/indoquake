import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { countByMonth } from "../src/statistics";

const RUNS = { seed: 133, numRuns: 100 };
const REFERENCE = "2026-10-28T05:00:00.000Z";
// The 12-month window is 2025-11 .. 2026-10 in WIB (UTC+7); first instant is 2025-11-01 00:00 WIB.
const WINDOW_START_MS = Date.parse("2025-10-31T17:00:00.000Z");
const REFERENCE_MS = Date.parse(REFERENCE);

describe("countByMonth properties (A-M3, D14)", () => {
  it("monthly counts sum to the number of events inside the 12-month window", () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: WINDOW_START_MS, max: REFERENCE_MS }), { maxLength: 60 }), (times) => {
        const events = times.map((ms) => ({ eventTimeUtc: new Date(ms).toISOString() }));
        const total = countByMonth(events, 12, REFERENCE).reduce((sum, bucket) => sum + bucket.count, 0);
        expect(total).toBe(events.length);
      }),
      RUNS,
    );
  });

  it("always returns 12 buckets ending in the reference month", () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 0, max: 2 * REFERENCE_MS }), { maxLength: 30 }), (times) => {
        const buckets = countByMonth(times.map((ms) => ({ eventTimeUtc: new Date(ms).toISOString() })), 12, REFERENCE);
        expect(buckets).toHaveLength(12);
        expect(buckets[11]?.month).toBe("2026-10");
      }),
      RUNS,
    );
  });
});
