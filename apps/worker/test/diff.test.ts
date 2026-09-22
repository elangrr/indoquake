import { describe, expect, it } from "vitest";
import { diffSnapshots, type EarthquakeSnapshot } from "../src/diff";

const base: EarthquakeSnapshot = {
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
