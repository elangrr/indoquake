import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { WorkerHeartbeat } from "@indoquake/shared";
import { computeFreshness, planReplay, readLastEventId } from "../src";

const RUNS = { seed: 133, numRuns: 100 };
const id = fc.integer({ min: 1, max: 1_000_000 });

describe("planReplay properties (A-M3)", () => {
  it("never replays when more than 200 rows are missing", () => {
    fc.assert(
      fc.property(
        fc.option(id, { nil: null }),
        fc.option(id, { nil: null }),
        fc.option(id, { nil: null }),
        fc.integer({ min: 201, max: 10_000_000 }),
        (lastEventId, newestId, oldestRetainedId, missingCount) => {
          expect(planReplay({ lastEventId, newestId, oldestRetainedId, missingCount }).kind).not.toBe("replay");
        },
      ),
      RUNS,
    );
  });

  it("replays only rows after the client's id when it is inside the window and <= 200 rows behind", () => {
    fc.assert(
      fc.property(id, fc.integer({ min: -1, max: 1_000 }), fc.integer({ min: 1, max: 1_000 }), fc.integer({ min: 0, max: 200 }), (oldest, offset, ahead, missingCount) => {
        const lastEventId = oldest + offset;
        const newestId = lastEventId + ahead;
        expect(planReplay({ lastEventId, newestId, oldestRetainedId: oldest, missingCount })).toEqual({
          kind: "replay",
          afterId: lastEventId,
        });
      }),
      RUNS,
    );
  });
});

describe("readLastEventId properties (A-M3)", () => {
  it("returns null or a non-negative safe integer for any header", () => {
    fc.assert(
      fc.property(fc.string({ unit: "grapheme-ascii" }), (header) => {
        const lastEventId = readLastEventId(new Request("http://x/api/v1/stream", { headers: { "last-event-id": header } }));
        expect(lastEventId === null || (Number.isSafeInteger(lastEventId) && lastEventId >= 0)).toBe(true);
      }),
      RUNS,
    );
  });

  it("reads back any id it would replay after", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 999_999_999_999_999 }), (value) => {
        expect(readLastEventId(new Request("http://x/api/v1/stream", { headers: { "last-event-id": String(value) } }))).toBe(value);
      }),
      RUNS,
    );
  });
});

const NOW = Date.parse("2026-10-28T12:00:00.000Z");
const RANK = { fresh: 0, stale: 1, down: 2, unknown: 3 } as const;
const beatAged = (ageSeconds: number): WorkerHeartbeat => ({
  at: new Date(NOW).toISOString(),
  ok: true,
  lastSuccessAt: new Date(NOW - ageSeconds * 1000).toISOString(),
  feeds: {
    autogempa: { fetched: true, events: 0 },
    gempaterkini: { fetched: true, events: 0 },
    gempadirasakan: { fetched: true, events: 0 },
  },
});
const stateAt = (ageSeconds: number) =>
  computeFreshness({ heartbeat: beatAged(ageSeconds), eventCount: 1, latestEventAt: null, nowMs: NOW }).state;

describe("computeFreshness properties (A-M3)", () => {
  it("never gets fresher as the last success gets older", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 86_400 }), fc.integer({ min: 0, max: 86_400 }), (age, extra) => {
        expect(RANK[stateAt(age + extra)]).toBeGreaterThanOrEqual(RANK[stateAt(age)]);
      }),
      RUNS,
    );
  });
});
