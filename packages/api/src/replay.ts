import { SSE_REPLAY_MAX } from "@indoquake/shared";
import type { SseResyncPayload } from "@indoquake/shared";

export type ReplayPlan =
  | { kind: "none" }
  | { kind: "replay"; afterId: number }
  | { kind: "resync"; reason: SseResyncPayload["reason"] };

/**
 * Decides what a reconnecting client gets (SPEC 5 SSE replay):
 * - no Last-Event-ID, or already up to date: nothing
 * - id newer than anything stored (log reset or another server): resync "server-restart"
 * - rows the client missed are no longer retained (older than 6 h): resync "too-old"
 * - more than 200 rows missed: resync "gap"
 * - otherwise replay every row after the id
 */
export function planReplay(input: {
  lastEventId: number | null;
  newestId: number | null;
  /** Oldest event_log id inside the replay window (6 h), null when the window is empty. */
  oldestRetainedId: number | null;
  /** Rows with id > lastEventId inside the replay window. */
  missingCount: number;
}): ReplayPlan {
  const { lastEventId, newestId, oldestRetainedId, missingCount } = input;
  if (lastEventId === null) return { kind: "none" };
  if (newestId === null || lastEventId > newestId) {
    return lastEventId > (newestId ?? 0) ? { kind: "resync", reason: "server-restart" } : { kind: "none" };
  }
  if (lastEventId === newestId) return { kind: "none" };
  if (oldestRetainedId === null || lastEventId < oldestRetainedId - 1) return { kind: "resync", reason: "too-old" };
  if (missingCount > SSE_REPLAY_MAX) return { kind: "resync", reason: "gap" };
  return { kind: "replay", afterId: lastEventId };
}

/** Last-Event-ID header wins over ?lastEventId; anything but a non-negative integer counts as absent. */
export function readLastEventId(request: Request): number | null {
  const header = request.headers.get("last-event-id");
  const query = new URL(request.url).searchParams.get("lastEventId");
  const raw = (header ?? query ?? "").trim();
  if (!/^\d{1,15}$/.test(raw)) return null;
  return Number(raw);
}
