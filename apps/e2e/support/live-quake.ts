import postgres from "postgres";
import type { EarthquakeEvent } from "@indoquake/shared";

/**
 * Stores a new quake the way the worker ingest does: the earthquakes row and its event_log
 * outbox row in one transaction. The stream hub only sends event_log rows; a Redis publish is
 * just its wake-up. Returns the event_log id (the SSE id).
 */
export async function persistNewQuake(databaseUrl: string, event: EarthquakeEvent): Promise<number> {
  const sql = postgres(databaseUrl, { max: 1 });
  try {
    return await sql.begin(async (tx) => {
      await tx`insert into earthquakes ${tx({
        event_key: event.eventKey,
        event_time_utc: new Date(event.eventTimeUtc),
        event_time_wib: event.eventTimeWib,
        latitude: event.latitude,
        longitude: event.longitude,
        depth_km: event.depthKm,
        magnitude: event.magnitude,
        region_name: event.regionName,
        potential_text: event.potentialText,
        tsunami_potential: event.tsunamiPotential,
        felt_text: event.feltText,
        shakemap_url: event.shakemapUrl,
        source: event.source,
        province_slug: event.provinceSlug,
      })}`;
      const [row] = await tx<{ id: string }[]>`
        insert into event_log (event_key, type, payload)
        values (${event.eventKey}, 'new', ${tx.json({ type: "earthquake:new", event } as never)})
        returning id`;
      return Number(row!.id);
    });
  } finally {
    await sql.end();
  }
}
