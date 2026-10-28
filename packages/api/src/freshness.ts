import {
  DOWN_AFTER_SECONDS,
  FRESH_MAX_AGE_SECONDS,
  type DataFreshness,
  type WorkerHeartbeat,
} from "@indoquake/shared";

/**
 * Data freshness from the worker heartbeat (SPEC 4): "last updated" is the last successful autogempa
 * poll. fresh <= 90 s, stale <= 600 s, down beyond; no heartbeat is down when quakes are stored and
 * unknown on an empty database.
 */
export function computeFreshness(input: {
  heartbeat: WorkerHeartbeat | null;
  eventCount: number;
  latestEventAt: string | null;
  nowMs: number;
}): DataFreshness {
  const { heartbeat, eventCount, latestEventAt, nowMs } = input;
  const lastSuccessAt =
    heartbeat?.lastSuccessAt ??
    heartbeat?.feeds?.autogempa?.lastOkAt ??
    (heartbeat?.feeds?.autogempa?.fetched ? heartbeat.at : null) ??
    null;
  if (!heartbeat || !lastSuccessAt) {
    return { state: eventCount > 0 ? "down" : "unknown", lastSuccessAt, ageSeconds: null, latestEventAt };
  }
  const ageSeconds = Math.max(0, Math.round((nowMs - Date.parse(lastSuccessAt)) / 1000));
  const state = ageSeconds <= FRESH_MAX_AGE_SECONDS ? "fresh" : ageSeconds <= DOWN_AFTER_SECONDS ? "stale" : "down";
  return { state, lastSuccessAt, ageSeconds, latestEventAt };
}
