import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { classifyTsunamiPotential } from "@indoquake/bmkg";
import { diffSnapshots, type EarthquakeSnapshot } from "../src/diff";

const base: EarthquakeSnapshot = {
  eventTimeUtc: "2026-09-16T01:11:31.000Z",
  magnitude: 4.8,
  depthKm: 31,
  latitude: -7.74,
  longitude: 106.55,
  regionName: "83 km selatan Kab. Sukabumi",
  potentialText: "Tidak berpotensi tsunami",
  feltText: null,
  shakemapUrl: null,
  tsunamiPotential: false,
};

describe("diffSnapshots", () => {
  it("returns no changes for identical snapshots", () => {
    const result = diffSnapshots(base, { ...base });
    expect(result.changes).toEqual([]);
    expect(result.updates).toEqual({});
  });

  it("ignores float4 round-trip noise", () => {
    const result = diffSnapshots(base, { ...base, magnitude: 4.800000190734863 });
    expect(result.changes).toEqual([]);
  });

  it("detects magnitude and depth revisions", () => {
    const result = diffSnapshots(base, {
      ...base,
      magnitude: 4.9,
      depthKm: 33,
    });
    expect(result.changes).toEqual([
      { field: "magnitude", oldValue: "4.8", newValue: "4.9" },
      { field: "depthKm", oldValue: "31", newValue: "33" },
    ]);
    expect(result.updates).toEqual({ magnitude: 4.9, depthKm: 33 });
  });

  it("keeps regionName sticky across feeds", () => {
    const result = diffSnapshots(base, {
      ...base,
      regionName: "Pusat gempa berada di laut 83 km selatan Sukabumi",
    });
    expect(result.changes).toEqual([]);
    expect(result.updates).toEqual({});
  });

  it("applies regionName when existing is empty", () => {
    const result = diffSnapshots(
      { ...base, regionName: "" },
      { ...base, regionName: "Sukabumi" },
    );
    expect(result.changes).toEqual([
      { field: "regionName", oldValue: "", newValue: "Sukabumi" },
    ]);
  });

  it("applies non-null feltText and ignores null overwrites", () => {
    const filled = diffSnapshots(base, { ...base, feltText: "III Sukabumi" });
    expect(filled.changes).toEqual([
      { field: "feltText", oldValue: null, newValue: "III Sukabumi" },
    ]);

    const cleared = diffSnapshots(
      { ...base, feltText: "III Sukabumi" },
      { ...base, feltText: null },
    );
    expect(cleared.changes).toEqual([]);
  });

  it("detects tsunamiPotential revisions but ignores null", () => {
    const raised = diffSnapshots(base, { ...base, tsunamiPotential: true });
    expect(raised.changes).toEqual([
      { field: "tsunamiPotential", oldValue: "false", newValue: "true" },
    ]);

    const unknown = diffSnapshots(base, { ...base, tsunamiPotential: null });
    expect(unknown.changes).toEqual([]);
  });

  it("keeps potentialText sticky once set", () => {
    const result = diffSnapshots(base, {
      ...base,
      potentialText: "Gempa ini dirasakan untuk diteruskan pada masyarakat",
    });
    expect(result.changes).toEqual([]);
  });
});

describe("diffSnapshots potentialText and the tsunami flag (A-05, D03)", () => {
  const NO = "Tidak berpotensi tsunami";
  const YES = "Berpotensi tsunami, peringatan dini dari BMKG";
  const FELT = "Gempa ini dirasakan untuk diteruskan pada masyarakat";

  it("replaces 'Tidak berpotensi tsunami' with 'Berpotensi tsunami' together with the flag", () => {
    const result = diffSnapshots(base, { ...base, potentialText: YES, tsunamiPotential: true });
    expect(result.updates).toEqual({ potentialText: YES, tsunamiPotential: true });
  });

  it("applies BMKG retracting true to false", () => {
    const raised = { ...base, potentialText: YES, tsunamiPotential: true };
    const result = diffSnapshots(raised, { ...base, potentialText: NO, tsunamiPotential: false });
    expect(result.updates).toEqual({ potentialText: NO, tsunamiPotential: false });
  });

  it("lets a classified text replace autogempa's felt notice", () => {
    const felt = { ...base, potentialText: FELT, tsunamiPotential: null };
    expect(diffSnapshots(felt, { ...base, potentialText: NO, tsunamiPotential: false }).updates).toEqual({
      potentialText: NO,
      tsunamiPotential: false,
    });
  });

  it("records a revised origin time", () => {
    const result = diffSnapshots(base, { ...base, eventTimeUtc: "2026-09-16T01:11:51.000Z" });
    expect(result.changes).toEqual([
      { field: "eventTimeUtc", oldValue: "2026-09-16T01:11:31.000Z", newValue: "2026-09-16T01:11:51.000Z" },
    ]);
  });

  const incoming = fc.constantFrom(NO, YES, FELT, null).map((potentialText) => ({
    potentialText,
    tsunamiPotential: classifyTsunamiPotential(potentialText),
  }));

  it("never stores a text that contradicts the stored flag, for any feed sequence (property)", () => {
    fc.assert(
      fc.property(fc.array(incoming, { minLength: 1, maxLength: 12 }), (sequence) => {
        const stored = sequence.reduce<EarthquakeSnapshot>(
          (current, next) => ({ ...current, ...diffSnapshots(current, { ...current, ...next }).updates }),
          { ...base, potentialText: null, tsunamiPotential: null },
        );
        const textSays = classifyTsunamiPotential(stored.potentialText);
        expect(textSays === null || textSays === stored.tsunamiPotential).toBe(true);
      }),
      { seed: 133, numRuns: 100 },
    );
  });

  it("is idempotent: applying the same record twice changes nothing the second time (property)", () => {
    fc.assert(
      fc.property(incoming, fc.double({ min: 1, max: 9, noNaN: true }), (next, magnitude) => {
        const record = { ...base, ...next, magnitude };
        const once = { ...base, ...diffSnapshots(base, record).updates };
        expect(diffSnapshots(once, record).changes).toEqual([]);
      }),
      { seed: 133, numRuns: 100 },
    );
  });
});
