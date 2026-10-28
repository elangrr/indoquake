import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EarthquakeEvent } from "@indoquake/shared";
import { createLiveFeed, type EventSourceLike } from "./live-feed";

class FakeSource implements EventSourceLike {
  static opened: FakeSource[] = [];
  listeners = new Map<string, ((event: MessageEvent<string>) => void)[]>();
  onerror: ((event: Event) => void) | null = null;
  closed = false;
  constructor(public url: string) {
    FakeSource.opened.push(this);
  }
  addEventListener(type: string, listener: (event: MessageEvent<string>) => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }
  close() {
    this.closed = true;
  }
  emit(type: string, data: unknown, lastEventId = "") {
    const event = { data: JSON.stringify(data), lastEventId } as MessageEvent<string>;
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }
  fail() {
    this.onerror?.(new Event("error"));
  }
}

const QUAKE: EarthquakeEvent = {
  eventKey: "3f9a1c2b4d5e6f70",
  eventTimeUtc: "2026-10-28T03:12:09.000Z",
  eventTimeWib: "28 Okt 2026 10:12:09 WIB",
  latitude: -7.81,
  longitude: 110.36,
  depthKm: 11,
  magnitude: 4.3,
  regionName: "Pusat gempa berada di darat 12 km BaratDaya Bantul",
  potentialText: "Tidak berpotensi tsunami",
  tsunamiPotential: false,
  feltText: null,
  shakemapUrl: null,
  source: "BMKG",
};

function start(onResync = vi.fn()) {
  const onEarthquake = vi.fn();
  const onConnection = vi.fn();
  const feed = createLiveFeed({
    createSource: (url) => new FakeSource(url),
    onEarthquake,
    onConnection,
    onResync,
  });
  return { feed, onEarthquake, onConnection, onResync };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-28T03:20:00Z"));
  FakeSource.opened = [];
});
afterEach(() => {
  vi.useRealTimers();
});

describe("createLiveFeed", () => {
  it("opens the stream path without lastEventId on first connect", () => {
    start();
    expect(FakeSource.opened.map((s) => s.url)).toEqual(["/api/v1/stream"]);
  });

  it("reopens with ?lastEventId of the last seen frame after an error", () => {
    start();
    const first = FakeSource.opened[0];
    first.emit("ready", { at: "2026-10-28T03:20:00Z", lastEventId: 40 });
    first.emit("earthquake", { type: "earthquake:new", event: QUAKE, seq: 41 }, "41");
    first.fail();
    vi.advanceTimersByTime(3_000);
    expect(first.closed).toBe(true);
    expect(FakeSource.opened.map((s) => s.url)).toEqual([
      "/api/v1/stream",
      "/api/v1/stream?lastEventId=41",
    ]);
  });

  it("backs off 3 s, 6 s, 12 s, then 30 s when every reopen fails (503 cap)", () => {
    start();
    const opensAfter = (ms: number) => {
      FakeSource.opened.at(-1)!.fail();
      vi.advanceTimersByTime(ms - 1);
      const before = FakeSource.opened.length;
      vi.advanceTimersByTime(1);
      return FakeSource.opened.length - before;
    };
    expect([opensAfter(3_000), opensAfter(6_000), opensAfter(12_000), opensAfter(30_000), opensAfter(30_000)]).toEqual([
      1, 1, 1, 1, 1,
    ]);
  });

  it("does not open a second source when errors repeat before the reopen fires", () => {
    start();
    FakeSource.opened[0].fail();
    FakeSource.opened[0].fail();
    FakeSource.opened[0].fail();
    vi.advanceTimersByTime(3_000);
    expect(FakeSource.opened).toHaveLength(2);
  });

  it("resets the backoff after a ready frame", () => {
    start();
    FakeSource.opened[0].fail();
    vi.advanceTimersByTime(3_000);
    FakeSource.opened[1].fail();
    vi.advanceTimersByTime(6_000);
    FakeSource.opened[2].emit("ready", { at: "2026-10-28T03:20:09Z", lastEventId: 7 });
    FakeSource.opened[2].fail();
    vi.advanceTimersByTime(3_000);
    expect(FakeSource.opened).toHaveLength(4);
  });

  it("closes and reopens after 45 s without any frame", () => {
    start();
    FakeSource.opened[0].emit("ready", { at: "2026-10-28T03:20:00Z", lastEventId: 3 });
    vi.advanceTimersByTime(44_999);
    expect(FakeSource.opened[0].closed).toBe(false);
    vi.advanceTimersByTime(1);
    expect(FakeSource.opened[0].closed).toBe(true);
    vi.advanceTimersByTime(3_000);
    expect(FakeSource.opened.map((s) => s.url)).toEqual(["/api/v1/stream", "/api/v1/stream?lastEventId=3"]);
  });

  it("keeps the stream when pings arrive inside the silence window", () => {
    start();
    const source = FakeSource.opened[0];
    source.emit("ready", { at: "2026-10-28T03:20:00Z", lastEventId: 3 });
    vi.advanceTimersByTime(30_000);
    source.emit("ping", { at: "2026-10-28T03:20:30Z" });
    vi.advanceTimersByTime(30_000);
    expect(source.closed).toBe(false);
  });

  it("calls onResync once per resync frame", () => {
    const { onResync } = start();
    FakeSource.opened[0].emit("resync", { reason: "too-old" });
    expect(onResync).toHaveBeenCalledTimes(1);
  });

  it("reopens with the ready id after a resync instead of resending the stale id", () => {
    start();
    FakeSource.opened[0].emit("ready", { at: "2026-10-28T03:20:00Z", lastEventId: 3 });
    FakeSource.opened[0].fail();
    vi.advanceTimersByTime(3_000);
    FakeSource.opened[1].emit("ready", { at: "2026-10-28T03:20:03Z", lastEventId: 90 });
    FakeSource.opened[1].emit("resync", { reason: "too-old" });
    FakeSource.opened[1].fail();
    vi.advanceTimersByTime(3_000);
    expect(FakeSource.opened.map((s) => s.url)).toEqual([
      "/api/v1/stream",
      "/api/v1/stream?lastEventId=3",
      "/api/v1/stream?lastEventId=90",
    ]);
  });

  it("drops an earthquake frame whose seq was already delivered", () => {
    const { onEarthquake } = start();
    const source = FakeSource.opened[0];
    source.emit("earthquake", { type: "earthquake:new", event: QUAKE, seq: 9 }, "9");
    source.emit("earthquake", { type: "earthquake:new", event: QUAKE, seq: 9 }, "9");
    expect(onEarthquake).toHaveBeenCalledTimes(1);
  });

  it("refetches after a reconnect that took longer than 6 hours", () => {
    const { onResync } = start();
    FakeSource.opened[0].emit("ready", { at: "2026-10-28T03:20:00Z", lastEventId: 3 });
    FakeSource.opened[0].fail();
    vi.setSystemTime(new Date("2026-10-28T09:21:00Z"));
    vi.advanceTimersByTime(3_000);
    FakeSource.opened[1].emit("ready", { at: "2026-10-28T09:21:03Z", lastEventId: 90 });
    expect(onResync).toHaveBeenCalledTimes(1);
  });

  it("close() closes the source and clears every timer", () => {
    const { feed } = start();
    FakeSource.opened[0].fail();
    feed.close();
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(60_000);
    expect(FakeSource.opened).toHaveLength(1);
  });
});
