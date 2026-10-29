import { readFileSync } from "node:fs";
import { asc, count } from "drizzle-orm";
import pino from "pino";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  createDb,
  earthquakes,
  earthquakeUpdates,
  eventLog,
  type Database,
} from "@indoquake/database";
import { runMigrations } from "@indoquake/database/migrate";
import { startPostgis, type StartedPostgis } from "@indoquake/database/test-support";
import type { NormalizedEarthquake } from "@indoquake/bmkg";
import type { EarthquakeEvent, EarthquakeStreamPayload, FeedName } from "@indoquake/shared";
import { backfillRegions, runRegionBackfill } from "../src/backfill";
import { createFeedPoller } from "../src/ingest";
import { acquireLeadership } from "../src/leader";
import { createRetentionJob } from "../src/retention";
import { upsertEarthquake } from "../src/store";
import { feedBody, gempa, startMockBmkg, type MockBmkg } from "./support/mock-bmkg";

const logLines: string[] = [];
const logger = pino({ level: "info" }, { write: (line: string) => void logLines.push(line) });
const NOW = Date.parse("2026-10-28T12:00:00.000Z");
const FIXTURES = new URL("../../../packages/bmkg/fixtures/", import.meta.url);
const fixture = (name: string): unknown => JSON.parse(readFileSync(new URL(name, FIXTURES), "utf8"));

let pg: StartedPostgis;
let db: Database;
let closeDb: () => Promise<void>;
let bmkg: MockBmkg;

beforeAll(async () => {
  pg = await startPostgis();
  await runMigrations(pg.url);
  const created = createDb(pg.url);
  db = created.db;
  closeDb = () => created.sql.end({ timeout: 5 });
  bmkg = await startMockBmkg();
});

afterAll(async () => {
  await bmkg?.close();
  await closeDb?.();
  await pg?.stop();
});

beforeEach(async () => {
  await db.delete(eventLog);
  await db.delete(earthquakes);
  bmkg.routes.clear();
  bmkg.requests.length = 0;
  logLines.length = 0;
});

function poller(options: { publish?: (p: EarthquakeStreamPayload) => Promise<void> } = {}) {
  const published: EarthquakeStreamPayload[] = [];
  const notified: EarthquakeEvent[] = [];
  const instance = createFeedPoller({
    db,
    logger,
    baseUrl: bmkg.baseUrl,
    now: () => NOW,
    publish: options.publish ?? (async (payload) => void published.push(payload)),
    notify: async (event) => void notified.push(event),
  });
  return { ...instance, published, notified };
}

function serve(feed: FeedName, body: unknown, headers: Record<string, string> = {}) {
  bmkg.routes.set(`/${feed}.json`, { status: 200, body, headers });
}

async function logTypes(): Promise<string[]> {
  const rows = await db.select({ type: eventLog.type }).from(eventLog).orderBy(asc(eventLog.id));
  return rows.map((row) => row.type);
}

const YOUNG = { Tanggal: "28 Okt 2026", Jam: "18:55:00 WIB", DateTime: "2026-10-28T11:55:00+00:00" };
const REVISED = {
  Tanggal: "28 Okt 2026",
  Jam: "18:55:20 WIB",
  DateTime: "2026-10-28T11:55:20+00:00",
  Coordinates: "-7.25,107.65",
  Magnitude: "5.1",
};

const AREA = {
  slug: earthquakes.provinceSlug,
  kind: earthquakes.areaKind,
  nearest: earthquakes.nearestProvinceSlug,
  km: earthquakes.nearestProvinceKm,
  version: earthquakes.regionVersion,
};

/** A row as R133 stored it (region_version 0, no area_kind). */
function seedRow(eventKey: string, latitude: number, longitude: number, provinceSlug: string | null) {
  return {
    eventKey,
    eventTimeUtc: new Date("2026-10-01T00:00:00Z"),
    eventTimeWib: "x",
    latitude,
    longitude,
    depthKm: 10,
    magnitude: 5,
    regionName: eventKey,
    provinceSlug,
    lastUpdatedAt: new Date("2026-10-01T00:05:00Z"),
  };
}

describe("ingest against PostGIS and a mock BMKG", () => {
  it("A-03: a revised record from another feed merges into the first row and keeps its key", async () => {
    const { poll, published } = poller();
    serve("autogempa", feedBody(gempa(YOUNG)));
    await poll("autogempa");
    serve("gempaterkini", feedBody(gempa(REVISED)));
    await poll("gempaterkini");
    serve("gempaterkini", feedBody(gempa(REVISED)));
    await poll("gempaterkini");

    const rows = await db.select().from(earthquakes);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.eventKey).toBe(published[0]?.event.eventKey);
    const fields = await db.select({ field: earthquakeUpdates.field }).from(earthquakeUpdates);
    expect(fields.map((row) => row.field).sort()).toEqual(["eventTimeUtc", "latitude", "longitude", "magnitude"]);
    expect(await logTypes()).toEqual(["new", "updated"]);
    const merges = logLines.map((line) => JSON.parse(line)).filter((line) => line.msg === "dedup merge");
    expect(merges).toEqual([
      expect.objectContaining({
        storedKey: published[0]?.event.eventKey,
        timeDeltaSeconds: -20,
        magnitudeDelta: 0.2,
        distanceKm: expect.any(Number),
        incomingKey: expect.stringMatching(/^[0-9a-f]{16}$/),
      }),
    ]);
  });

  it("A-04: ten concurrent upserts of one new event give one row and one event_log 'new'", async () => {
    const event: NormalizedEarthquake = {
      eventKey: "0123456789abcdef",
      feed: "autogempa",
      eventTimeUtc: "2026-10-28T11:55:00.000Z",
      eventTimeWib: "28 Okt 2026 18:55:00 WIB",
      latitude: -7.22,
      longitude: 107.62,
      depthKm: 10,
      magnitude: 4.9,
      regionName: "Bandung",
      potentialText: null,
      tsunamiPotential: null,
      feltText: null,
      feltReports: [],
      shakemapUrl: null,
      source: "BMKG",
    };
    const results = await Promise.all(Array.from({ length: 10 }, () => upsertEarthquake(db, event, { now: NOW })));
    expect(results.filter((result) => result.result === "inserted")).toHaveLength(1);
    expect(await db.select({ n: count() }).from(earthquakes)).toEqual([{ n: 1 }]);
    expect(await logTypes()).toEqual(["new"]);
  });

  it("A-06: on an empty DB the four September fixtures are stored silently", async () => {
    const { poll, notified, published } = poller();
    serve("autogempa", fixture("autogempa.json"));
    serve("gempaterkini", fixture("gempaterkini.json"));
    serve("gempadirasakan", fixture("gempadirasakan.json"));
    await poll("autogempa");
    await poll("gempaterkini");
    await poll("gempadirasakan");
    const [stored] = await db.select({ n: count() }).from(earthquakes);
    expect(stored?.n).toBeGreaterThan(0);
    expect(await logTypes()).toEqual([]);
    expect([notified.length, published.length]).toEqual([0, 0]);
  });

  it("A-07: inserted rows carry the region assignment and the backfill re-assigns old rows idempotently", async () => {
    const { poll } = poller();
    serve("autogempa", feedBody(gempa(YOUNG)));
    await poll("autogempa");
    expect(await db.select(AREA).from(earthquakes)).toEqual([
      { slug: "jawa-barat", kind: "land", nearest: null, km: null, version: 1 },
    ]);

    await db.update(earthquakes).set({ areaKind: null, regionVersion: 0 });
    await db.insert(earthquakes).values(seedRow("ffffffffffffffff", 2.52, 128.09, null));
    expect(await backfillRegions(pg.url, 1)).toEqual({ scanned: 2, updated: 2, remaining: 0 });
    expect(await backfillRegions(pg.url, 1)).toEqual({ scanned: 0, updated: 0, remaining: 0 });
    expect(await db.select(AREA).from(earthquakes).orderBy(asc(earthquakes.id))).toEqual([
      { slug: "jawa-barat", kind: "land", nearest: null, km: null, version: 1 },
      { slug: null, kind: "sea", nearest: "maluku-utara", km: 14, version: 1 },
    ]);
  });
  it("A-09: sends If-None-Match after an ETag and treats 304 as success without re-writing", async () => {
    const { poll, totals } = poller();
    serve("autogempa", feedBody(gempa(YOUNG)), { etag: '"v1"' });
    expect(await poll("autogempa")).toEqual({ ok: true });
    bmkg.routes.set("/autogempa.json", { status: 304 });
    expect(await poll("autogempa")).toEqual({ ok: true });
    expect(bmkg.requests[1]?.headers["if-none-match"]).toBe('"v1"');
    expect(totals).toEqual({ inserted: 1, updated: 0, unchanged: 0 });
  });

  it("A-10: a 503 or a timeout is a failed poll, never a thrown error", async () => {
    const { poll } = poller();
    bmkg.routes.set("/autogempa.json", { status: 503, headers: { "retry-after": "90" } });
    expect(await poll("autogempa")).toEqual({ ok: false, error: "BMKG autogempa: HTTP 503", retryAfterMs: 90_000 });
    bmkg.routes.set("/autogempa.json", { status: 200, body: {}, delayMs: 9_000 });
    expect(await poll("autogempa")).toMatchObject({ ok: false });
  });

  it("A-12: with Redis down the row and its event_log row are still committed", async () => {
    const { poll } = poller({ publish: async () => Promise.reject(new Error("ECONNREFUSED")) });
    serve("autogempa", feedBody(gempa(YOUNG)));
    expect(await poll("autogempa")).toEqual({ ok: true });
    const [log] = await db.select().from(eventLog);
    expect(log?.type).toBe("new");
    expect((log?.payload as EarthquakeStreamPayload).event.provinceSlug).toBe("jawa-barat");
  });

  it("A-11: keeps old quakes by default, purges with RETENTION_DAYS at most hourly, prunes event_log after 72 h", async () => {
    await db.insert(earthquakes).values({
      eventKey: "aaaaaaaaaaaaaaaa",
      eventTimeUtc: new Date(NOW - 10 * 86_400_000),
      eventTimeWib: "x",
      latitude: -7,
      longitude: 107,
      depthKm: 10,
      magnitude: 3,
      regionName: "old",
    });
    await db.insert(eventLog).values([
      { eventKey: "aaaaaaaaaaaaaaaa", type: "new", payload: {}, createdAt: new Date(NOW - 73 * 3_600_000) },
      { eventKey: "aaaaaaaaaaaaaaaa", type: "updated", payload: {}, createdAt: new Date(NOW - 71 * 3_600_000) },
    ]);
    const keepAll = createRetentionJob(db, { retentionDays: 0, eventLogRetentionHours: 72, logger, now: () => NOW });
    expect(await keepAll()).toBe(true);
    expect(await db.select({ n: count() }).from(earthquakes)).toEqual([{ n: 1 }]);
    expect(await logTypes()).toEqual(["updated"]);

    const clock = [NOW, NOW + 30 * 60_000];
    const sevenDays = createRetentionJob(db, {
      retentionDays: 7,
      eventLogRetentionHours: 72,
      logger,
      now: () => clock.shift() ?? NOW,
    });
    expect([await sevenDays(), await sevenDays()]).toEqual([true, false]);
    expect(await db.select({ n: count() }).from(earthquakes)).toEqual([{ n: 0 }]);
  });

  it("A-20: only one worker holds the ingest leadership", async () => {
    const leader = await acquireLeadership(pg.url);
    const abort = new AbortController();
    const standby = await acquireLeadership(pg.url, { retryMs: 50, signal: abort.signal, onWait: () => abort.abort() });
    expect(standby).toBeNull();
    await leader?.release();
    const next = await acquireLeadership(pg.url);
    expect(next).not.toBeNull();
    await next?.release();
  });
});

describe("R137 region assignment on ingest (AC 19)", () => {
  const AT = (coordinates: string, extra: Record<string, string> = {}) => gempa({ ...YOUNG, Coordinates: coordinates, ...extra });

  it("a new event at Jayapura is land papua at version 1, and its event_log payload carries the area fields", async () => {
    const { poll, published } = poller();
    serve("autogempa", feedBody(AT("-2.5337,140.7181", { Lintang: "2.53 LS", Bujur: "140.72 BT" })));
    await poll("autogempa");
    expect(await db.select(AREA).from(earthquakes)).toEqual([{ slug: "papua", kind: "land", nearest: null, km: null, version: 1 }]);
    const [log] = await db.select().from(eventLog);
    expect((log?.payload as EarthquakeStreamPayload).event).toMatchObject({ areaKind: "land", provinceSlug: "papua", zone: "WIT" });
    expect(published[0]?.event).toMatchObject({ areaKind: "land", provinceSlug: "papua", zone: "WIT" });
  });

  it("an event 100 km south of Bali is sea with the nearest province and integer km", async () => {
    const { poll } = poller();
    serve("autogempa", feedBody(AT("-9.6,115.2", { Lintang: "9.60 LS", Bujur: "115.20 BT" })));
    await poll("autogempa");
    expect(await db.select(AREA).from(earthquakes)).toEqual([{ slug: null, kind: "sea", nearest: "bali", km: 83, version: 1 }]);
  });

  it("an update that moves the event from sea to land re-assigns all four columns", async () => {
    const { poll, published } = poller();
    serve("autogempa", feedBody(AT("-9.0,115.2", { Lintang: "9.00 LS", Bujur: "115.20 BT" })));
    await poll("autogempa");
    expect(await db.select(AREA).from(earthquakes)).toEqual([{ slug: null, kind: "sea", nearest: "bali", km: 17, version: 1 }]);
    serve(
      "gempaterkini",
      feedBody(AT("-8.6705,115.2126", { Lintang: "8.67 LS", Bujur: "115.21 BT", Jam: "18:55:10 WIB", DateTime: "2026-10-28T11:55:10+00:00" })),
    );
    await poll("gempaterkini");
    expect(await db.select(AREA).from(earthquakes)).toEqual([{ slug: "bali", kind: "land", nearest: null, km: null, version: 1 }]);
    expect(published.at(-1)?.event).toMatchObject({ areaKind: "land", provinceSlug: "bali", nearestProvinceSlug: null, zone: "WITA" });
  });
});

describe("R137 region backfill (AC 20, D24)", () => {
  async function seedLegacy() {
    await db.insert(earthquakes).values([
      seedRow("000000000000000a", -6.9175, 107.6191, "jawa-barat"),
      seedRow("000000000000000b", -9.5, 110.0, "di-yogyakarta"),
      seedRow("000000000000000c", -2.5337, 140.7181, null),
      seedRow("000000000000000d", -20, 100, null),
    ]);
  }
  const stored = () =>
    db.select({ ...AREA, lastUpdatedAt: earthquakes.lastUpdatedAt }).from(earthquakes).orderBy(asc(earthquakes.eventKey));
  const UNTOUCHED = new Date("2026-10-01T00:05:00Z");

  it("re-assigns land, R133 offshore, null-slug Papua and far-sea rows once, silently", async () => {
    await seedLegacy();
    expect(await backfillRegions(pg.url)).toEqual({ scanned: 4, updated: 4, remaining: 0 });
    expect(await stored()).toEqual([
      { slug: "jawa-barat", kind: "land", nearest: null, km: null, version: 1, lastUpdatedAt: UNTOUCHED },
      { slug: null, kind: "sea", nearest: "di-yogyakarta", km: 162, version: 1, lastUpdatedAt: UNTOUCHED },
      { slug: "papua", kind: "land", nearest: null, km: null, version: 1, lastUpdatedAt: UNTOUCHED },
      { slug: null, kind: "sea", nearest: "banten", km: 1546, version: 1, lastUpdatedAt: UNTOUCHED },
    ]);
    expect(await backfillRegions(pg.url)).toEqual({ scanned: 0, updated: 0, remaining: 0 });
    expect(await logTypes()).toEqual([]);
  });

  it("two concurrent runs finish without error and leave every row at version 1", async () => {
    await seedLegacy();
    const runs = await Promise.all([backfillRegions(pg.url, 1), backfillRegions(pg.url, 1)]);
    expect(runs.map((run) => run.updated).sort()).toEqual([0, 4]);
    expect((await stored()).map((row) => row.version)).toEqual([1, 1, 1, 1]);
  });

  it("logs province_backfill_done with remaining 0, and REGION_BACKFILL=off skips it", async () => {
    await seedLegacy();
    expect(await runRegionBackfill({ databaseUrl: pg.url, enabled: false, logger })).toBeNull();
    expect((await stored()).map((row) => row.version)).toEqual([0, 0, 0, 0]);
    expect(await runRegionBackfill({ databaseUrl: pg.url, enabled: true, logger })).toEqual({ scanned: 4, updated: 4, remaining: 0 });
    expect(logLines.map((line) => JSON.parse(line).msg)).toEqual(["province_backfill_skipped", "province_backfill_done"]);
    expect(JSON.parse(logLines[1]!)).toMatchObject({ level: 30, scanned: 4, updated: 4, remaining: 0 });
    expect(await logTypes()).toEqual([]);
  });
});
