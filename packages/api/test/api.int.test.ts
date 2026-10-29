import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { Readable } from "node:stream";
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
import type { EarthquakeStreamPayload } from "@indoquake/shared";
import {
  createEventLogReader,
  getEarthquakeDetail,
  getStatistics,
  listEarthquakesResponse,
  parseListParams,
  StreamHub,
} from "../src";

const NOW = Date.parse("2026-10-28T12:00:00.000Z");
let pg: StartedPostgis;
let db: Database;
let closeDb: () => Promise<void>;

beforeAll(async () => {
  pg = await startPostgis();
  await runMigrations(pg.url);
  const created = createDb(pg.url);
  db = created.db;
  closeDb = () => created.sql.end({ timeout: 5 });
});
afterAll(async () => {
  await closeDb?.();
  await pg?.stop();
});
beforeEach(async () => {
  await db.delete(eventLog);
  await db.delete(earthquakes);
});

function row(index: number, overrides: Partial<typeof earthquakes.$inferInsert> = {}): typeof earthquakes.$inferInsert {
  return {
    eventKey: index.toString(16).padStart(16, "0"),
    eventTimeUtc: new Date(NOW - index * 3_600_000),
    eventTimeWib: "x",
    latitude: -7.2,
    longitude: 107.6,
    depthKm: 10 + (index % 50),
    magnitude: 2 + (index % 5),
    regionName: `Wilayah ${index}`,
    provinceSlug: index % 3 === 0 ? "jawa-barat" : "jawa-timur",
    ...overrides,
  };
}

async function seed(rows: (typeof earthquakes.$inferInsert)[]): Promise<void> {
  for (let start = 0; start < rows.length; start += 500) {
    await db.insert(earthquakes).values(rows.slice(start, start + 500));
  }
}

async function list(query: string) {
  const parsed = parseListParams(new URLSearchParams(query));
  if (!parsed.ok) throw new Error(parsed.error);
  return listEarthquakesResponse(db, parsed.query);
}

describe("GET /api/v1/earthquakes against PostGIS (A-07, A-14)", () => {
  it("filters province in SQL: 50 of 600 rows, all in jawa-barat", async () => {
    await seed(Array.from({ length: 600 }, (_unused, index) => row(index + 1)));
    const page = await list("province=jawa-barat&limit=50");
    expect(page.data).toHaveLength(50);
    expect(new Set(page.data.map((event) => event.provinceSlug))).toEqual(new Set(["jawa-barat"]));
    expect(page.meta).toEqual({ count: 50, limit: 50, page: 1, total: 200, totalPages: 4 });
  });

  it("pages cover the total once with no row twice", async () => {
    await seed(Array.from({ length: 25 }, (_unused, index) => row(index + 1)));
    const pages = await Promise.all(["page=1", "page=2", "page=3"].map((page) => list(`${page}&limit=10`)));
    const keys = pages.flatMap((page) => page.data.map((event) => event.eventKey));
    expect(keys).toHaveLength(25);
    expect(new Set(keys).size).toBe(25);
  });

  it("treats % and _ in q literally", async () => {
    await seed([row(1, { regionName: "Laut 50%_selatan" }), row(2, { regionName: "Laut 50 selatan" })]);
    expect((await list("q=50%25_")).data.map((event) => event.regionName)).toEqual(["Laut 50%_selatan"]);
  });

  it("combines magnitude, depth, time, felt and tsunami filters", async () => {
    await seed([
      row(1, { magnitude: 5.5, depthKm: 20, feltText: "III Bandung", tsunamiPotential: true }),
      row(2, { magnitude: 5.5, depthKm: 20, feltText: null, tsunamiPotential: true }),
      row(3, { magnitude: 3, depthKm: 20, feltText: "II Garut", tsunamiPotential: true }),
    ]);
    const page = await list(
      "minMagnitude=5&maxDepthKm=30&felt=true&tsunami=true&from=2026-10-28T00:00:00Z&to=2026-10-28T12:00:00Z",
    );
    expect(page.data.map((event) => event.eventKey)).toEqual(["0000000000000001"]);
  });
});

describe("GET /api/v1/earthquakes/[eventKey] (A-15)", () => {
  it("returns feeds and revisions newest first, null for unknown or malformed keys", async () => {
    await seed([row(1)]);
    const [stored] = await db.select().from(earthquakes);
    await db.insert(earthquakeUpdates).values([
      { earthquakeId: stored!.id, field: "magnitude", oldValue: "4", newValue: "4.2", observedAt: new Date(NOW - 60_000) },
      { earthquakeId: stored!.id, field: "depthKm", oldValue: "10", newValue: "12", observedAt: new Date(NOW) },
    ]);
    const detail = await getEarthquakeDetail(db, "0000000000000001");
    expect(detail?.revisions.map((revision) => revision.field)).toEqual(["depthKm", "magnitude"]);
    expect(await getEarthquakeDetail(db, "ffffffffffffffff")).toBeNull();
    expect(await getEarthquakeDetail(db, "DROP")).toBeNull();
  });
});

describe("GET /api/v1/statistics (A-17)", () => {
  it("counts all 6000 rows without a cap and lists 12 months", async () => {
    await seed(Array.from({ length: 6000 }, (_unused, index) => row(index + 1, { eventTimeUtc: new Date(NOW - index * 60_000) })));
    const stats = await getStatistics(db, { period: "all", fromUtc: null, nowMs: NOW });
    expect(stats.data.summary.total).toBe(6000);
    expect(stats.data.byMonth).toHaveLength(12);
    expect(stats.data.byMonth.at(-1)).toEqual({ month: "2026-10", count: 6000 });
  });
});

describe("R137 province, area and nearProvince over land, sea and legacy rows (AC 16-18)", () => {
  const land = (index: number, slug: string) =>
    row(index, { provinceSlug: slug, areaKind: "land", nearestProvinceSlug: null, nearestProvinceKm: null, regionVersion: 1 });
  const sea = (index: number, nearest: string, km: number) =>
    row(index, { provinceSlug: null, areaKind: "sea", nearestProvinceSlug: nearest, nearestProvinceKm: km, regionVersion: 1 });
  const legacy = (index: number, slug: string | null) =>
    row(index, { provinceSlug: slug, areaKind: null, nearestProvinceSlug: null, nearestProvinceKm: null, regionVersion: 0 });
  const keys = (page: { data: { eventKey: string }[] }) => page.data.map((event) => event.eventKey).sort();

  beforeEach(async () => {
    await seed([
      land(1, "papua"),
      land(2, "maluku"),
      sea(3, "maluku", 120),
      sea(4, "maluku", 301),
      sea(5, "papua", 40),
      legacy(6, "maluku"),
      legacy(7, null),
      land(8, "papua-barat-daya"),
    ]);
  });

  it.each([
    ["province=maluku", ["0000000000000002", "0000000000000006"]],
    ["province=papua-barat-daya", ["0000000000000008"]],
    ["province=aceh", []],
    ["area=land", ["0000000000000001", "0000000000000002", "0000000000000008"]],
    ["area=sea", ["0000000000000003", "0000000000000004", "0000000000000005"]],
    ["nearProvince=maluku", ["0000000000000003"]],
    ["nearProvince=maluku&area=sea", ["0000000000000003"]],
    ["province=maluku&area=land", ["0000000000000002"]],
  ])("%s", async (query, expected) => {
    expect(keys(await list(query))).toEqual(expected);
  });

  it("serialises sea rows with the nearest province and its zone", async () => {
    const [event] = (await list("nearProvince=papua")).data;
    expect(event).toMatchObject({ areaKind: "sea", provinceSlug: null, nearestProvinceSlug: "papua", nearestProvinceKm: 40, zone: "WIT" });
  });

  it("statistics: 38 provinces with zone, land count and sea count; countSea; area=sea", async () => {
    const stats = await getStatistics(db, { period: "all", fromUtc: null, nowMs: NOW });
    expect(stats.data.byProvince).toHaveLength(38);
    expect(stats.data.byProvince.slice(0, 3)).toEqual([
      { slug: "maluku", name: "Maluku", zone: "WIT", count: 2, seaCount: 1 },
      { slug: "papua", name: "Papua", zone: "WIT", count: 1, seaCount: 1 },
      { slug: "papua-barat-daya", name: "Papua Barat Daya", zone: "WIT", count: 1, seaCount: 0 },
    ]);
    expect(stats.data.byProvince.find((item) => item.slug === "aceh")).toEqual({ slug: "aceh", name: "Aceh", zone: "WIB", count: 0, seaCount: 0 });
    expect(stats.data.summary.countSea).toBe(3);
    const seaOnly = await getStatistics(db, { period: "all", fromUtc: null, area: "sea", nowMs: NOW });
    expect(seaOnly.data.summary).toMatchObject({ total: 3, countSea: 3 });
  });

  it("byDay and byHour bucket on WIB: 17:30 UTC counts in the next WIB day at hour 0", async () => {
    await db.delete(earthquakes);
    await seed([land(1, "papua")].map((value) => ({ ...value, eventTimeUtc: new Date("2026-10-27T17:30:00.000Z") })));
    const stats = await getStatistics(db, { period: "all", fromUtc: null, nowMs: NOW });
    expect(stats.data.byDay.find((day) => day.count > 0)).toEqual({ date: "2026-10-28", count: 1 });
    expect(stats.data.byHour[0]).toBe(1);
  });
});

describe("GET /api/v1/stream over HTTP (A-12, A-13)", () => {
  let server: Server;
  let baseUrl: string;
  let hub: StreamHub;

  beforeAll(async () => {
    hub = new StreamHub({
      log: createEventLogReader(db),
      status: async () => ({ state: "fresh", lastSuccessAt: null, ageSeconds: null, latestEventAt: null, at: "x" }),
      pollIntervalMs: 200,
    });
    server = createServer(async (req, res) => {
      const controller = new AbortController();
      res.on("close", () => controller.abort());
      const headers = new Headers();
      for (const [name, value] of Object.entries(req.headers)) if (typeof value === "string") headers.set(name, value);
      const response = hub.open(new Request(`http://localhost${req.url}`, { headers, signal: controller.signal }), "ip");
      res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
      Readable.fromWeb(response.body as never).pipe(res);
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(async () => {
    hub.closeAll();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });

  async function readFor(response: Response, ms: number): Promise<string> {
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let text = "";
    const deadline = Date.now() + ms;
    while (Date.now() < deadline) {
      const chunk = await Promise.race([reader.read(), new Promise<null>((resolve) => setTimeout(() => resolve(null), deadline - Date.now()))]);
      if (!chunk || chunk.done) break;
      text += decoder.decode(chunk.value);
    }
    await reader.cancel();
    return text;
  }

  it("replays an event committed while Redis was down to a client that reconnects with Last-Event-ID", async () => {
    await seed([row(1)]);
    const payload = { type: "earthquake:new", event: { eventKey: "0000000000000001" } } as EarthquakeStreamPayload;
    const [first] = await db.insert(eventLog).values({ eventKey: "0000000000000001", type: "new", payload }).returning();
    await db.insert(eventLog).values({ eventKey: "0000000000000001", type: "updated", payload });
    const text = await readFor(await fetch(`${baseUrl}/api/v1/stream`, { headers: { "last-event-id": String(first!.id - 1) } }), 800);
    expect(text.startsWith("retry: 3000")).toBe(true);
    expect([...text.matchAll(/^id: (\d+)$/gm)].map((match) => Number(match[1]))).toEqual([first!.id, first!.id + 1]);
  });

  it("delivers a row written after connect through the event_log poll", async () => {
    const response = await fetch(`${baseUrl}/api/v1/stream`);
    const reading = readFor(response, 1500);
    await new Promise((resolve) => setTimeout(resolve, 300));
    const payload = { type: "earthquake:new", event: { eventKey: "00000000000000aa" } } as EarthquakeStreamPayload;
    const [inserted] = await db.insert(eventLog).values({ eventKey: "00000000000000aa", type: "new", payload }).returning();
    expect(await reading).toContain(`id: ${inserted!.id}\nevent: earthquake`);
  });
});
