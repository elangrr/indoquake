import { describe, expect, it } from "vitest";
import { formatAlertMessage, matchesSubscription, NEAR_SEA_MATCH_KM } from "@indoquake/notifications";
import { NEAR_SEA_MAX_KM } from "@indoquake/regions";
import type { EarthquakeEvent } from "@indoquake/shared";
import { toAlertEvent } from "../src/notify";

function stored(latitude: number, longitude: number): EarthquakeEvent {
  return {
    eventKey: "00000000000000ab",
    eventTimeUtc: "2026-10-28T11:55:00.000Z",
    eventTimeWib: "28 Okt 2026 18:55:00 WIB",
    latitude,
    longitude,
    depthKm: 10,
    magnitude: 5.1,
    regionName: "BMKG region text",
    potentialText: null,
    tsunamiPotential: false,
    feltText: null,
    shakemapUrl: null,
    source: "autogempa",
    provinceSlug: null,
    provinceName: null,
  } as EarthquakeEvent;
}

const subscription = {
  id: 1,
  channel: "telegram",
  target: "1",
  minMagnitude: 4.5,
  maxDistanceKm: null,
  tsunamiOnly: false,
  feltOnly: false,
  locationLatitude: null,
  locationLongitude: null,
};

describe("toAlertEvent + formatAlertMessage (AC 21)", () => {
  it("a Jayapura event is land papua and prints its time in WIT", () => {
    const alert = toAlertEvent(stored(-2.5337, 140.7181));
    expect(alert).toMatchObject({
      provinceSlug: "papua",
      nearestProvinceSlug: null,
      nearestProvinceKm: null,
      zone: "WIT",
      eventTimeUtc: "2026-10-28T11:55:00.000Z",
      eventTimeText: "Rabu, 28 Oktober 2026 20:55:00 WIT",
      areaLabel: "Papua",
    });
    const message = formatAlertMessage(alert);
    expect(message).toContain("Wilayah: Papua\nKedalaman 10 km · Rabu, 28 Oktober 2026 20:55:00 WIT");
    expect(message).toContain("Sumber data: BMKG. Ini notifikasi aplikasi, bukan peringatan resmi.");
  });

  it("a Denpasar event prints WITA", () => {
    expect(formatAlertMessage(toAlertEvent(stored(-8.6705, 115.2126)))).toContain(
      "Wilayah: Bali\nKedalaman 10 km · Rabu, 28 Oktober 2026 19:55:00 WITA",
    );
  });

  it("an event 100 km south of Bali is sea near Bali and matches a Bali subscription", () => {
    const alert = toAlertEvent(stored(-9.6, 115.2));
    expect(alert).toMatchObject({ provinceSlug: null, nearestProvinceSlug: "bali", nearestProvinceKm: 83, zone: "WITA" });
    expect(formatAlertMessage(alert)).toContain("Wilayah: Perairan dekat Bali\n");
    expect(matchesSubscription({ ...subscription, provinceSlug: "bali" }, alert, null)).toBe(true);
    expect(matchesSubscription({ ...subscription, provinceSlug: "jawa-timur" }, alert, null)).toBe(false);
  });

  it("far sea reads Laut/Perairan in the nearest province's zone", () => {
    expect(toAlertEvent(stored(-20, 100))).toMatchObject({ nearestProvinceSlug: "banten", nearestProvinceKm: 1546, zone: "WIB", areaLabel: "Laut/Perairan" });
  });

  it("the notification sea limit equals the regions NEAR_SEA_MAX_KM", () => {
    expect(NEAR_SEA_MATCH_KM).toBe(NEAR_SEA_MAX_KM);
  });
});
