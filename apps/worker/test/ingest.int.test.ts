import { readFileSync } from "node:fs";
import { asc, count } from "drizzle-orm";
import pino from "pino";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  createDb,
  earthquakes,
  earthquakeUpdates,
  eventLog,
  runMigrations,
  type Database,
} from "@indoquake/database";
import { startPostgis, type StartedPostgis } from "@indoquake/database/test-support";
import type { NormalizedEarthquake } from "@indoquake/bmkg";
import type { EarthquakeEvent, EarthquakeStreamPayload, FeedName } from "@indoquake/shared";
import { backfillProvinces } from "../src/backfill";
import { createFeedPoller } from "../src/ingest";
import { acquireLeadership } from "../src/leader";
import { createRetentionJob } from "../src/retention";
import { upsertEarthquake } from "../src/store";
import { feedBody, gempa, startMockBmkg, type MockBmkg } from "./support/mock-bmkg";

const logger = pino({ level: "silent" });
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

describe("ingest against PostGIS and a mock BMKG", () => {
  it("A-03: a revised record from another feed merges into the first row and keeps its key", async () => {
    const { poll, published } = poller();
    serve("autogempa", feedBody(gempa(YOUNG)));
    await poll("autogempa");
    serve("gempaterkini", feedBody(gempa(REVISED)));
    await poll("gempaterkini");

    const rows = await db.select().from(earthquakes);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.eventKey).toBe(published[0]?.event.eventKey);
    const fields = await db.select({ field: earthquakeUpdates.field }).from(earthquakeUpdates);
    expect(fields.map((row) => row.field).sort()).toEqual(["eventTimeUtc", "latitude", "longitude", "magnitude"]);
    expect(await logTypes()).toEqual(["new", "updated"]);
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

  it("A-07: inserted rows carry province_slug and the backfill fills old null rows idempotently", async () => {
    const { poll } = poller();
    serve("autogempa", feedBody(gempa(YOUNG)));
    await poll("autogempa");
    expect(await db.select({ slug: earthquakes.provinceSlug }).from(earthquakes)).toEqual([{ slug: "jawa-barat" }]);

    await db.update(earthquakes).set({ provinceSlug: null });
    await db.insert(earthquakes).values({
      eventKey: "ffffffffffffffff",
      eventTimeUtc: new Date("2026-10-01T00:00:00Z"),
      eventTimeWib: "x",
      latitude: 2.52,
      longitude: 128.09,
      depthKm: 10,
      magnitude: 5,
      regionName: "Maluku",
    });
    expect(await backfillProvinces(db, 1)).toEqual({ scanned: 2, updated: 1 });
    expect(await backfillProvinces(db, 1)).toEqual({ scanned: 1, updated: 0 });
    const slugs = await db.select({ slug: earthquakes.provinceSlug }).from(earthquakes).orderBy(asc(earthquakes.id));
    expect(slugs).toEqual([{ slug: "jawa-barat" }, { slug: null }]);
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
