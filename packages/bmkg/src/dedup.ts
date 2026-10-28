import { createHash } from "node:crypto";
import { haversineKm } from "@indoquake/geo";

/** Two records are the same quake when origin times differ by at most this much ... */
export const DUPLICATE_MAX_TIME_DELTA_MS = 60_000;
/** ... and the epicentres are at most this far apart (BMKG revises origin parameters). */
export const DUPLICATE_MAX_DISTANCE_KM = 50;

/** Key of the first-seen fingerprint. A matched later revision keeps the stored key forever. */
export function eventKeyFor(input: {
  eventTimeUtc: string;
  latitude: number;
  longitude: number;
}): string {
  const time = new Date(input.eventTimeUtc).toISOString();
  const fingerprint = `${time}|${input.latitude.toFixed(2)}|${input.longitude.toFixed(2)}`;
  return createHash("sha1").update(fingerprint).digest("hex").slice(0, 16);
}

export interface DedupCandidate {
  eventTimeUtc: string | Date;
  latitude: number;
  longitude: number;
}

export interface DuplicateMatch<T> {
  row: T;
  timeDeltaSeconds: number;
  distanceKm: number;
}

/**
 * Returns the stored row describing the same quake as `candidate` (|dt| <= 60 s and <= 50 km),
 * the nearest one when several qualify, or null.
 */
export function findDuplicate<T extends DedupCandidate>(
  candidate: DedupCandidate,
  rows: readonly T[],
): DuplicateMatch<T> | null {
  const time = new Date(candidate.eventTimeUtc).getTime();
  let best: DuplicateMatch<T> | null = null;
  for (const row of rows) {
    const deltaMs = new Date(row.eventTimeUtc).getTime() - time;
    if (Math.abs(deltaMs) > DUPLICATE_MAX_TIME_DELTA_MS) continue;
    const distanceKm = haversineKm(candidate, row);
    if (distanceKm > DUPLICATE_MAX_DISTANCE_KM) continue;
    if (best === null || distanceKm < best.distanceKm) {
      best = { row, timeDeltaSeconds: deltaMs / 1000, distanceKm };
    }
  }
  return best;
}
