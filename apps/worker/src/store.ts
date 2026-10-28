import { and, eq, gte, lte, or, sql } from "drizzle-orm";
import {
  earthquakeFeeds,
  earthquakes,
  earthquakeUpdates,
  eventLog,
  toEarthquakeEvent,
  type Database,
  type EarthquakeRow,
} from "@indoquake/database";
import { DUPLICATE_MAX_TIME_DELTA_MS, findDuplicate, type NormalizedEarthquake } from "@indoquake/bmkg";
import { resolveProvince } from "@indoquake/regions";
import type { EarthquakeEvent, EarthquakeStreamPayload } from "@indoquake/shared";
import { shouldAnnounce, shouldReannounce, type AnnounceDecision } from "./announce";
import { diffSnapshots, type EarthquakeSnapshot, type FieldChange } from "./diff";

/** Transaction-scoped advisory lock: concurrent upserts (feeds, processes) run one at a time. */
export const INGEST_LOCK_KEY = 7133002;
/** Subscriptions default to M4.5; crossing it on a revision is worth a new notification. */
export const NOTIFY_THRESHOLD_MAGNITUDE = 4.5;

export type UpsertResult = "inserted" | "updated" | "unchanged";

export interface DedupMerge {
  storedKey: string;
  incomingKey: string;
  timeDeltaSeconds: number;
  distanceKm: number;
  magnitudeDelta: number;
}

export interface UpsertOutcome {
  result: UpsertResult;
  /** The full stored row after the write. */
  event: EarthquakeEvent;
  /** event_log id when a row was written (the SSE id), else null. */
  seq: number | null;
  payload: EarthquakeStreamPayload | null;
  announce: AnnounceDecision;
  /** Send notifications for this write (new young quake, or a significant revision). */
  notify: boolean;
  changes: FieldChange[];
  merge: DedupMerge | null;
}

function toSnapshot(row: EarthquakeRow): EarthquakeSnapshot {
  return {
    eventTimeUtc: row.eventTimeUtc.toISOString(),
    magnitude: row.magnitude,
    depthKm: row.depthKm,
    latitude: row.latitude,
    longitude: row.longitude,
    regionName: row.regionName,
    potentialText: row.potentialText,
    feltText: row.feltText,
    shakemapUrl: row.shakemapUrl,
    tsunamiPotential: row.tsunamiPotential,
  };
}

function fromEvent(event: NormalizedEarthquake): EarthquakeSnapshot {
  return {
    eventTimeUtc: event.eventTimeUtc,
    magnitude: event.magnitude,
    depthKm: event.depthKm,
    latitude: event.latitude,
    longitude: event.longitude,
    regionName: event.regionName,
    potentialText: event.potentialText,
    feltText: event.feltText,
    shakemapUrl: event.shakemapUrl,
    tsunamiPotential: event.tsunamiPotential,
  };
}

export function provinceSlugAt(latitude: number, longitude: number): string | null {
  return resolveProvince(latitude, longitude)?.province.slug ?? null;
}

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

async function touchFeed(tx: Tx, earthquakeId: number, feed: string): Promise<void> {
  await tx
    .insert(earthquakeFeeds)
    .values({ earthquakeId, feed })
    .onConflictDoUpdate({
      target: [earthquakeFeeds.earthquakeId, earthquakeFeeds.feed],
      set: { lastSeenAt: new Date() },
    });
}

async function appendLog(tx: Tx, payload: EarthquakeStreamPayload): Promise<number> {
  const [row] = await tx
    .insert(eventLog)
    .values({
      eventKey: payload.event.eventKey,
      type: payload.type === "earthquake:new" ? "new" : "updated",
      payload,
    })
    .returning({ id: eventLog.id });
  if (!row) throw new Error("event_log insert returned no id");
  return row.id;
}

/**
 * Stores one feed record in a single transaction: matches it to an existing quake (same key, or the
 * nearest row within 60 s and 50 km), inserts or merges it, writes revisions, and appends the
 * event_log outbox row the stream publishes after commit (D01, D02, D04, D07).
 */
export async function upsertEarthquake(
  db: Database,
  event: NormalizedEarthquake,
  options: { now?: number; notifyThreshold?: number } = {},
): Promise<UpsertOutcome> {
  const now = options.now ?? Date.now();
  const threshold = options.notifyThreshold ?? NOTIFY_THRESHOLD_MAGNITUDE;
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${INGEST_LOCK_KEY})`);
    const time = Date.parse(event.eventTimeUtc);
    const candidates = await tx
      .select()
      .from(earthquakes)
      .where(
        or(
          eq(earthquakes.eventKey, event.eventKey),
          and(
            gte(earthquakes.eventTimeUtc, new Date(time - DUPLICATE_MAX_TIME_DELTA_MS)),
            lte(earthquakes.eventTimeUtc, new Date(time + DUPLICATE_MAX_TIME_DELTA_MS)),
          ),
        ),
      );
    const sameKey = candidates.find((row) => row.eventKey === event.eventKey);
    const match = sameKey
      ? null
      : findDuplicate(event, candidates);
    const existing = sameKey ?? match?.row ?? null;

    if (!existing) {
      const [inserted] = await tx
        .insert(earthquakes)
        .values({
          eventKey: event.eventKey,
          eventTimeUtc: new Date(event.eventTimeUtc),
          eventTimeWib: event.eventTimeWib,
          latitude: event.latitude,
          longitude: event.longitude,
          depthKm: event.depthKm,
          magnitude: event.magnitude,
          regionName: event.regionName,
          potentialText: event.potentialText,
          tsunamiPotential: event.tsunamiPotential,
          feltText: event.feltText,
          shakemapUrl: event.shakemapUrl,
          source: event.source,
          provinceSlug: provinceSlugAt(event.latitude, event.longitude),
        })
        .onConflictDoNothing({ target: earthquakes.eventKey })
        .returning();
      if (!inserted) throw new Error(`event ${event.eventKey} appeared during insert`);
      await touchFeed(tx, inserted.id, event.feed);
      const stored = toEarthquakeEvent(inserted);
      const announce = shouldAnnounce(stored.eventTimeUtc, now);
      let seq: number | null = null;
      let payload: EarthquakeStreamPayload | null = null;
      if (announce !== "store") {
        const body: EarthquakeStreamPayload = { type: "earthquake:new", event: stored };
        seq = await appendLog(tx, body);
        payload = { ...body, seq };
      }
      return {
        result: "inserted",
        event: stored,
        seq,
        payload,
        announce,
        notify: announce === "notify",
        changes: [],
        merge: null,
      };
    }

    const { changes, updates } = diffSnapshots(toSnapshot(existing), fromEvent(event));
    await touchFeed(tx, existing.id, event.feed);
    const merge: DedupMerge | null = match
      ? {
          storedKey: existing.eventKey,
          incomingKey: event.eventKey,
          timeDeltaSeconds: match.timeDeltaSeconds,
          distanceKm: Number(match.distanceKm.toFixed(3)),
          magnitudeDelta: Number((event.magnitude - existing.magnitude).toFixed(2)),
        }
      : null;

    if (changes.length === 0) {
      const stored = toEarthquakeEvent(existing);
      return {
        result: "unchanged",
        event: stored,
        seq: null,
        payload: null,
        announce: "store",
        notify: false,
        changes,
        merge,
      };
    }

    const latitude = updates.latitude ?? existing.latitude;
    const longitude = updates.longitude ?? existing.longitude;
    const { eventTimeUtc, ...rest } = updates;
    const nowDate = new Date(now);
    const [updated] = await tx
      .update(earthquakes)
      .set({
        ...rest,
        ...(eventTimeUtc ? { eventTimeUtc: new Date(eventTimeUtc) } : {}),
        provinceSlug: provinceSlugAt(latitude, longitude),
        lastUpdatedAt: nowDate,
        updatedAt: nowDate,
      })
      .where(eq(earthquakes.id, existing.id))
      .returning();
    if (!updated) throw new Error(`event ${existing.eventKey} vanished during update`);
    await tx.insert(earthquakeUpdates).values(
      changes.map((change) => ({
        earthquakeId: existing.id,
        field: change.field,
        oldValue: change.oldValue,
        newValue: change.newValue,
        observedAt: nowDate,
      })),
    );
    const stored = toEarthquakeEvent(updated);
    const announce = shouldAnnounce(stored.eventTimeUtc, now);
    let seq: number | null = null;
    let payload: EarthquakeStreamPayload | null = null;
    if (announce !== "store") {
      const body: EarthquakeStreamPayload = {
        type: "earthquake:updated",
        event: stored,
        changedFields: changes.map((change) => change.field),
      };
      seq = await appendLog(tx, body);
      payload = { ...body, seq };
    }
    const notify =
      announce === "notify" &&
      shouldReannounce(
        { magnitude: existing.magnitude, tsunamiPotential: existing.tsunamiPotential },
        { magnitude: updated.magnitude, tsunamiPotential: updated.tsunamiPotential },
        threshold,
      );
    return { result: "updated", event: stored, seq, payload, announce, notify, changes, merge };
  });
}
