import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { formatWibClock, formatWibDateTime, wibDayEndUtc, wibDayOf, wibDayStartUtc } from "./wib";

describe("WIB formatting from UTC", () => {
  it.each([
    ["2026-09-16T01:11:31.000Z", "08:11:31 WIB"],
    ["2026-10-27T17:30:00.000Z", "00:30:00 WIB"],
  ])("%s shows %s", (iso, text) => {
    expect(formatWibClock(iso)).toBe(text);
  });

  it("shows the WIB date, which is the next day for 17:30 UTC", () => {
    expect(formatWibDateTime("2026-10-27T17:30:00.000Z")).toBe("28 Okt 2026, 00:30 WIB");
  });
});

describe("WIB day bounds", () => {
  it.each([
    ["2026-10-28", "2026-10-27T17:00:00.000Z", "2026-10-28T16:59:59.999Z"],
    ["2026-01-01", "2025-12-31T17:00:00.000Z", "2026-01-01T16:59:59.999Z"],
  ])("%s spans %s to %s", (day, start, end) => {
    expect([wibDayStartUtc(day), wibDayEndUtc(day)]).toEqual([start, end]);
  });

  it.each(["2026-02-30", "28-10-2026", "", "2026-13-01"])("rejects %j", (day) => {
    expect(wibDayStartUtc(day)).toBeNull();
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
