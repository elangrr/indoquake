import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  parseFeedPayload,
  parseLatitude,
  parseLongitude,
  parseMagnitude,
  parseDepthKm,
  parseWibDateTime,
} from "../src";

const BASE = {
  Tanggal: "16 Sep 2026",
  Jam: "08:11:31 WIB",
  DateTime: "2026-09-16T01:11:31+00:00",
  Coordinates: "-7.22,107.62",
  Lintang: "7.22 LS",
  Bujur: "107.62 BT",
  Magnitude: "2.9",
  Kedalaman: "5 km",
  Wilayah: "Kabupaten Bandung",
};

function feed(...items: object[]) {
  return { Infogempa: { gempa: items } };
}

describe("parseFeedPayload validation (A-01, D08)", () => {
  it.each([
    ["missing DateTime", { DateTime: undefined }, "invalid_datetime"],
    ["malformed DateTime", { DateTime: "kemarin" }, "invalid_datetime"],
    ["no usable coordinates", { Coordinates: "x", Lintang: "?", Bujur: "?" }, "invalid_coordinates"],
    ["missing magnitude", { Magnitude: undefined }, "invalid_magnitude"],
    ["magnitude above 10", { Magnitude: "10.1" }, "invalid_magnitude"],
    ["magnitude below -2", { Magnitude: "-2.5" }, "invalid_magnitude"],
    ["depth above 1000 km", { Kedalaman: "1200 km" }, "invalid_depth"],
  ])("skips and counts an item with %s", (_label, patch, reason) => {
    const parsed = parseFeedPayload(feed(BASE, { ...BASE, ...patch }), "gempaterkini");
    expect(parsed.events).toHaveLength(1);
    expect(parsed.skipped).toBe(1);
    expect(parsed.skipReasons).toEqual([reason]);
  });

  it("derives lat/lon from Lintang/Bujur when Coordinates is absent", () => {
    const parsed = parseFeedPayload(feed({ ...BASE, Coordinates: undefined }), "autogempa");
    expect(parsed.events[0]).toMatchObject({ latitude: -7.22, longitude: 107.62 });
  });

  it.each([
    ["7.22 LS", -7.22],
    ["2.52 LU", 2.52],
    ["0,5 LS", -0.5],
    ["7.22", null],
    ["95 LU", null],
  ])("parseLatitude(%s) = %s", (text, expected) => {
    expect(parseLatitude(text)).toBe(expected);
  });

  it.each([
    ["107.62 BT", 107.62],
    ["10.5 BB", -10.5],
    ["181 BT", null],
  ])("parseLongitude(%s) = %s", (text, expected) => {
    expect(parseLongitude(text)).toBe(expected);
  });

  it.each([
    ["5,5", 5.5],
    ["10", 10],
    ["11", null],
  ])("parseMagnitude(%s) = %s", (text, expected) => {
    expect(parseMagnitude(text)).toBe(expected);
  });

  it("parseDepthKm accepts 0 to 1000 km only", () => {
    expect([parseDepthKm("0 km"), parseDepthKm("1000 km"), parseDepthKm("1001 km")]).toEqual([0, 1000, null]);
  });

  it("reports a Tanggal/Jam that disagrees with DateTime by more than 2 s", () => {
    const parsed = parseFeedPayload(feed({ ...BASE, Jam: "08:11:34 WIB" }), "autogempa");
    expect(parsed.events).toHaveLength(1);
    expect(parsed.warnings).toEqual(["time_mismatch: 16 Sep 2026 08:11:34 WIB vs 2026-09-16T01:11:31.000Z"]);
  });

  it("accepts a 2 s difference without a warning", () => {
    expect(parseFeedPayload(feed({ ...BASE, Jam: "08:11:33 WIB" }), "autogempa").warnings).toEqual([]);
  });
});

describe("parseWibDateTime (D09)", () => {
  it.each([
    ["01 Jan 2026", "2025-12-31T17:00:00.000Z"],
    ["01 Feb 2026", "2026-01-31T17:00:00.000Z"],
    ["01 Mar 2026", "2026-02-28T17:00:00.000Z"],
    ["01 Apr 2026", "2026-03-31T17:00:00.000Z"],
    ["01 Mei 2026", "2026-04-30T17:00:00.000Z"],
    ["01 Jun 2026", "2026-05-31T17:00:00.000Z"],
    ["01 Jul 2026", "2026-06-30T17:00:00.000Z"],
    ["01 Agu 2026", "2026-07-31T17:00:00.000Z"],
    ["01 Sep 2026", "2026-08-31T17:00:00.000Z"],
    ["01 Okt 2026", "2026-09-30T17:00:00.000Z"],
    ["01 Nov 2026", "2026-10-31T17:00:00.000Z"],
    ["01 Des 2026", "2026-11-30T17:00:00.000Z"],
  ])("WIB 00:00 on %s is the previous UTC day (%s)", (tanggal, iso) => {
    expect(parseWibDateTime(tanggal, "00:00:00 WIB")?.toISOString()).toBe(iso);
  });

  it.each([
    ["31 Feb 2026", "10:00:00 WIB"],
    ["12 Foo 2026", "10:00:00 WIB"],
    ["12 Sep 2026", "24:00:00 WIB"],
  ])("rejects %s %s", (tanggal, jam) => {
    expect(parseWibDateTime(tanggal, jam)).toBeNull();
  });

  const ID_MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

  it("round-trips any UTC second through the WIB text (property)", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: Date.UTC(2000, 0, 1) / 1000, max: Date.UTC(2099, 11, 31) / 1000 }),
        (seconds) => {
          const wib = new Date(seconds * 1000 + 7 * 3_600_000);
          const pad = (value: number) => String(value).padStart(2, "0");
          const tanggal = `${pad(wib.getUTCDate())} ${ID_MONTHS[wib.getUTCMonth()]} ${wib.getUTCFullYear()}`;
          const jam = `${pad(wib.getUTCHours())}:${pad(wib.getUTCMinutes())}:${pad(wib.getUTCSeconds())} WIB`;
          expect(parseWibDateTime(tanggal, jam)?.getTime()).toBe(seconds * 1000);
        },
      ),
      { seed: 133, numRuns: 100 },
    );
  });
});

describe("BMKG coordinate strings (property)", () => {
  it("parse back to the signed value for any hemisphere and 2 decimals", () => {
    fc.assert(
      fc.property(fc.integer({ min: -9000, max: 9000 }), fc.integer({ min: -18000, max: 18000 }), (lat100, lon100) => {
        const lat = lat100 / 100;
        const lon = lon100 / 100;
        const lintang = `${Math.abs(lat).toFixed(2)} ${lat < 0 ? "LS" : "LU"}`;
        const bujur = `${Math.abs(lon).toFixed(2)} ${lon < 0 ? "BB" : "BT"}`;
        expect(parseLatitude(lintang)).toBe(Math.abs(lat) === 0 ? 0 : lat);
        expect(parseLongitude(bujur)).toBe(Math.abs(lon) === 0 ? 0 : lon);
      }),
      { seed: 133, numRuns: 100 },
    );
  });
});
