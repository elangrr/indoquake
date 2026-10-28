import { describe, expect, it } from "vitest";
import type { WorkerHeartbeat } from "@indoquake/shared";
import { buildHealth, computeFreshness } from "../src";

const NOW = Date.parse("2026-10-28T12:00:00.000Z");
const beat = (lastSuccessAt: string | null): WorkerHeartbeat => ({
  at: "2026-10-28T11:59:59.000Z",
  ok: true,
  lastSuccessAt,
  feeds: {
    autogempa: { fetched: true, events: 0 },
    gempaterkini: { fetched: true, events: 0 },
    gempadirasakan: { fetched: true, events: 0 },
  },
});

describe("computeFreshness (A-10, A-16)", () => {
  it.each([
    ["2026-10-28T11:59:00.000Z", "fresh", 60],
    ["2026-10-28T11:58:30.000Z", "fresh", 90],
    ["2026-10-28T11:58:29.000Z", "stale", 91],
    ["2026-10-28T11:55:00.000Z", "stale", 300],
    ["2026-10-28T11:49:59.000Z", "down", 601],
  ])("last success at %s is %s", (lastSuccessAt, state, ageSeconds) => {
    expect(computeFreshness({ heartbeat: beat(lastSuccessAt), eventCount: 5, latestEventAt: null, nowMs: NOW })).toEqual({
      state,
      lastSuccessAt,
      ageSeconds,
      latestEventAt: null,
    });
  });

  it.each([
    [5, "down"],
    [0, "unknown"],
  ])("without a heartbeat and %i stored quakes the state is %s", (eventCount, state) => {
    expect(computeFreshness({ heartbeat: null, eventCount, latestEventAt: null, nowMs: NOW }).state).toBe(state);
  });
});

describe("buildHealth (A-16, D12)", () => {
  const totals = async () => ({ count: 3, latestEventAt: "2026-10-28T11:00:00.000Z" });

  it("answers 200 with data.state stale when BMKG failed for 5 min but DB and Redis are up", async () => {
    const heartbeat = beat("2026-10-28T11:55:00.000Z");
    const health = await buildHealth({ totals, heartbeat: async () => heartbeat, now: () => NOW });
    expect(health.status).toBe(200);
    expect(health.body).toMatchObject({ status: "ok", worker: heartbeat, data: { state: "stale" } });
    expect(health.body.earthquakes.latestEventAt).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);
  });

  it.each([
    ["the database", { totals: async () => Promise.reject(new Error("ECONNREFUSED 5432")), heartbeat: async () => null }],
    ["Redis", { totals, heartbeat: async () => Promise.reject(new Error("ECONNREFUSED 6379")) }],
  ])("answers 503 without internal error text when %s is down", async (_label, sources) => {
    const health = await buildHealth({ ...sources, now: () => NOW });
    expect(health.status).toBe(503);
    expect(health.body.status).toBe("degraded");
    expect(JSON.stringify(health.body)).not.toContain("ECONNREFUSED");
  });
});
