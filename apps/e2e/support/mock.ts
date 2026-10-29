import type { Page, Route } from "@playwright/test";
import type { EarthquakeEvent, HealthResponse } from "@indoquake/shared";
import { health, quakes } from "./fixtures";

export interface ApiMock {
  events?: EarthquakeEvent[];
  health?: HealthResponse;
  /** Status code for the list endpoint (e.g. 503 to show the error state). */
  listStatus?: number;
  statistics?: unknown;
  statisticsStatus?: number;
  subscribe?: { status: number; body: unknown };
  subscribeTest?: { status: number; body: unknown };
  /** GET /api/v1/area answer (R137); default: Jayapura, land in Papua, WIT. */
  area?: { status: number; body: unknown };
}

export interface ApiLog {
  list: URL[];
  statistics: URL[];
  area: URL[];
  posts: { path: string; body: unknown }[];
}

export const JAYAPURA_AREA = {
  data: {
    latitude: -2.5337,
    longitude: 140.7181,
    kind: "land",
    provinceSlug: "papua",
    provinceName: "Papua",
    nearestProvinceSlug: null,
    nearestProvinceName: null,
    nearestProvinceKm: null,
    zone: "WIT",
  },
};

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

/** Answers every browser call to /api/v1 so the web server needs no database. */
export async function mockApi(page: Page, mock: ApiMock = {}): Promise<ApiLog> {
  const log: ApiLog = { list: [], statistics: [], area: [], posts: [] };
  const events = mock.events ?? quakes();
  await page.route("**/api/v1/**", (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (path === "/api/v1/health") return json(route, mock.health ?? health("fresh", 12));
    if (path === "/api/v1/time") return json(route, { now: new Date().toISOString() });
    if (path === "/api/v1/earthquakes") {
      log.list.push(url);
      if (mock.listStatus && mock.listStatus !== 200) {
        return json(route, { error: "Data belum bisa dimuat." }, mock.listStatus);
      }
      const limit = Number(url.searchParams.get("limit") ?? 100);
      const page = Number(url.searchParams.get("page") ?? 1);
      // R137 filters answered like the API: nearProvince = sea events near that province, area = kind.
      const near = url.searchParams.get("nearProvince");
      const area = url.searchParams.get("area");
      const matching = events
        .filter((event) => !near || (event.areaKind === "sea" && event.nearestProvinceSlug === near))
        .filter((event) => !area || event.areaKind === area);
      const data = matching.slice((page - 1) * limit, page * limit);
      return json(route, {
        data,
        meta: { count: data.length, limit, page, total: matching.length, totalPages: Math.max(1, Math.ceil(matching.length / limit)) },
      });
    }
    if (path.startsWith("/api/v1/earthquakes/")) {
      const key = path.split("/").at(-1);
      const event = events.find((item) => item.eventKey === key);
      return event
        ? json(route, { data: { ...event, feeds: ["autogempa"], revisions: [] } })
        : json(route, { error: "Gempa tidak ditemukan" }, 404);
    }
    if (path === "/api/v1/subscriptions" || path === "/api/v1/subscriptions/test") {
      log.posts.push({ path, body: route.request().postDataJSON() });
      const reply = path.endsWith("/test") ? mock.subscribeTest : mock.subscribe;
      return json(route, reply?.body ?? { error: "Tidak tersedia" }, reply?.status ?? 503);
    }
    if (path === "/api/v1/statistics") {
      log.statistics.push(url);
      return json(route, mock.statistics ?? { error: "Data belum bisa dimuat." }, mock.statisticsStatus ?? (mock.statistics ? 200 : 503));
    }
    if (path === "/api/v1/felt-locations") return json(route, { data: [] });
    if (path === "/api/v1/area") {
      log.area.push(url);
      return json(route, mock.area?.body ?? JAYAPURA_AREA, mock.area?.status ?? 200);
    }
    return json(route, { error: "Tidak tersedia" }, 404);
  });
  return log;
}

declare global {
  interface Window {
    __iqStream: {
      sources: { url: string; closed: boolean }[];
      emit(type: string, data: unknown, id?: string): void;
      fail(): void;
    };
  }
}

/** Replaces EventSource with a stub the test drives: emit frames, fail the connection, read the URLs. */
export async function installStreamStub(page: Page): Promise<void> {
  await page.addInitScript(() => {
    type Listener = (event: MessageEvent<string>) => void;
    class StubEventSource {
      url: string;
      closed = false;
      onerror: ((event: Event) => void) | null = null;
      listeners = new Map<string, Listener[]>();
      constructor(url: string) {
        this.url = url;
        window.__iqStream.sources.push(this);
      }
      addEventListener(type: string, listener: Listener) {
        this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
      }
      removeEventListener() {}
      close() {
        this.closed = true;
      }
    }
    const current = () => {
      const open = window.__iqStream.sources.filter((source) => !source.closed);
      return open.at(-1) as unknown as StubEventSource | undefined;
    };
    window.__iqStream = {
      sources: [],
      emit(type, data, id = "") {
        const source = current();
        const event = { data: JSON.stringify(data), lastEventId: id } as MessageEvent<string>;
        for (const listener of source?.listeners.get(type) ?? []) listener(event);
      },
      fail() {
        current()?.onerror?.(new Event("error"));
      },
    };
    (window as unknown as { EventSource: unknown }).EventSource = StubEventSource;
  });
}

export async function emit(page: Page, type: string, data: unknown, id?: string): Promise<void> {
  await page.evaluate(([t, d, i]) => window.__iqStream.emit(t as string, d, i as string | undefined), [type, data, id] as const);
}

export async function streamUrls(page: Page): Promise<string[]> {
  return page.evaluate(() => window.__iqStream.sources.map((source) => source.url));
}

export async function failStream(page: Page): Promise<void> {
  await page.evaluate(() => window.__iqStream.fail());
}

/** Map tiles never reach the network in tests; both basemap hosts are answered with an abort. */
export async function blockMapTiles(page: Page): Promise<void> {
  await page.route("**/tile.openstreetmap.org/**", (route) => route.abort());
  await page.route("**/basemaps.cartocdn.com/**", (route) => route.abort());
}
