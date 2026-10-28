import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EarthquakeStreamPayload, StatusPayload } from "@indoquake/shared";
import { clientIp, StreamHub, type EventLogReader } from "../src";

const T0 = Date.parse("2026-10-28T12:00:00.000Z");
const STATUS: StatusPayload = {
  state: "fresh",
  lastSuccessAt: "2026-10-28T11:59:55.000Z",
  ageSeconds: 5,
  latestEventAt: null,
  at: "2026-10-28T12:00:00.000Z",
};

function payload(seq: number): EarthquakeStreamPayload {
  return {
    type: "earthquake:new",
    seq,
    event: {
      eventKey: `00000000000000${String(seq).padStart(2, "0")}`,
      eventTimeUtc: "2026-10-28T11:59:00.000Z",
      eventTimeWib: "28 Okt 2026 18:59:00 WIB",
      latitude: -7.2,
      longitude: 107.6,
      depthKm: 10,
      magnitude: 4,
      regionName: "Bandung",
      potentialText: null,
      tsunamiPotential: null,
      feltText: null,
      shakemapUrl: null,
      source: "BMKG",
      provinceSlug: "jawa-barat",
      firstSeenAt: "2026-10-28T11:59:10.000Z",
    },
  };
}

/** In-memory event_log with ids 1..n; rows below `oldestRetained` are outside the 6 h window. */
function fakeLog(initial: number, oldestRetained = 1) {
  const rows = Array.from({ length: initial }, (_unused, index) => index + 1);
  const log: EventLogReader & { append: () => void } = {
    newestId: async () => rows.at(-1) ?? null,
    replayWindow: async (afterId) => {
      const retained = rows.filter((id) => id >= oldestRetained);
      return { oldestRetainedId: retained[0] ?? null, missingCount: retained.filter((id) => id > afterId).length };
    },
    after: async (afterId, limit = 200) =>
      rows
        .filter((id) => id > afterId && id >= oldestRetained)
        .slice(0, limit)
        .map((seq) => ({ seq, payload: payload(seq) })),
    append: () => void rows.push(rows.length + 1),
  };
  return log;
}

function request(headers: Record<string, string> = {}, query = ""): Request {
  return new Request(`http://localhost/api/v1/stream${query}`, { headers });
}

/** Reads a stream into a growing string while fake timers run. */
function collect(response: Response) {
  const state = { text: "", done: false };
  const reader = (response.body as ReadableStream<Uint8Array>).getReader();
  const decoder = new TextDecoder();
  void (async () => {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      state.text += decoder.decode(chunk.value);
    }
    state.done = true;
  })();
  return state;
}

const ids = (text: string) => [...text.matchAll(/^id: (\d+)$/gm)].map((match) => Number(match[1]));
const events = (text: string) => [...text.matchAll(/^event: (\w+)$/gm)].map((match) => match[1]);

let hub: StreamHub;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
});
afterEach(() => {
  hub?.closeAll();
  vi.useRealTimers();
});

describe("StreamHub (A-13, D13)", () => {
  it("starts with retry: 3000, then ready, then status, with the SSE headers", async () => {
    hub = new StreamHub({ log: fakeLog(3), status: async () => STATUS });
    const response = hub.open(request(), "ip-a");
    const stream = collect(response);
    await vi.advanceTimersByTimeAsync(10);
    expect(stream.text.startsWith("retry: 3000\n\n")).toBe(true);
    expect(events(stream.text)).toEqual(["ready", "status"]);
    expect(stream.text).toContain(`data: {"at":"2026-10-28T12:00:00.000Z","lastEventId":3}`);
    expect(["content-type", "cache-control", "x-accel-buffering"].map((name) => response.headers.get(name))).toEqual([
      "text/event-stream; charset=utf-8",
      "no-cache, no-transform",
      "no",
    ]);
  });

  it("sends a named ping every 15 s and status every 30 s", async () => {
    hub = new StreamHub({ log: fakeLog(0), status: async () => STATUS });
    const stream = collect(hub.open(request(), "ip-a"));
    await vi.advanceTimersByTimeAsync(29_000);
    expect(events(stream.text)).toEqual(["ready", "status", "ping"]);
    await vi.advanceTimersByTimeAsync(1_500);
    expect(events(stream.text).slice(3).sort()).toEqual(["ping", "status"]);
  });

  it("replays rows after Last-Event-ID in ascending order with id equal to payload.seq", async () => {
    hub = new StreamHub({ log: fakeLog(5), status: async () => STATUS });
    const stream = collect(hub.open(request({ "last-event-id": "2" }), "ip-a"));
    await vi.advanceTimersByTimeAsync(10);
    expect(ids(stream.text)).toEqual([3, 4, 5]);
    expect(stream.text).toContain(`"seq":3,"event":{"eventKey":"0000000000000003"`);
    expect(stream.text).toContain(`"provinceSlug":"jawa-barat","firstSeenAt":"2026-10-28T11:59:10.000Z"`);
  });

  it("accepts ?lastEventId when the header is absent", async () => {
    hub = new StreamHub({ log: fakeLog(4), status: async () => STATUS });
    const stream = collect(hub.open(request({}, "?lastEventId=3"), "ip-a"));
    await vi.advanceTimersByTimeAsync(10);
    expect(ids(stream.text)).toEqual([4]);
  });

  it.each([
    ["more than 200 missed rows", fakeLog(260), "10", "gap"],
    ["an id older than the retained window", fakeLog(10, 6), "2", "too-old"],
    ["an id newer than the log", fakeLog(10), "99", "server-restart"],
  ])("answers %s with resync and no replay", async (_label, log, lastEventId, reason) => {
    hub = new StreamHub({ log, status: async () => STATUS });
    const stream = collect(hub.open(request({ "last-event-id": lastEventId }), "ip-a"));
    await vi.advanceTimersByTimeAsync(10);
    expect(ids(stream.text)).toEqual([]);
    expect(stream.text).toContain(`event: resync\ndata: {"reason":"${reason}"}`);
  });

  it("delivers rows written while Redis is down within one 5 s poll", async () => {
    const log = fakeLog(1);
    hub = new StreamHub({ log, status: async () => STATUS });
    const stream = collect(hub.open(request(), "ip-a"));
    await vi.advanceTimersByTimeAsync(10);
    log.append();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(ids(stream.text)).toEqual([2]);
  });

  it("reads at once when Redis signals a new row", async () => {
    const log = fakeLog(1);
    let wake: () => void = () => undefined;
    hub = new StreamHub({ log, status: async () => STATUS, subscribe: (listener) => ((wake = listener), () => undefined) });
    const stream = collect(hub.open(request(), "ip-a"));
    await vi.advanceTimersByTimeAsync(10);
    log.append();
    wake();
    await vi.advanceTimersByTimeAsync(10);
    expect(ids(stream.text)).toEqual([2]);
  });

  it("closes the stream after 15 minutes", async () => {
    hub = new StreamHub({ log: fakeLog(0), status: async () => STATUS });
    const stream = collect(hub.open(request(), "ip-a"));
    await vi.advanceTimersByTimeAsync(15 * 60_000);
    expect(stream.done).toBe(true);
    expect(hub.connectionCount).toBe(0);
  });
});

describe("StreamHub caps (BRIEF A3, D19)", () => {
  it("answers the 7th stream from one X-Real-IP with 503 and Retry-After: 30, even with a new X-Forwarded-For", async () => {
    hub = new StreamHub({ log: fakeLog(0), status: async () => STATUS });
    const open = (forwardedFor: string) => {
      const req = request({ "x-real-ip": "203.0.113.7", "x-forwarded-for": forwardedFor });
      return hub.open(req, clientIp(req.headers));
    };
    const statuses = [open("a"), open("b"), open("c"), open("d"), open("e"), open("f"), open("g")].map((r) => r.status);
    const rejected = open("h");
    expect(statuses).toEqual([200, 200, 200, 200, 200, 200, 503]);
    expect(rejected.headers.get("retry-after")).toBe("30");
    expect(await rejected.json()).toEqual({ error: "Terlalu banyak koneksi langsung. Coba lagi sebentar.", retryAfterSeconds: 30 });
  });

  it("caps all streams of a process at SSE_MAX_CONNECTIONS", () => {
    hub = new StreamHub({ log: fakeLog(0), status: async () => STATUS, maxConnections: 2 });
    const statuses = ["ip-a", "ip-b", "ip-c"].map((ip) => hub.open(request(), ip).status);
    expect(statuses).toEqual([200, 200, 503]);
  });

  it("frees the slot when a client disconnects", async () => {
    hub = new StreamHub({ log: fakeLog(0), status: async () => STATUS, maxPerIp: 1 });
    const controller = new AbortController();
    hub.open(new Request("http://localhost/api/v1/stream", { signal: controller.signal }), "ip-a");
    controller.abort();
    await vi.advanceTimersByTimeAsync(10);
    expect(hub.open(request(), "ip-a").status).toBe(200);
  });
});
