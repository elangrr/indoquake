import type { GeocodeResult } from "./geocode";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const MIN_INTERVAL_MS = 1100;

interface CacheEntry {
  expiresAt: number;
  data: GeocodeResult[];
}

const globalForNominatim = globalThis as unknown as {
  indoquakeNominatimCache?: Map<string, CacheEntry>;
  indoquakeNominatimLastRequestAt?: number;
};

export function getNominatimCache(): Map<string, CacheEntry> {
  if (!globalForNominatim.indoquakeNominatimCache) {
    globalForNominatim.indoquakeNominatimCache = new Map();
  }
  return globalForNominatim.indoquakeNominatimCache;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitForNominatimSlot(): Promise<void> {
  const last = globalForNominatim.indoquakeNominatimLastRequestAt ?? 0;
  const waitMs = MIN_INTERVAL_MS - (Date.now() - last);
  if (waitMs > 0) await sleep(waitMs);
  globalForNominatim.indoquakeNominatimLastRequestAt = Date.now();
}

export interface NominatimViewbox {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface NominatimSearchOptions {
  query: string;
  limit?: number;
  viewbox?: NominatimViewbox;
  bounded?: boolean;
}

interface NominatimResult {
  display_name: string;
  name: string;
  lat: string;
  lon: string;
  addresstype?: string;
  type?: string;
}

export async function searchNominatim(
  options: NominatimSearchOptions,
): Promise<GeocodeResult[]> {
  const url = new URL(NOMINATIM_URL);
  url.searchParams.set("q", options.query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("countrycodes", "id");
  url.searchParams.set("limit", String(options.limit ?? 6));
  url.searchParams.set("accept-language", "id");
  if (options.viewbox) {
    const { left, top, right, bottom } = options.viewbox;
    url.searchParams.set("viewbox", `${left},${top},${right},${bottom}`);
    if (options.bounded) url.searchParams.set("bounded", "1");
  }

  const response = await fetch(url, {
    headers: {
      "user-agent":
        "Indoquake/0.1 (monitoring gempa Indonesia; sumber data BMKG)",
    },
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) {
    throw new Error(`Nominatim HTTP ${response.status}`);
  }
  const raw = (await response.json()) as NominatimResult[];
  return raw
    .map((item) => ({
      label: item.display_name,
      name: item.name,
      latitude: Number(item.lat),
      longitude: Number(item.lon),
      type: item.addresstype ?? item.type ?? null,
    }))
    .filter(
      (item) =>
        Number.isFinite(item.latitude) && Number.isFinite(item.longitude),
    );
}
