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

describe("formatStartMessage", () => {
  it("lists the available commands", () => {
    const message = formatStartMessage();
    expect(message).toContain("/terbaru");
    expect(message).toContain("/tsunami");
  });
});
