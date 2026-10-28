import { describe, expect, it } from "vitest";
import fc from "fast-check";
import type { EarthquakeEvent } from "@indoquake/shared";
import { mergeEvent, mergeEvents } from "./merge-event";

const STORED: EarthquakeEvent = {
  eventKey: "a1b2c3d4e5f60718",
  eventTimeUtc: "2026-10-28T01:05:44.000Z",
  eventTimeWib: "28 Okt 2026 08:05:44 WIB",
  latitude: -8.42,
  longitude: 112.51,
  depthKm: 64,
  magnitude: 5.1,
  regionName: "71 km BaratDaya Kab. Malang",
  potentialText: "Berpotensi tsunami",
  tsunamiPotential: true,
  feltText: "III Malang, II Blitar",
  shakemapUrl: "https://static.bmkg.go.id/20261028080544.mmi.jpg",
  source: "BMKG",
  lastUpdatedAt: "2026-10-28T01:07:00.000Z",
};

const OLDER: EarthquakeEvent = {
  ...STORED,
  eventKey: "0f1e2d3c4b5a6978",
  eventTimeUtc: "2026-10-27T19:40:02.000Z",
  regionName: "23 km TimurLaut Kab. Sukabumi",
};

describe("mergeEvent", () => {
  it("does not let null fields of an incoming frame erase stored tsunami and felt info", () => {
    const fragment = {
      ...STORED,
      magnitude: 5.2,
      potentialText: null,
      tsunamiPotential: null,
      feltText: null,
      shakemapUrl: null,
      lastUpdatedAt: "2026-10-28T01:09:00.000Z",
    };
    expect(mergeEvent([STORED], fragment)).toEqual([
      { ...STORED, magnitude: 5.2, lastUpdatedAt: "2026-10-28T01:09:00.000Z" },
    ]);
  });

  it("updates the row in place and keeps the list newest first", () => {
    expect(mergeEvent([STORED, OLDER], { ...OLDER, depthKm: 10, lastUpdatedAt: "2026-10-28T02:00:00.000Z" })).toEqual([
      STORED,
      { ...OLDER, depthKm: 10, lastUpdatedAt: "2026-10-28T02:00:00.000Z" },
    ]);
  });

  it("puts a new event at its time position", () => {
    expect(mergeEvent([OLDER], STORED).map((e) => e.eventKey)).toEqual([STORED.eventKey, OLDER.eventKey]);
  });

  it("keeps stored values when an older revision arrives late", () => {
    const late = { ...STORED, magnitude: 4.9, lastUpdatedAt: "2026-10-28T01:06:00.000Z" };
    expect(mergeEvent([STORED], late)).toEqual([STORED]);
  });
});

const revisionArb = fc.record({
  key: fc.constantFrom("a1b2c3d4e5f60718", "0f1e2d3c4b5a6978", "77aa88bb99cc0011"),
  minute: fc.integer({ min: 0, max: 59 }),
  magnitude: fc.option(fc.integer({ min: 20, max: 80 }), { nil: null }),
  tsunami: fc.option(fc.boolean(), { nil: null }),
  felt: fc.option(fc.constantFrom("III Malang", "II Blitar"), { nil: null }),
});

type Revision = { key: string; minute: number; magnitude: number | null; tsunami: boolean | null; felt: string | null };

// The server sends the full stored row, which only gains values over time: each frame is the
// cumulative snapshot after a revision. One revision per (key, minute), as lastUpdatedAt is unique.
function toFrames(revisions: Revision[]): EarthquakeEvent[] {
  const unique = [...new Map(revisions.map((r) => [`${r.key}:${r.minute}`, r])).values()].sort(
    (a, b) => a.minute - b.minute,
  );
  const latest = new Map<string, EarthquakeEvent>();
  return unique.map((r) => {
    const previous = latest.get(r.key) ?? { ...STORED, eventKey: r.key, tsunamiPotential: null, potentialText: null, feltText: null };
    const frame: EarthquakeEvent = {
      ...previous,
      magnitude: r.magnitude === null ? previous.magnitude : r.magnitude / 10,
      tsunamiPotential: r.tsunami ?? previous.tsunamiPotential,
      feltText: r.felt ?? previous.feltText,
      lastUpdatedAt: `2026-10-28T02:${String(r.minute).padStart(2, "0")}:00.000Z`,
    };
    latest.set(r.key, frame);
    return frame;
  });
}

describe("mergeEvent properties", () => {
  it("is idempotent and independent of arrival order", () => {
    fc.assert(
      fc.property(fc.array(revisionArb, { maxLength: 12 }), fc.integer(), (revisions, seed) => {
        const frames = toFrames(revisions);
        const shuffled = fc.sample(fc.shuffledSubarray(frames, { minLength: frames.length, maxLength: frames.length }), {
          seed,
          numRuns: 1,
        })[0];
        const once = mergeEvents([], frames);
        expect(mergeEvents([], shuffled)).toEqual(once);
        expect(mergeEvents(once, frames)).toEqual(once);
      }),
      { seed: 133, numRuns: 100 },
    );
  });
});
