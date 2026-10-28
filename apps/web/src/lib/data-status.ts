import { DOWN_AFTER_SECONDS, FRESH_MAX_AGE_SECONDS } from "@indoquake/shared";
import type { DataFreshness, DataState, HealthResponse } from "@indoquake/shared";
import type { ConnectionState } from "./live-feed";

export type IndicatorTone = "ok" | "warn" | "down" | "none";

export interface Indicator {
  label: "Langsung" | "Tertunda" | "Terputus" | "Belum ada data";
  tone: IndicatorTone;
}

export function freshnessState(lastSuccessAt: string | null, nowMs: number): DataState {
  if (!lastSuccessAt) return "unknown";
  const ageSeconds = (nowMs - Date.parse(lastSuccessAt)) / 1000;
  if (!Number.isFinite(ageSeconds)) return "unknown";
  if (ageSeconds <= FRESH_MAX_AGE_SECONDS) return "fresh";
  if (ageSeconds <= DOWN_AFTER_SECONDS) return "stale";
  return "down";
}

/** Reads the freshness block from /api/v1/health; older servers without `data` fall back to the worker heartbeat. */
export function freshnessFromHealth(health: HealthResponse, nowMs: number): DataFreshness {
  if (health.data) return health.data;
  const lastSuccessAt =
    health.worker?.lastSuccessAt ?? health.worker?.feeds?.autogempa?.lastOkAt ?? null;
  const state = freshnessState(lastSuccessAt, nowMs);
  return {
    state: state === "unknown" && (health.earthquakes?.count ?? 0) > 0 && !health.worker ? "down" : state,
    lastSuccessAt,
    ageSeconds: lastSuccessAt ? Math.round((nowMs - Date.parse(lastSuccessAt)) / 1000) : null,
    latestEventAt: health.earthquakes?.latestEventAt ?? null,
  };
}

export function deriveIndicator(state: DataState | null, connection: ConnectionState): Indicator {
  if (connection === "closed") return { label: "Terputus", tone: "down" };
  switch (state) {
    case "fresh":
      return { label: "Langsung", tone: "ok" };
    case "stale":
      return { label: "Tertunda", tone: "warn" };
    case "down":
      return { label: "Terputus", tone: "down" };
    default:
      return { label: "Belum ada data", tone: "none" };
  }
}
