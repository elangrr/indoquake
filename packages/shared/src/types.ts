export type FeedName = "autogempa" | "gempaterkini" | "gempadirasakan";

/** Time zone of an event or place: WIB UTC+7, WITA UTC+8, WIT UTC+9 (fixed offsets, no DST). */
export type ZoneId = "WIB" | "WITA" | "WIT";

/** land = inside (or snapped to) a province; sea = Laut/Perairan with the nearest province. */
export type AreaKind = "land" | "sea";

export interface FeltReport {
  mmi: string;
  place: string;
}

export interface EarthquakeEvent {
  eventKey: string;
  eventTimeUtc: string; // ISO 8601 UTC, always from Date.toISOString()
  eventTimeWib: string; // BMKG text as received; display fallback only
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
  provinceSlug?: string | null; // containing province (land only); null for sea
  provinceName?: string | null;
  areaKind?: AreaKind | null; // null = legacy row not yet re-assigned
  nearestProvinceSlug?: string | null; // sea only
  nearestProvinceName?: string | null; // sea only
  nearestProvinceKm?: number | null; // sea only, integer km
  zone?: ZoneId; // the API always sends it; older stream payloads may lack it
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
  event: EarthquakeEvent; // full merged stored row, never a feed-local fragment
  seq?: number; // event_log.id, equals the SSE id
  changedFields?: string[]; // only for earthquake:updated
}

export type DataState = "fresh" | "stale" | "down" | "unknown";

export interface DataFreshness {
  state: DataState;
  lastSuccessAt: string | null; // last successful autogempa poll
  ageSeconds: number | null;
  latestEventAt: string | null; // newest eventTimeUtc stored
}

export interface StatusPayload extends DataFreshness {
  at: string;
}

export interface FeedHeartbeat {
  fetched: boolean;
  events: number;
  error?: string;
  lastOkAt?: string | null;
  lastErrorAt?: string | null;
  consecutiveFailures?: number;
  intervalSeconds?: number;
}

export interface WorkerHeartbeat {
  at: string;
  ok: boolean;
  lastSuccessAt?: string | null;
  startedAt?: string;
  feeds: Record<FeedName, FeedHeartbeat>;
  totals?: { inserted: number; updated: number; unchanged: number };
}

export interface HealthResponse {
  status: "ok" | "degraded"; // degraded only when database or redis is down
  time: string;
  checks: {
    database: { ok: boolean; latencyMs: number | null; error: string | null };
    redis: { ok: boolean; error: string | null };
  };
  earthquakes: { count: number | null; latestEventAt: string | null };
  worker: WorkerHeartbeat | null;
  data?: DataFreshness;
}

export interface EarthquakeListResponse {
  data: EarthquakeEvent[];
  meta: {
    count: number;
    limit: number;
    page?: number;
    total?: number;
    totalPages?: number;
  };
}

export interface AreaResponse {
  data: {
    latitude: number;
    longitude: number;
    kind: AreaKind;
    provinceSlug: string | null;
    provinceName: string | null;
    nearestProvinceSlug: string | null;
    nearestProvinceName: string | null;
    nearestProvinceKm: number | null;
    zone: ZoneId;
  };
}

export interface ApiError {
  error: string; // short Indonesian message, never internal error text
  retryAfterSeconds?: number;
}

export interface SseReadyPayload {
  at: string;
  lastEventId: number | null;
}

export interface SseResyncPayload {
  reason: "gap" | "too-old" | "server-restart";
}

export interface SsePingPayload {
  at: string;
}
