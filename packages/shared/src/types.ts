export interface FeltReport {
  mmi: string;
  place: string;
}

export interface EarthquakeEvent {
  eventKey: string;
  eventTimeUtc: string;
  eventTimeWib: string;
  latitude: number;
  longitude: number;
  depthKm: number;
  magnitude: number;
  regionName: string;
  potentialText: string | null;
  tsunamiPotential: boolean | null;
  feltText: string | null;
  feltReports?: FeltReport[];
  shakemapUrl: string | null;
  source: string;
  provinceSlug?: string | null;
  provinceName?: string | null;
  firstSeenAt?: string;
  lastUpdatedAt?: string;
}

export interface EarthquakeRevision {
  field: string;
  oldValue: string | null;
  newValue: string | null;
  observedAt: string;
}

export interface EarthquakeDetail extends EarthquakeEvent {
  feeds: string[];
  revisions: EarthquakeRevision[];
}

export interface EarthquakeStreamPayload {
  type: "earthquake:new" | "earthquake:updated";
  event: EarthquakeEvent;
}

export interface HealthResponse {
  status: "ok" | "degraded";
  time: string;
  checks: {
    database: { ok: boolean; latencyMs: number | null; error: string | null };
    redis: { ok: boolean; error: string | null };
  };
  earthquakes: { count: number | null; latestEventAt: string | null };
  worker: unknown;
}
