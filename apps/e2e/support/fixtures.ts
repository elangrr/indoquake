import type { EarthquakeEvent, HealthResponse, StatusPayload, ZoneId } from "@indoquake/shared";

const MIN = 60_000;

interface Seed {
  key: string;
  ago: number; // minutes before now
  lat: number;
  lon: number;
  depth: number;
  mag: number;
  region: string;
  /** Server assignment (R137): land province, or sea with the nearest province and km. Literal, never computed here. */
  area:
    | { kind: "land"; slug: string; name: string; zone: ZoneId }
    | { kind: "sea"; nearestSlug: string; nearestName: string; km: number; zone: ZoneId };
  felt?: string;
  tsunami?: boolean;
}

// National mix (R137): Papua (WIT) newest, Kupang (WITA), two sea events near Java and one in the Banda Sea.
// Region texts follow BMKG gempaterkini / gempadirasakan wording.
const SEEDS: Seed[] = [
  { key: "9c41d27a0b6e3f15", ago: 18, lat: -2.6, lon: 140.67, depth: 10, mag: 4.3, region: "Pusat gempa berada di darat 9 km BaratDaya Kota Jayapura", area: { kind: "land", slug: "papua", name: "Papua", zone: "WIT" }, felt: "III Jayapura, II Sentani" },
  { key: "4e7b10c9d2a83f66", ago: 95, lat: -7.85, lon: 106.25, depth: 33, mag: 5.2, region: "Pusat gempa berada di laut 87 km BaratDaya Kab. Sukabumi", area: { kind: "sea", nearestSlug: "jawa-barat", nearestName: "Jawa Barat", km: 55, zone: "WIB" }, felt: "III Sukabumi, II Pelabuhanratu" },
  { key: "a0d3c5e7f9b11234", ago: 160, lat: -10.12, lon: 123.66, depth: 7, mag: 3.1, region: "Pusat gempa berada di darat 8 km TimurLaut Kota Kupang", area: { kind: "land", slug: "nusa-tenggara-timur", name: "Nusa Tenggara Timur", zone: "WITA" } },
  { key: "17f2e4d6c8b0a9e1", ago: 340, lat: -5.5, lon: 129.0, depth: 64, mag: 4.8, region: "Pusat gempa berada di laut 207 km Tenggara Kab. Maluku Tengah", area: { kind: "sea", nearestSlug: "maluku", nearestName: "Maluku", km: 127, zone: "WIT" } },
  { key: "5b8d0f2a4c6e8a13", ago: 610, lat: -7.25, lon: 109.94, depth: 112, mag: 3.6, region: "Pusat gempa berada di darat 18 km TimurLaut Kab. Wonosobo", area: { kind: "land", slug: "jawa-tengah", name: "Jawa Tengah", zone: "WIB" } },
  { key: "c2e4a6b8d0f21357", ago: 980, lat: -9.21, lon: 111.05, depth: 25, mag: 6.1, region: "Pusat gempa berada di laut 143 km Selatan Kab. Pacitan", area: { kind: "sea", nearestSlug: "jawa-timur", nearestName: "Jawa Timur", km: 103, zone: "WIB" }, felt: "IV Pacitan, III Trenggalek, II Wonogiri", tsunami: false },
  { key: "e1f3a5c7b9d02468", ago: 1500, lat: -0.95, lon: 119.95, depth: 41, mag: 4.0, region: "Pusat gempa berada di darat 10 km Timur Kota Palu", area: { kind: "land", slug: "sulawesi-tengah", name: "Sulawesi Tengah", zone: "WITA" } },
  { key: "3d5f7b9a1c2e4f60", ago: 2900, lat: 5.3, lon: 95.9, depth: 15, mag: 2.9, region: "Pusat gempa berada di darat 21 km Tenggara Kab. Pidie", area: { kind: "land", slug: "aceh", name: "Aceh", zone: "WIB" } },
];

function areaFields(area: Seed["area"]) {
  return area.kind === "land"
    ? { areaKind: "land" as const, provinceSlug: area.slug, provinceName: area.name, nearestProvinceSlug: null, nearestProvinceName: null, nearestProvinceKm: null, zone: area.zone }
    : { areaKind: "sea" as const, provinceSlug: null, provinceName: null, nearestProvinceSlug: area.nearestSlug, nearestProvinceName: area.nearestName, nearestProvinceKm: area.km, zone: area.zone };
}

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
      ...areaFields(seed.area),
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
