import type { EarthquakeEvent, HealthResponse, StatusPayload } from "@indoquake/shared";

const MIN = 60_000;

interface Seed {
  key: string;
  ago: number; // minutes before now
  lat: number;
  lon: number;
  depth: number;
  mag: number;
  region: string;
  province: string | null;
  felt?: string;
  tsunami?: boolean;
}

// Shapes and wording follow BMKG gempaterkini / gempadirasakan items for Java.
const SEEDS: Seed[] = [
  { key: "9c41d27a0b6e3f15", ago: 18, lat: -7.98, lon: 110.29, depth: 10, mag: 4.3, region: "Pusat gempa berada di darat 14 km BaratDaya Bantul", province: "di-yogyakarta", felt: "III Bantul, II Yogyakarta" },
  { key: "4e7b10c9d2a83f66", ago: 95, lat: -8.31, lon: 106.72, depth: 33, mag: 5.2, region: "Pusat gempa berada di laut 87 km BaratDaya Kab. Sukabumi", province: "jawa-barat", felt: "III Sukabumi, II Pelabuhanratu" },
  { key: "a0d3c5e7f9b11234", ago: 160, lat: -6.86, lon: 107.44, depth: 7, mag: 3.1, region: "Pusat gempa berada di darat 9 km Tenggara Kab. Bandung Barat", province: "jawa-barat" },
  { key: "17f2e4d6c8b0a9e1", ago: 340, lat: -8.78, lon: 112.93, depth: 64, mag: 4.8, region: "Pusat gempa berada di laut 92 km BaratDaya Kab. Malang", province: "jawa-timur" },
  { key: "5b8d0f2a4c6e8a13", ago: 610, lat: -7.25, lon: 109.94, depth: 112, mag: 3.6, region: "Pusat gempa berada di darat 18 km TimurLaut Kab. Wonosobo", province: "jawa-tengah" },
  { key: "c2e4a6b8d0f21357", ago: 980, lat: -9.21, lon: 111.05, depth: 25, mag: 6.1, region: "Pusat gempa berada di laut 143 km Selatan Kab. Pacitan", province: "jawa-timur", felt: "IV Pacitan, III Trenggalek, II Wonogiri", tsunami: false },
  { key: "e1f3a5c7b9d02468", ago: 1500, lat: -6.41, lon: 105.83, depth: 41, mag: 4.0, region: "Pusat gempa berada di laut 31 km BaratLaut Kab. Pandeglang", province: "banten" },
  { key: "3d5f7b9a1c2e4f60", ago: 2900, lat: -7.62, lon: 108.17, depth: 15, mag: 2.9, region: "Pusat gempa berada di darat 6 km Utara Kab. Tasikmalaya", province: "jawa-barat" },
];

export function quakes(nowMs = Date.now()): EarthquakeEvent[] {
  return SEEDS.map((seed) => {
    const at = new Date(nowMs - seed.ago * MIN);
    return {
      eventKey: seed.key,
      eventTimeUtc: at.toISOString(),
      eventTimeWib: "",
      latitude: seed.lat,
      longitude: seed.lon,
      depthKm: seed.depth,
      magnitude: seed.mag,
      regionName: seed.region,
      potentialText: seed.tsunami ? "Berpotensi tsunami" : "Tidak berpotensi tsunami",
      tsunamiPotential: seed.tsunami ?? false,
      feltText: seed.felt ?? null,
      shakemapUrl: null,
      source: "BMKG",
      provinceSlug: seed.province,
      firstSeenAt: at.toISOString(),
      lastUpdatedAt: at.toISOString(),
    };
  });
}

export const NEW_QUAKE_KEY = "b6c8e0a2d4f61379";

export function newQuake(nowMs = Date.now()): EarthquakeEvent {
  const at = new Date(nowMs - 2 * MIN).toISOString();
  return {
    eventKey: NEW_QUAKE_KEY,
    eventTimeUtc: at,
    eventTimeWib: "",
    latitude: -7.69,
    longitude: 109.02,
    depthKm: 12,
    magnitude: 4.6,
    regionName: "Pusat gempa berada di laut 38 km BaratDaya Kab. Cilacap",
    potentialText: "Tidak berpotensi tsunami",
    tsunamiPotential: false,
    feltText: null,
    shakemapUrl: null,
    source: "BMKG",
    provinceSlug: "jawa-tengah",
    firstSeenAt: at,
    lastUpdatedAt: at,
  };
}

export function status(state: StatusPayload["state"], lastSuccessAgoSeconds: number, nowMs = Date.now()): StatusPayload {
  return {
    at: new Date(nowMs).toISOString(),
    state,
    lastSuccessAt: new Date(nowMs - lastSuccessAgoSeconds * 1000).toISOString(),
    ageSeconds: lastSuccessAgoSeconds,
    latestEventAt: new Date(nowMs - 18 * MIN).toISOString(),
  };
}

export function health(state: StatusPayload["state"], lastSuccessAgoSeconds: number, nowMs = Date.now()): HealthResponse {
  const fresh = status(state, lastSuccessAgoSeconds, nowMs);
  return {
    status: "ok",
    time: fresh.at,
    checks: { database: { ok: true, latencyMs: 4, error: null }, redis: { ok: true, error: null } },
    earthquakes: { count: 8, latestEventAt: fresh.latestEventAt },
    worker: null,
    data: { state, lastSuccessAt: fresh.lastSuccessAt, ageSeconds: lastSuccessAgoSeconds, latestEventAt: fresh.latestEventAt },
  };
}
