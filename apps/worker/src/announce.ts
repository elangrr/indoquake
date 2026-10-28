import { ANNOUNCE_MAX_AGE_MS, NOTIFY_MAX_AGE_MS } from "@indoquake/shared";

/**
 * What to do with a quake seen for the first time, by its age (D07):
 * - "store": older than 6 h, stored silently (no event_log row, no notification)
 * - "log": 30 min to 6 h, event_log row (live clients see it), no notification
 * - "notify": 30 min or younger, event_log row and notification
 */
export type AnnounceDecision = "store" | "log" | "notify";

export function shouldAnnounce(eventTimeUtc: string, nowMs: number): AnnounceDecision {
  const ageMs = nowMs - Date.parse(eventTimeUtc);
  if (ageMs > ANNOUNCE_MAX_AGE_MS) return "store";
  if (ageMs > NOTIFY_MAX_AGE_MS) return "log";
  return "notify";
}

/** Magnitude change that makes a revision worth a new notification. */
export const REANNOUNCE_MAGNITUDE_DELTA = 0.5;

export interface RevisionFacts {
  magnitude: number;
  tsunamiPotential: boolean | null;
}

/**
 * A revision is re-announced (notified again) only when the tsunami flag changes, the magnitude moves
 * by >= 0.5, or the magnitude crosses the notify threshold. Called once per stored revision, so
 * each qualifying change is announced once.
 */
export function shouldReannounce(
  previous: RevisionFacts,
  next: RevisionFacts,
  notifyThreshold: number,
): boolean {
  if (next.tsunamiPotential !== null && next.tsunamiPotential !== previous.tsunamiPotential) {
    return true;
  }
  if (Math.abs(next.magnitude - previous.magnitude) >= REANNOUNCE_MAGNITUDE_DELTA - 1e-9) return true;
  return (previous.magnitude >= notifyThreshold) !== (next.magnitude >= notifyThreshold);
}
