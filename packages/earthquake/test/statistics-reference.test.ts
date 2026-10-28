import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { countByDay, countByMonth } from "../src/statistics";

const quake = (eventTimeUtc: string) => ({
  eventTimeUtc,
  magnitude: 3,
  depthKm: 10,
  feltText: null,
  tsunamiPotential: null,
});

describe("countByDay and countByMonth without a reference (A-17, D14)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-28T03:00:00.000Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("ends at today's WIB date even when the newest quake is older", () => {
    const days = countByDay([quake("2026-10-20T01:00:00.000Z")], 30);
    expect(days.at(-1)).toEqual({ date: "2026-10-28", count: 0 });
  });

  it("counts a quake at 2026-10-27T17:30:00Z in the WIB day 2026-10-28", () => {
    expect(countByDay([quake("2026-10-27T17:30:00.000Z")], 2)).toEqual([
      { date: "2026-10-27", count: 0 },
      { date: "2026-10-28", count: 1 },
    ]);
  });

  it("lists 12 WIB months with zeros, ending with the current month", () => {
    const months = countByMonth([quake("2026-09-30T17:30:00.000Z"), quake("2025-11-02T00:00:00.000Z")]);
    expect(months).toHaveLength(12);
    expect(months[0]).toEqual({ month: "2025-11", count: 1 });
    expect(months.at(-2)).toEqual({ month: "2026-09", count: 0 });
    expect(months.at(-1)).toEqual({ month: "2026-10", count: 1 });
  });
});
