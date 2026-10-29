import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  PROVINCE_OPTIONS,
  ZONES,
  areaLabel,
  formatZoned,
  wibDayEndUtc,
  wibDayOf,
  wibDayStartUtc,
  zoneOfEvent,
  zoneOfProvince,
} from "@indoquake/regions/meta";

describe("zone per province (AC 2, D18)", () => {
  it("maps every slug to its zone", () => {
    expect(Object.fromEntries(PROVINCE_OPTIONS.map((province) => [province.slug, zoneOfProvince(province.slug)]))).toEqual({
      aceh: "WIB",
      "sumatera-utara": "WIB",
      "sumatera-barat": "WIB",
      riau: "WIB",
      "kepulauan-riau": "WIB",
      jambi: "WIB",
      "sumatera-selatan": "WIB",
      "kepulauan-bangka-belitung": "WIB",
      bengkulu: "WIB",
      lampung: "WIB",
      banten: "WIB",
      "dki-jakarta": "WIB",
      "jawa-barat": "WIB",
      "jawa-tengah": "WIB",
      "di-yogyakarta": "WIB",
      "jawa-timur": "WIB",
      bali: "WITA",
      "nusa-tenggara-barat": "WITA",
      "nusa-tenggara-timur": "WITA",
      "kalimantan-barat": "WIB",
      "kalimantan-tengah": "WIB",
      "kalimantan-selatan": "WITA",
      "kalimantan-timur": "WITA",
      "kalimantan-utara": "WITA",
      "sulawesi-utara": "WITA",
      gorontalo: "WITA",
      "sulawesi-tengah": "WITA",
      "sulawesi-barat": "WITA",
      "sulawesi-selatan": "WITA",
      "sulawesi-tenggara": "WITA",
      maluku: "WIT",
      "maluku-utara": "WIT",
      papua: "WIT",
      "papua-barat": "WIT",
      "papua-selatan": "WIT",
      "papua-tengah": "WIT",
      "papua-pegunungan": "WIT",
      "papua-barat-daya": "WIT",
    });
  });

  it("counts WIB 18, WITA 12, WIT 8", () => {
    expect([
      PROVINCE_OPTIONS.filter((province) => province.zone === "WIB").length,
      PROVINCE_OPTIONS.filter((province) => province.zone === "WITA").length,
      PROVINCE_OPTIONS.filter((province) => province.zone === "WIT").length,
    ]).toEqual([18, 12, 8]);
  });

  it.each([
    ["aceh", "WIB"],
    ["jawa-barat", "WIB"],
    ["bali", "WITA"],
    ["sulawesi-selatan", "WITA"],
    ["papua", "WIT"],
    ["maluku", "WIT"],
  ])("zoneOfProvince(%s) is %s", (slug, zone) => {
    expect(zoneOfProvince(slug)).toBe(zone);
  });

  it("returns null for an unknown slug", () => {
    expect(zoneOfProvince("atlantis")).toBeNull();
  });

  it("labels the three zones with their offsets", () => {
    expect(ZONES).toEqual({
      WIB: { id: "WIB", offsetHours: 7, label: "WIB UTC+7" },
      WITA: { id: "WITA", offsetHours: 8, label: "WITA UTC+8" },
      WIT: { id: "WIT", offsetHours: 9, label: "WIT UTC+9" },
    });
  });
});

describe("formatZoned (AC 3)", () => {
  it.each([
    ["2026-10-27T16:30:00.000Z", "WIB", "dateTime", "27 Okt 2026, 23:30 WIB"],
    ["2026-10-27T16:30:00.000Z", "WIT", "dateTime", "28 Okt 2026, 01:30 WIT"],
    ["2026-09-16T01:11:31.000Z", "WITA", "clock", "09:11:31 WITA"],
    ["2026-09-16T01:11:31.000Z", "WIB", "clock", "08:11:31 WIB"],
    ["2026-10-27T17:30:00.000Z", "WIB", "clock", "00:30:00 WIB"],
    ["2026-09-16T01:11:31.000Z", "WIT", "hourMinute", "10:11 WIT"],
    ["2026-10-27T17:30:00.000Z", "WIB", "dateTime", "28 Okt 2026, 00:30 WIB"],
    ["2026-09-16T01:11:31.000Z", "WIB", "long", "Rabu, 16 September 2026 08:11:31 WIB"],
  ] as const)("%s in %s as %s is %s", (iso, zone, style, text) => {
    expect(formatZoned(iso, zone, style)).toBe(text);
  });

  it("prints the local hour as (UTC hour + offset) mod 24", () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date("2000-01-01"), max: new Date("2099-12-31"), noInvalidDate: true }),
        fc.constantFrom("WIB" as const, "WITA" as const, "WIT" as const),
        (date, zone) => {
          const hour = Number(formatZoned(date.toISOString(), zone, "clock").slice(0, 2));
          expect(hour).toBe((date.getUTCHours() + ZONES[zone].offsetHours) % 24);
        },
      ),
      { seed: 137, numRuns: 100 },
    );
  });
});

describe("WIB day bounds (ported from web wib.test.ts)", () => {
  it.each([
    ["2026-10-28", "2026-10-27T17:00:00.000Z", "2026-10-28T16:59:59.999Z"],
    ["2026-01-01", "2025-12-31T17:00:00.000Z", "2026-01-01T16:59:59.999Z"],
  ])("%s spans %s to %s", (day, start, end) => {
    expect([wibDayStartUtc(day), wibDayEndUtc(day)]).toEqual([start, end]);
  });

  it.each(["2026-02-30", "28-10-2026", "", "2026-13-01"])("rejects %j", (day) => {
    expect(wibDayStartUtc(day)).toBeNull();
  });

  it("puts 17:30 UTC on the next WIB day", () => {
    expect(wibDayOf("2026-10-27T17:30:00.000Z")).toBe("2026-10-28");
  });

  it("round trips: both bounds of a day fall on that WIB day", () => {
    fc.assert(
      fc.property(fc.date({ min: new Date("2000-01-01"), max: new Date("2099-12-31"), noInvalidDate: true }), (date) => {
        const day = date.toISOString().slice(0, 10);
        expect([wibDayOf(wibDayStartUtc(day)!), wibDayOf(wibDayEndUtc(day)!)]).toEqual([day, day]);
      }),
      { seed: 133, numRuns: 100 },
    );
  });
});

describe("zoneOfEvent and areaLabel (AC 4)", () => {
  it.each([
    [{ zone: "WITA", provinceSlug: "papua", nearestProvinceSlug: "aceh" }, "WITA"],
    [{ provinceSlug: "papua", nearestProvinceSlug: "aceh" }, "WIT"],
    [{ provinceSlug: null, nearestProvinceSlug: "bali" }, "WITA"],
    [{ provinceSlug: "atlantis" }, "WIB"],
    [{}, "WIB"],
  ])("zoneOfEvent(%j) is %s", (event, zone) => {
    expect(zoneOfEvent(event)).toBe(zone);
  });

  it.each([
    [{ areaKind: "land", provinceName: "Papua" }, "Papua"],
    [{ areaKind: "sea", nearestProvinceName: "Maluku", nearestProvinceKm: 120 }, "Perairan dekat Maluku"],
    [{ areaKind: "sea", nearestProvinceName: "Maluku", nearestProvinceKm: 300 }, "Perairan dekat Maluku"],
    [{ areaKind: "sea", nearestProvinceName: "Bengkulu", nearestProvinceKm: 1450 }, "Laut/Perairan"],
    [{ areaKind: null, provinceName: "Jawa Barat" }, "Jawa Barat"],
    [{ areaKind: null, provinceName: null }, "Wilayah belum ditentukan"],
  ] as const)("areaLabel(%j) is %s", (event, label) => {
    expect(areaLabel(event)).toBe(label);
  });
});
