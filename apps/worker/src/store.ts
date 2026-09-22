import { eq } from "drizzle-orm";
import {
  earthquakeFeeds,
  earthquakes,
  earthquakeUpdates,
  type Database,
} from "@indoquake/database";
import type { NormalizedEarthquake } from "@indoquake/bmkg";
import { diffSnapshots, type EarthquakeSnapshot } from "./diff";

export type UpsertResult = "inserted" | "updated" | "unchanged";

type EarthquakeRow = typeof earthquakes.$inferSelect;

function toSnapshot(row: EarthquakeRow): EarthquakeSnapshot {
  return {
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

async function touchFeed(
  db: Database,
  earthquakeId: number,
  feed: string,
): Promise<void> {
  await db
    .insert(earthquakeFeeds)
    .values({ earthquakeId, feed })
    .onConflictDoUpdate({
      target: [earthquakeFeeds.earthquakeId, earthquakeFeeds.feed],
      set: { lastSeenAt: new Date() },
    });
}

export async function upsertEarthquake(
  db: Database,
  event: NormalizedEarthquake,
): Promise<UpsertResult> {
  const [existing] = await db
    .select()
    .from(earthquakes)
    .where(eq(earthquakes.eventKey, event.eventKey))
    .limit(1);

  if (!existing) {
    const [inserted] = await db
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
      })
      .returning({ id: earthquakes.id });
    if (!inserted) throw new Error(`gagal menyimpan event ${event.eventKey}`);
    await touchFeed(db, inserted.id, event.feed);
    return "inserted";
  }

  const { changes, updates } = diffSnapshots(
    toSnapshot(existing),
    fromEvent(event),
  );

  if (changes.length > 0) {
    const now = new Date();
    await db
      .update(earthquakes)
      .set({ ...updates, lastUpdatedAt: now, updatedAt: now })
      .where(eq(earthquakes.id, existing.id));
    await db.insert(earthquakeUpdates).values(
      changes.map((change) => ({
        earthquakeId: existing.id,
        field: change.field,
        oldValue: change.oldValue,
        newValue: change.newValue,
      })),
    );
    await touchFeed(db, existing.id, event.feed);
    return "updated";
  }

  await touchFeed(db, existing.id, event.feed);
  return "unchanged";
}
