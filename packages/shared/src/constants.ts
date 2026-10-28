export const BMKG_FEED_URLS = {
  autogempa: "https://data.bmkg.go.id/DataMKG/TEWS/autogempa.json",
  gempaterkini: "https://data.bmkg.go.id/DataMKG/TEWS/gempaterkini.json",
  gempadirasakan: "https://data.bmkg.go.id/DataMKG/TEWS/gempadirasakan.json",
} as const;

export const BMKG_SHAKEMAP_BASE_URL = "https://static.bmkg.go.id/";

export const POLL_INTERVAL_SECONDS = {
  autogempa: 10,
  gempaterkini: 20,
  gempadirasakan: 30,
} as const;

export const EVENT_CHANNEL = "indoquake:events";
export const HEARTBEAT_KEY = "indoquake:worker:heartbeat";
export const HEARTBEAT_TTL_SECONDS = 900;

export const FRESH_MAX_AGE_SECONDS = 90;
export const DOWN_AFTER_SECONDS = 600;
export const NOTIFY_MAX_AGE_MS = 30 * 60_000;
export const ANNOUNCE_MAX_AGE_MS = 6 * 3_600_000;

export const SSE_PATH = "/api/v1/stream";
export const SSE_EVENT_EARTHQUAKE = "earthquake";
export const SSE_EVENT_READY = "ready";
export const SSE_EVENT_STATUS = "status";
export const SSE_EVENT_PING = "ping";
export const SSE_EVENT_RESYNC = "resync";
export const SSE_RETRY_MS = 3_000;
export const SSE_PING_INTERVAL_MS = 15_000;
export const SSE_SILENCE_TIMEOUT_MS = 45_000;
export const SSE_MAX_LIFETIME_MS = 15 * 60_000;
export const SSE_REPLAY_MAX = 200;
export const SSE_REPLAY_MAX_AGE_MS = 6 * 3_600_000;
export const SSE_MAX_STREAMS_PER_IP = 5;

export const BMKG_ATTRIBUTION =
  "Sumber data: BMKG (Badan Meteorologi, Klimatologi, dan Geofisika)";

export const SAFETY_DISCLAIMER =
  "Situs ini menyajikan estimasi informasi dan bukan pengganti informasi darurat resmi. " +
  "Untuk peringatan resmi gempa dan tsunami, ikuti BMKG dan pihak berwenang setempat.";
