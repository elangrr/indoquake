import { describe, expect, it } from "vitest";
import { formatAlertMessage, formatStartMessage } from "../src/format";
import type { AlertEvent } from "../src/matching";

const event: AlertEvent = {
  eventKey: "abc",
  magnitude: 5.7,
  depthKm: 31,
  latitude: -8.5,
  longitude: 110,
  regionName: "82 km selatan Cilacap",
  eventTimeWib: "16 Sep 2026 20:11:31 WIB",
  feltText: "III Cilacap",
  tsunamiPotential: true,
  provinceSlug: "jawa-tengah",
};

describe("formatAlertMessage", () => {
  it("includes official data and attribution", () => {
    const message = formatAlertMessage(event, { distanceKm: 143 });
    expect(message).toContain("M5.7");
    expect(message).toContain("Cilacap");
    expect(message).toContain("143 km");
    expect(message).toContain("BMKG");
    expect(message).toContain("bukan peringatan resmi");
  });

  it("warns about tsunami potential from BMKG", () => {
    const message = formatAlertMessage(event);
    expect(message).toContain("BERPOTENSI TSUNAMI");
    expect(message).toContain("BMKG/BPBD");
  });

  it("does not claim official warning status", () => {
    const message = formatAlertMessage({ ...event, tsunamiPotential: false });
    expect(message).not.toContain("BERPOTENSI TSUNAMI");
    expect(message).toContain("bukan peringatan resmi");
  });
});

describe("formatAlertMessage with zone time and area label (AC 21)", () => {
  it("prints the area label line and the zoned time instead of the BMKG WIB text", () => {
    const message = formatAlertMessage({
      ...event,
      areaLabel: "Perairan dekat Jawa Tengah",
      eventTimeText: "Rabu, 16 September 2026 20:11:31 WIB",
    });
    expect(message).toContain("M5.7 · 82 km selatan Cilacap\nWilayah: Perairan dekat Jawa Tengah\nKedalaman 31 km · Rabu, 16 September 2026 20:11:31 WIB");
  });

  it("falls back to the BMKG text without zone fields", () => {
    expect(formatAlertMessage(event)).toContain("M5.7 · 82 km selatan Cilacap\nKedalaman 31 km · 16 Sep 2026 20:11:31 WIB");
  });
});

describe("formatStartMessage", () => {
  it("names Indonesia (AC 21)", () => {
    expect(formatStartMessage().split("\n")[0]).toBe("🌏 Indoquake — bot gempa & tsunami Indonesia");
  });

  it("lists the available commands", () => {
    const message = formatStartMessage();
    expect(message).toContain("/terbaru");
    expect(message).toContain("/tsunami");
  });
});
