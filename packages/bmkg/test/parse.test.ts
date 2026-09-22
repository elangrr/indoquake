import { describe, expect, it } from "vitest";
import autogempaFixture from "../fixtures/autogempa.json";
import tsunamiFixture from "../fixtures/autogempa-tsunami.synthetic.json";
import gempadirasakanFixture from "../fixtures/gempadirasakan.json";
import gempaterkiniFixture from "../fixtures/gempaterkini.json";
import {
  classifyTsunamiPotential,
  parseCoordinates,
  parseDepthKm,
  parseFeedPayload,
  parseFeltReports,
} from "../src/parse";

describe("parseCoordinates", () => {
  it("parses 'lat,lon'", () => {
    expect(parseCoordinates("-7.22,107.62")).toEqual({
      latitude: -7.22,
      longitude: 107.62,
    });
  });

  it("rejects invalid input", () => {
    expect(parseCoordinates("")).toBeNull();
    expect(parseCoordinates("-7.22")).toBeNull();
    expect(parseCoordinates("abc,def")).toBeNull();
    expect(parseCoordinates("999,107.62")).toBeNull();
  });
});

describe("parseDepthKm", () => {
  it("parses BMKG depth strings", () => {
    expect(parseDepthKm("5 km")).toBe(5);
    expect(parseDepthKm("145 km")).toBe(145);
  });

  it("rejects invalid depth", () => {
    expect(parseDepthKm("")).toBeNull();
  });
});

describe("parseFeltReports", () => {
  it("parses MMI + place pairs", () => {
    expect(parseFeltReports("III Pangalengan, III Kertasari")).toEqual([
      { mmi: "III", place: "Pangalengan" },
      { mmi: "III", place: "Kertasari" },
    ]);
  });

  it("parses MMI ranges", () => {
    expect(parseFeltReports("III-IV Kab. Manggarai")).toEqual([
      { mmi: "III-IV", place: "Kab. Manggarai" },
    ]);
  });

  it("returns empty array without data", () => {
    expect(parseFeltReports(undefined)).toEqual([]);
  });
});

describe("classifyTsunamiPotential", () => {
  it("classifies 'tidak berpotensi tsunami' as false", () => {
    expect(classifyTsunamiPotential("Tidak berpotensi tsunami")).toBe(false);
  });

  it("classifies 'berpotensi tsunami' as true", () => {
    expect(classifyTsunamiPotential("Berpotensi tsunami")).toBe(true);
  });

  it("returns null for non-tsunami notices", () => {
    expect(
      classifyTsunamiPotential(
        "Gempa ini dirasakan untuk diteruskan pada masyarakat",
      ),
    ).toBeNull();
  });

  it("returns null when absent", () => {
    expect(classifyTsunamiPotential(undefined)).toBeNull();
  });
});

describe("parseFeedPayload", () => {
  it("parses autogempa (single object)", () => {
    const events = parseFeedPayload(autogempaFixture, "autogempa");
    expect(events).toHaveLength(1);
    const event = events[0];
    expect(event?.magnitude).toBe(2.9);
    expect(event?.depthKm).toBe(5);
    expect(event?.latitude).toBe(-7.22);
    expect(event?.longitude).toBe(107.62);
    expect(event?.tsunamiPotential).toBeNull();
    expect(event?.potentialText).toContain("dirasakan");
    expect(event?.feltReports).toHaveLength(2);
    expect(event?.shakemapUrl).toBe(
      "https://static.bmkg.go.id/20260916081131.mmi.jpg",
    );
    expect(event?.source).toBe("BMKG");
  });

  it("parses gempaterkini (array)", () => {
    const events = parseFeedPayload(gempaterkiniFixture, "gempaterkini");
    expect(events).toHaveLength(3);
    for (const event of events) {
      expect(event.magnitude).toBeGreaterThanOrEqual(5);
      expect(event.tsunamiPotential).toBe(false);
    }
  });

  it("parses gempadirasakan (array with felt reports)", () => {
    const events = parseFeedPayload(gempadirasakanFixture, "gempadirasakan");
    expect(events).toHaveLength(4);
    const malang = events.find((event) => event.magnitude === 5.2);
    expect(malang?.feltReports.length).toBeGreaterThan(5);
  });

  it("detects tsunami potential from the synthetic fixture", () => {
    const events = parseFeedPayload(tsunamiFixture, "autogempa");
    expect(events[0]?.tsunamiPotential).toBe(true);
  });

  it("skips malformed entries instead of throwing", () => {
    const events = parseFeedPayload(
      { Infogempa: { gempa: [{ Tanggal: "x" }] } },
      "autogempa",
    );
    expect(events).toHaveLength(0);
  });
});
