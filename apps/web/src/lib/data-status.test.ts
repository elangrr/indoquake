import { describe, expect, it } from "vitest";
import type { HealthResponse } from "@indoquake/shared";
import { deriveIndicator, freshnessFromHealth, freshnessState } from "./data-status";

const NOW = Date.parse("2026-10-28T03:20:00Z");

describe("deriveIndicator", () => {
  it.each([
    ["fresh", "open", "Langsung"],
    ["stale", "open", "Tertunda"],
    ["down", "open", "Terputus"],
    ["fresh", "closed", "Terputus"],
    ["unknown", "open", "Belum ada data"],
    [null, "connecting", "Belum ada data"],
  ] as const)("state %s with stream %s reads %s", (state, connection, label) => {
    expect(deriveIndicator(state, connection).label).toBe(label);
  });
});

describe("freshnessState", () => {
  it.each([
    ["2026-10-28T03:18:30Z", "fresh"],
    ["2026-10-28T03:18:29Z", "stale"],
    ["2026-10-28T03:10:00Z", "stale"],
    ["2026-10-28T03:09:59Z", "down"],
    [null, "unknown"],
  ] as const)("last success %s is %s", (lastSuccessAt, state) => {
    expect(freshnessState(lastSuccessAt, NOW)).toBe(state);
  });
});

describe("freshnessFromHealth", () => {
  const base: HealthResponse = {
    status: "ok",
    time: "2026-10-28T03:20:00Z",
    checks: {
      database: { ok: true, latencyMs: 3, error: null },
      redis: { ok: true, error: null },
    },
    earthquakes: { count: 412, latestEventAt: "2026-10-28T02:51:40.000Z" },
    worker: null,
  };

  it("uses the server data block when present", () => {
    const data = {
      state: "stale" as const,
      lastSuccessAt: "2026-10-28T03:16:00.000Z",
      ageSeconds: 240,
      latestEventAt: "2026-10-28T02:51:40.000Z",
    };
    expect(freshnessFromHealth({ ...base, data }, NOW)).toEqual(data);
  });

  it("reads lastSuccessAt from the heartbeat on an older server, not the worker cycle time", () => {
    const worker = {
      at: "2026-10-28T03:19:58.000Z",
      ok: false,
      lastSuccessAt: "2026-10-28T03:12:00.000Z",
      feeds: {
        autogempa: { fetched: false, events: 0 },
        gempaterkini: { fetched: false, events: 0 },
        gempadirasakan: { fetched: false, events: 0 },
      },
    };
    expect(freshnessFromHealth({ ...base, worker }, NOW)).toEqual({
      state: "stale",
      lastSuccessAt: "2026-10-28T03:12:00.000Z",
      ageSeconds: 480,
      latestEventAt: "2026-10-28T02:51:40.000Z",
    });
  });

  it("is down when the heartbeat is missing and events are stored", () => {
    expect(freshnessFromHealth(base, NOW).state).toBe("down");
  });
});
