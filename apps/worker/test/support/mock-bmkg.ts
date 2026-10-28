import { createServer, type IncomingHttpHeaders, type Server } from "node:http";
import type { AddressInfo } from "node:net";

export interface MockResponse {
  status: number;
  body?: unknown;
  headers?: Record<string, string>;
  delayMs?: number;
}

/** Local stand-in for data.bmkg.go.id/DataMKG/TEWS: serves /<feed>.json from a mutable route table. */
export interface MockBmkg {
  baseUrl: string;
  routes: Map<string, MockResponse>;
  requests: { path: string; headers: IncomingHttpHeaders }[];
  close: () => Promise<void>;
}

export async function startMockBmkg(): Promise<MockBmkg> {
  const routes = new Map<string, MockResponse>();
  const requests: MockBmkg["requests"] = [];
  const server: Server = createServer((req, res) => {
    const path = req.url ?? "/";
    requests.push({ path, headers: req.headers });
    const route = routes.get(path) ?? { status: 404 };
    setTimeout(() => {
      res.writeHead(route.status, { "content-type": "application/json", ...route.headers });
      res.end(route.body === undefined ? "" : JSON.stringify(route.body));
    }, route.delayMs ?? 0);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    routes,
    requests,
    close: () =>
      new Promise((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}

export function gempa(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    Tanggal: "16 Sep 2026",
    Jam: "08:11:31 WIB",
    DateTime: "2026-09-16T01:11:31+00:00",
    Coordinates: "-7.22,107.62",
    Lintang: "7.22 LS",
    Bujur: "107.62 BT",
    Magnitude: "4.9",
    Kedalaman: "10 km",
    Wilayah: "25 km Tenggara Kab. Bandung",
    Potensi: "Tidak berpotensi tsunami",
    ...overrides,
  };
}

export function feedBody(...items: Record<string, string>[]): unknown {
  return { Infogempa: { gempa: items.length === 1 ? items[0] : items } };
}
