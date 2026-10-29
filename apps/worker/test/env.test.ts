import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/env";

const REQUIRED = { DATABASE_URL: "postgres://db", REDIS_URL: "redis://cache" };

describe("loadConfig", () => {
  it("defaults to per-feed intervals 10/20/30 s, keep-all retention and 72 h event log", () => {
    expect(loadConfig(REQUIRED)).toMatchObject({
      pollIntervalsSeconds: { autogempa: 10, gempaterkini: 20, gempadirasakan: 30 },
      retentionDays: 0,
      eventLogRetentionHours: 72,
      bmkgBaseUrl: "https://data.bmkg.go.id/DataMKG/TEWS",
    });
  });

  it("lets the legacy BMKG_POLL_INTERVAL_SECONDS override all three feeds", () => {
    const config = loadConfig({ ...REQUIRED, BMKG_POLL_INTERVAL_SECONDS: "45", BMKG_POLL_AUTOGEMPA_SECONDS: "12" });
    expect(config.pollIntervalsSeconds).toEqual({ autogempa: 45, gempaterkini: 45, gempadirasakan: 45 });
  });

  it("floors per-feed intervals at 5 s", () => {
    expect(loadConfig({ ...REQUIRED, BMKG_POLL_AUTOGEMPA_SECONDS: "1" }).pollIntervalsSeconds.autogempa).toBe(5);
  });

  it.each([
    [undefined, true],
    ["on", true],
    ["off", false],
    [" OFF ", false],
  ])("REGION_BACKFILL=%s runs the region backfill: %s", (value, expected) => {
    expect(loadConfig({ ...REQUIRED, REGION_BACKFILL: value }).regionBackfill).toBe(expected);
  });

  it("keeps RETENTION_DAYS when it is positive", () => {
    expect(loadConfig({ ...REQUIRED, RETENTION_DAYS: "30" }).retentionDays).toBe(30);
  });
});
