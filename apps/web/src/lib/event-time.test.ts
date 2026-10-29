import { describe, expect, it } from "vitest";
import { eventAreaLabel, formatEventTime } from "./event-time";

const AT = "2026-10-27T16:30:00.000Z";

describe("formatEventTime", () => {
  it.each([
    ["papua land event", { eventTimeUtc: AT, zone: "WIT" as const, provinceSlug: "papua" }, "28 Okt 2026, 01:30 WIT"],
    ["kupang event", { eventTimeUtc: AT, zone: "WITA" as const, provinceSlug: "nusa-tenggara-timur" }, "28 Okt 2026, 00:30 WITA"],
    ["legacy payload with a province and no zone", { eventTimeUtc: AT, provinceSlug: "maluku" }, "28 Okt 2026, 01:30 WIT"],
    ["legacy payload with no province and no zone", { eventTimeUtc: AT }, "27 Okt 2026, 23:30 WIB"],
    ["sea event without zone uses the nearest province", { eventTimeUtc: AT, provinceSlug: null, nearestProvinceSlug: "bali" }, "28 Okt 2026, 00:30 WITA"],
  ])("shows a %s in its own zone", (_name, event, expected) => {
    expect(formatEventTime(event, "dateTime")).toBe(expected);
  });

  it("formats another instant of the same event in the event zone", () => {
    expect(formatEventTime({ eventTimeUtc: AT, zone: "WITA" }, "clock", "2026-10-27T16:35:09.000Z")).toBe("00:35:09 WITA");
  });
});

describe("eventAreaLabel", () => {
  it.each([
    ["land", { areaKind: "land" as const, provinceName: "Papua Barat Daya" }, "Papua Barat Daya"],
    ["near sea", { areaKind: "sea" as const, provinceName: null, nearestProvinceName: "Maluku", nearestProvinceKm: 120 }, "Perairan dekat Maluku"],
    ["far sea", { areaKind: "sea" as const, provinceName: null, nearestProvinceName: "Aceh", nearestProvinceKm: 1400 }, "Laut/Perairan"],
    ["legacy row with a province", { areaKind: null, provinceName: "Jawa Timur" }, "Jawa Timur"],
  ])("labels a %s event", (_name, event, expected) => {
    expect(eventAreaLabel(event)).toBe(expected);
  });

  it("returns null when the area is not known", () => {
    expect(eventAreaLabel({ areaKind: null, provinceName: null })).toBeNull();
  });
});
